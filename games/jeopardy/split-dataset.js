#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CHUNK_SIZE = 50000; // 50,000 clues per chunk
const DATA_DIR = path.join(__dirname, 'data');
const CHUNKS_DIR = path.join(DATA_DIR, 'chunks');

// Ensure chunks directory exists
if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

function splitDataset() {
    try {
        console.log('🔪 Splitting large dataset into manageable chunks...');
        
        const datasetPath = path.join(DATA_DIR, 'jeopardy_clues_latest.json');
        if (!fs.existsSync(datasetPath)) {
            throw new Error('Dataset file not found. Run fetch-jeopardy-data.js first.');
        }
        
        const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
        const clues = dataset.clues || [];
        
        if (clues.length === 0) {
            throw new Error('No clues found in dataset');
        }
        
        console.log(`📊 Total clues: ${clues.length.toLocaleString()}`);
        console.log(`📦 Chunk size: ${CHUNK_SIZE.toLocaleString()}`);
        
        const totalChunks = Math.ceil(clues.length / CHUNK_SIZE);
        console.log(`🔢 Total chunks: ${totalChunks}`);
        
        // Create metadata file
        const metadata = {
            totalClues: clues.length,
            totalChunks: totalChunks,
            chunkSize: CHUNK_SIZE,
            originalFile: dataset.metadata?.originalFile || 'unknown',
            lastModified: dataset.metadata?.lastModified || 'unknown',
            processedAt: new Date().toISOString(),
            chunks: []
        };
        
        // Split clues into chunks
        for (let i = 0; i < totalChunks; i++) {
            const startIndex = i * CHUNK_SIZE;
            const endIndex = Math.min(startIndex + CHUNK_SIZE, clues.length);
            const chunkClues = clues.slice(startIndex, endIndex);
            
            const chunkData = {
                chunkIndex: i,
                startIndex: startIndex,
                endIndex: endIndex,
                clueCount: chunkClues.length,
                clues: chunkClues
            };
            
            const chunkFileName = `chunk_${i.toString().padStart(3, '0')}.json`;
            const chunkPath = path.join(CHUNKS_DIR, chunkFileName);
            
            fs.writeFileSync(chunkPath, JSON.stringify(chunkData, null, 2));
            
            metadata.chunks.push({
                fileName: chunkFileName,
                clueCount: chunkClues.length,
                startIndex: startIndex,
                endIndex: endIndex
            });
            
            console.log(`✅ Created chunk ${i + 1}/${totalChunks}: ${chunkFileName} (${chunkClues.length.toLocaleString()} clues)`);
        }
        
        // Save metadata
        const metadataPath = path.join(DATA_DIR, 'dataset-metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        
        console.log(`\n🎉 Dataset split complete!`);
        console.log(`📁 Chunks saved to: ${CHUNKS_DIR}/`);
        console.log(`📋 Metadata saved to: ${metadataPath}`);
        console.log(`\n💡 To reassemble: node reassemble-dataset.js`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error splitting dataset:', error.message);
        return false;
    }
}

function reassembleDataset() {
    try {
        console.log('🔧 Reassembling dataset from chunks...');
        
        const metadataPath = path.join(DATA_DIR, 'dataset-metadata.json');
        if (!fs.existsSync(metadataPath)) {
            throw new Error('Metadata file not found. Run split-dataset.js first.');
        }
        
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log(`📊 Reassembling ${metadata.totalClues.toLocaleString()} clues from ${metadata.totalChunks} chunks...`);
        
        const allClues = [];
        
        // Load each chunk
        for (const chunkInfo of metadata.chunks) {
            const chunkPath = path.join(CHUNKS_DIR, chunkInfo.fileName);
            if (!fs.existsSync(chunkPath)) {
                throw new Error(`Chunk file missing: ${chunkInfo.fileName}`);
            }
            
            const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
            allClues.push(...chunkData.clues);
            
            console.log(`✅ Loaded chunk: ${chunkInfo.fileName} (${chunkInfo.clueCount.toLocaleString()} clues)`);
        }
        
        // Reconstruct full dataset
        const fullDataset = {
            metadata: {
                source: `https://github.com/jwolle1/jeopardy_clue_dataset`,
                originalFile: metadata.originalFile,
                lastModified: metadata.lastModified,
                processedAt: metadata.processedAt,
                reassembledAt: new Date().toISOString(),
                totalClues: allClues.length,
                assembledFromChunks: true
            },
            clues: allClues
        };
        
        // Save reassembled dataset
        const outputPath = path.join(DATA_DIR, 'jeopardy_clues_latest.json');
        fs.writeFileSync(outputPath, JSON.stringify(fullDataset, null, 2));
        
        console.log(`\n🎉 Dataset reassembled successfully!`);
        console.log(`📁 Output: ${outputPath}`);
        console.log(`📊 Total clues: ${allClues.length.toLocaleString()}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error reassembling dataset:', error.message);
        return false;
    }
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'split':
        splitDataset();
        break;
    case 'reassemble':
        reassembleDataset();
        break;
    case 'help':
        console.log('Dataset Chunking Utility');
        console.log('');
        console.log('Usage:');
        console.log('  node split-dataset.js split      # Split large dataset into chunks');
        console.log('  node split-dataset.js reassemble # Reassemble dataset from chunks');
        console.log('  node split-dataset.js help       # Show this help');
        console.log('');
        console.log('This utility splits the large JSON dataset into manageable chunks');
        console.log('that can be stored in git, then reassembles them when needed.');
        break;
    default:
        console.log('Dataset Chunking Utility');
        console.log('Run "node split-dataset.js help" for usage information');
        break;
}

module.exports = { splitDataset, reassembleDataset };
