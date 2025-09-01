#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { reassembleDataset } = require('./split-dataset.js');

console.log('🚀 Setting up Jeopardy dataset for EvilTrivia...\n');

// Check if dataset already exists
const datasetPath = path.join(__dirname, 'data', 'jeopardy_clues_latest.json');
const chunksDir = path.join(__dirname, 'data', 'chunks');
const metadataPath = path.join(__dirname, 'data', 'dataset-metadata.json');

if (fs.existsSync(datasetPath)) {
    console.log('✅ Dataset already exists!');
    console.log('📁 Location:', datasetPath);
    
    // Check if it's the full dataset
    try {
        const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
        if (dataset.clues && dataset.clues.length > 0) {
            console.log(`📊 Total clues: ${dataset.clues.length.toLocaleString()}`);
            console.log('🎯 Ready to use!');
            return;
        }
    } catch (e) {
        console.log('⚠️  Existing dataset appears corrupted, will reassemble...');
    }
}

// Check if chunks exist
if (!fs.existsSync(chunksDir) || !fs.existsSync(metadataPath)) {
    console.log('❌ Dataset chunks not found!');
    console.log('💡 Please run: npm run fetch');
    console.log('   This will download and chunk the dataset automatically.');
    return;
}

console.log('🔧 Reassembling dataset from chunks...');
console.log('📁 Chunks directory:', chunksDir);
console.log('📋 Metadata file:', metadataPath);

// Reassemble the dataset
if (reassembleDataset()) {
    console.log('\n🎉 Setup complete!');
    console.log('📊 Your Jeopardy dataset is ready to use.');
    console.log('🚀 Start the game with: npm start');
    console.log('🌐 Or visit: http://localhost:3001/jeopardy');
} else {
    console.log('\n❌ Setup failed!');
    console.log('💡 Please check the error messages above.');
    console.log('🔄 Try running: npm run reassemble');
}
