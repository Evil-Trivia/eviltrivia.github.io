#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const GITHUB_REPO = 'jwolle1/jeopardy_clue_dataset';
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'jeopardy_clues_latest.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LOG_FILE = path.join(DATA_DIR, 'fetch_log.json');
const LAST_UPDATE_FILE = path.join(DATA_DIR, 'last_update.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Utility functions
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    
    console.log(`[${timestamp}] ${type}: ${message}`);
    
    // Save to log file
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
        try {
            logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
        } catch (e) {
            logs = [];
        }
    }
    
    logs.push(logEntry);
    
    // Keep only last 100 log entries
    if (logs.length > 100) {
        logs = logs.slice(-100);
    }
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

function getLastUpdateInfo() {
    if (fs.existsSync(LAST_UPDATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(LAST_UPDATE_FILE, 'utf8'));
        } catch (e) {
            log('Error reading last update file', 'ERROR');
        }
    }
    return null;
}

function saveLastUpdateInfo(fileInfo) {
    const updateInfo = {
        lastFetch: new Date().toISOString(),
        lastFile: fileInfo.name,
        lastModified: fileInfo.modified,
        fileSize: fileInfo.size
    };
    
    fs.writeFileSync(LAST_UPDATE_FILE, JSON.stringify(updateInfo, null, 2));
    log(`Updated last fetch info: ${fileInfo.name}`);
}

function normalizeText(text) {
    if (!text) return text;
    
    return text
        // Fix smart quotes
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        // Fix em dashes and en dashes
        .replace(/[\u2013\u2014]/g, '-')
        // Fix other common unicode artifacts
        .replace(/\u2026/g, '...')
        .replace(/\u2022/g, '•')
        .replace(/\u00A0/g, ' ')
        // Remove any other non-printable characters
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

function parseTSV(tsvContent) {
    const lines = tsvContent.split('\n');
    const headers = lines[0].split('\t').map(h => h.trim());
    
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split('\t');
        const row = {};
        
        headers.forEach((header, index) => {
            if (values[index] !== undefined) {
                row[header] = normalizeText(values[index].trim());
            } else {
                row[header] = '';
            }
        });
        
        data.push(row);
    }
    
    return data;
}

function fetchLatestDataset() {
    return new Promise((resolve, reject) => {
        log('Fetching latest dataset information from GitHub...');
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${GITHUB_REPO}/contents`,
            method: 'GET',
            headers: {
                'User-Agent': 'EvilTrivia-Jeopardy-Fetcher/1.0',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const contents = JSON.parse(data);
                        const combinedSeasonFiles = contents.filter(file => 
                            file.name.startsWith('combined_season') && 
                            file.name.endsWith('.tsv')
                        );
                        
                        if (combinedSeasonFiles.length === 0) {
                            reject(new Error('No combined_season TSV files found'));
                            return;
                        }
                        
                        // Sort by modification date (newest first)
                        combinedSeasonFiles.sort((a, b) => 
                            new Date(b.updated_at) - new Date(a.updated_at)
                        );
                        
                        const latestFile = combinedSeasonFiles[0];
                        log(`Latest file found: ${latestFile.name} (modified: ${latestFile.updated_at})`);
                        
                        resolve(latestFile);
                    } catch (e) {
                        reject(new Error(`Error parsing GitHub API response: ${e.message}`));
                    }
                } else {
                    reject(new Error(`GitHub API returned status ${res.statusCode}`));
                }
            });
        });
        
        req.on('error', (e) => {
            reject(new Error(`Request error: ${e.message}`));
        });
        
        req.end();
    });
}

function downloadFile(downloadUrl, filename) {
    return new Promise((resolve, reject) => {
        log(`Downloading ${filename}...`);
        
        const options = {
            hostname: 'raw.githubusercontent.com',
            path: downloadUrl.replace('https://raw.githubusercontent.com', ''),
            method: 'GET',
            headers: {
                'User-Agent': 'EvilTrivia-Jeopardy-Fetcher/1.0'
            }
        };
        
        const req = https.request(options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Download failed with status ${res.statusCode}`));
                return;
            }
            
            const chunks = [];
            
            res.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                log(`Downloaded ${buffer.length} bytes`);
                resolve(buffer);
            });
        });
        
        req.on('error', (e) => {
            reject(new Error(`Download error: ${e.message}`));
        });
        
        req.end();
    });
}

function createBackup() {
    if (fs.existsSync(OUTPUT_FILE)) {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const backupFile = path.join(BACKUP_DIR, `jeopardy_clues_${timestamp}.json`);
        
        try {
            fs.copyFileSync(OUTPUT_FILE, backupFile);
            log(`Created backup: ${backupFile}`);
            return backupFile;
        } catch (e) {
            log(`Failed to create backup: ${e.message}`, 'WARNING');
        }
    }
    return null;
}

async function main() {
    try {
        log('Starting Jeopardy dataset update process...');
        
        // Check if we need to update
        const lastUpdate = getLastUpdateInfo();
        if (lastUpdate) {
            log(`Last update: ${lastUpdate.lastFetch} (${lastUpdate.lastFile})`);
        }
        
        // Fetch latest dataset info
        const latestFile = await fetchLatestDataset();
        
        // Check if file has changed
        if (lastUpdate && 
            lastUpdate.lastFile === latestFile.name && 
            lastUpdate.lastModified === latestFile.updated_at) {
            log('Dataset is up to date. No update needed.');
            return;
        }
        
        log('New dataset available. Starting download...');
        
        // Create backup of current data
        const backupFile = createBackup();
        
        // Download the file
        const downloadUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${latestFile.name}`;
        const fileBuffer = await downloadFile(downloadUrl, latestFile.name);
        
        // Convert buffer to UTF-8 string (file is already UTF-8)
        log('Converting buffer to UTF-8 string...');
        const utf8Content = fileBuffer.toString('utf8');
        
        // Parse TSV and convert to JSON
        log('Parsing TSV and converting to JSON...');
        const jsonData = parseTSV(utf8Content);
        
        // Save the JSON file
        const outputData = {
            metadata: {
                source: `https://github.com/${GITHUB_REPO}`,
                originalFile: latestFile.name,
                lastModified: latestFile.updated_at,
                processedAt: new Date().toISOString(),
                totalClues: jsonData.length
            },
            clues: jsonData
        };
        
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
        log(`Successfully saved ${jsonData.length} clues to ${OUTPUT_FILE}`);
        
        // Update last update info
        saveLastUpdateInfo({
            name: latestFile.name,
            modified: latestFile.updated_at,
            size: fileBuffer.length
        });
        
        // Clean up old backups (keep last 5)
        const backupFiles = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => ({ name: f, path: path.join(BACKUP_DIR, f) }))
            .sort((a, b) => fs.statSync(b.path).mtime.getTime() - fs.statSync(a.path).mtime.getTime());
        
        if (backupFiles.length > 5) {
            const toDelete = backupFiles.slice(5);
            toDelete.forEach(backup => {
                fs.unlinkSync(backup.path);
                log(`Deleted old backup: ${backup.name}`);
            });
        }
        
        log('Dataset update completed successfully!');
        
        // Automatically split the dataset into chunks for git storage
        log('Splitting dataset into chunks for git storage...');
        try {
            const { splitDataset } = require('./split-dataset.js');
            if (splitDataset()) {
                log('Dataset successfully split into chunks');
            } else {
                log('Warning: Failed to split dataset into chunks', 'WARNING');
            }
        } catch (e) {
            log(`Warning: Could not split dataset: ${e.message}`, 'WARNING');
        }
        
    } catch (error) {
        log(`Error during update process: ${error.message}`, 'ERROR');
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main().catch(error => {
        log(`Fatal error: ${error.message}`, 'ERROR');
        process.exit(1);
    });
}

module.exports = { main, fetchLatestDataset, parseTSV, normalizeText };
