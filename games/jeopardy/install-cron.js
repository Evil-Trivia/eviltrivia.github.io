#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_PATH = path.resolve(__dirname, 'fetch-jeopardy-data.js');
const CRON_SCHEDULE = '0 2 1 * *'; // Run at 2 AM on the 1st of every month

function installCron() {
    try {
        console.log('Installing cron job for Jeopardy dataset updates...');
        
        // Check if script exists and is executable
        if (!fs.existsSync(SCRIPT_PATH)) {
            throw new Error(`Script not found: ${SCRIPT_PATH}`);
        }
        
        // Make script executable
        try {
            execSync(`chmod +x "${SCRIPT_PATH}"`);
            console.log('Made script executable');
        } catch (e) {
            console.log('Note: Could not make script executable (may need sudo)');
        }
        
        // Create cron job entry
        const cronEntry = `${CRON_SCHEDULE} cd "${__dirname}" && node "${SCRIPT_PATH}" >> "${path.join(__dirname, 'data', 'cron.log')}" 2>&1`;
        
        // Check if cron job already exists
        let existingCrons = '';
        try {
            existingCrons = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
            
            if (existingCrons.includes(SCRIPT_PATH)) {
                console.log('Cron job already exists for this script');
                return;
            }
        } catch (e) {
            // No existing crontab, that's fine
        }
        
        // Add new cron job
        const newCrontab = `${existingCrons}\n# Jeopardy dataset update - runs monthly\n${cronEntry}\n`;
        
        // Write to temporary file
        const tempFile = path.join(__dirname, 'temp_crontab');
        fs.writeFileSync(tempFile, newCrontab);
        
        // Install new crontab
        execSync(`crontab "${tempFile}"`);
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        console.log('✅ Cron job installed successfully!');
        console.log(`📅 Schedule: ${CRON_SCHEDULE} (monthly at 2 AM)`);
        console.log(`📁 Script: ${SCRIPT_PATH}`);
        console.log(`📝 Logs: ${path.join(__dirname, 'data', 'cron.log')}`);
        
        // Show current crontab
        console.log('\n📋 Current crontab:');
        try {
            execSync('crontab -l', { stdio: 'inherit' });
        } catch (e) {
            console.log('Could not display current crontab');
        }
        
    } catch (error) {
        console.error('❌ Failed to install cron job:', error.message);
        console.log('\n💡 Manual installation:');
        console.log(`1. Run: crontab -e`);
        console.log(`2. Add this line: ${CRON_SCHEDULE} cd "${__dirname}" && node "${SCRIPT_PATH}" >> "${path.join(__dirname, 'data', 'cron.log')}" 2>&1`);
        console.log(`3. Save and exit`);
        process.exit(1);
    }
}

function removeCron() {
    try {
        console.log('Removing cron job for Jeopardy dataset updates...');
        
        // Get current crontab
        const existingCrons = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
        
        // Remove lines containing our script
        const filteredCrons = existingCrons
            .split('\n')
            .filter(line => !line.includes(SCRIPT_PATH) && !line.includes('# Jeopardy dataset update'))
            .filter(line => line.trim() !== '');
        
        if (filteredCrons.length === existingCrons.split('\n').filter(line => line.trim() !== '').length) {
            console.log('No cron job found for this script');
            return;
        }
        
        // Write new crontab
        const tempFile = path.join(__dirname, 'temp_crontab');
        fs.writeFileSync(tempFile, filteredCrons.join('\n') + '\n');
        
        // Install new crontab
        execSync(`crontab "${tempFile}"`);
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        console.log('✅ Cron job removed successfully!');
        
    } catch (error) {
        console.error('❌ Failed to remove cron job:', error.message);
        console.log('\n💡 Manual removal:');
        console.log(`1. Run: crontab -e`);
        console.log(`2. Remove lines containing: ${SCRIPT_PATH}`);
        console.log(`3. Save and exit`);
    }
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'install':
    case undefined:
        installCron();
        break;
    case 'remove':
        removeCron();
        break;
    case 'help':
        console.log('Jeopardy Cron Installer');
        console.log('');
        console.log('Usage:');
        console.log('  node install-cron.js          # Install cron job');
        console.log('  node install-cron.js install  # Install cron job');
        console.log('  node install-cron.js remove   # Remove cron job');
        console.log('  node install-cron.js help     # Show this help');
        console.log('');
        console.log('The cron job will run monthly to update the Jeopardy dataset.');
        break;
    default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "node install-cron.js help" for usage information');
        process.exit(1);
}
