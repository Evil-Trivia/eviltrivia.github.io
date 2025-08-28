#!/usr/bin/env node

/**
 * Optimize Search Data - Compress and optimize for web deployment
 * 
 * This script:
 * 1. Compresses the search data using better formats
 * 2. Creates smaller, more manageable chunks
 * 3. Optimizes for GitHub Pages size limits
 * 4. Creates compressed versions for faster loading
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const INPUT_DIR = './search-data';
const OUTPUT_DIR = './search-data-optimized';
const MAX_CHUNK_SIZE_MB = 8; // Target 8MB per chunk (well under 100MB limit)
const CORE_INDEX_SIZE = 50000; // Reduce core index for faster initial load

class SearchDataOptimizer {
    constructor() {
        this.manifest = null;
        this.allEntries = [];
    }

    /**
     * Load and combine all data
     */
    async loadAllData() {
        console.log('📖 Loading existing search data...');
        
        // Load manifest
        const manifestPath = path.join(INPUT_DIR, 'manifest.json');
        this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        console.log(`📊 Found ${this.manifest.stats.totalEntries.toLocaleString()} entries in ${this.manifest.stats.totalChunks} chunks`);
        
        // Load all chunks and combine
        for (const chunkInfo of this.manifest.chunks) {
            const chunkPath = path.join(INPUT_DIR, chunkInfo.filename);
            const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
            this.allEntries.push(...chunkData);
            
            if (this.allEntries.length % 250000 === 0) {
                console.log(`  📦 Loaded ${this.allEntries.length.toLocaleString()} entries...`);
            }
        }
        
        console.log(`✅ Loaded ${this.allEntries.length.toLocaleString()} total entries`);
    }

    /**
     * Optimize data structure for smaller size
     */
    optimizeDataStructure() {
        console.log('🔧 Optimizing data structure...');
        
        // Convert to more compact format
        const optimized = this.allEntries.map(entry => {
            // Use shorter property names and remove redundant data
            return [
                entry.term,           // 0: term
                entry.parentheses,    // 1: parentheses  
                entry.score,          // 2: score
                entry.source,         // 3: source
                entry.termLength,     // 4: term length
                entry.firstLetter,    // 5: first letter
                entry.lastLetter      // 6: last letter
            ];
        });
        
        console.log(`📉 Optimized structure: ${this.allEntries.length.toLocaleString()} entries`);
        return optimized;
    }

    /**
     * Create optimized chunks based on target size
     */
    createOptimizedChunks(optimizedData) {
        console.log('📦 Creating optimized chunks...');
        
        // Test compression to estimate real sizes
        const sampleChunk = optimizedData.slice(0, 1000);
        const sampleJson = JSON.stringify(sampleChunk);
        const sampleCompressed = zlib.gzipSync(sampleJson);
        const compressionRatio = sampleCompressed.length / sampleJson.length;
        
        console.log(`📊 Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
        
        // Calculate target entries per chunk based on compressed size
        const targetCompressedSize = MAX_CHUNK_SIZE_MB * 1024 * 1024;
        const avgEntrySize = sampleJson.length / sampleChunk.length;
        const targetEntriesPerChunk = Math.floor(targetCompressedSize / (avgEntrySize * compressionRatio));
        
        console.log(`🎯 Target entries per chunk: ${targetEntriesPerChunk.toLocaleString()}`);
        
        const chunks = [];
        for (let i = 0; i < optimizedData.length; i += targetEntriesPerChunk) {
            const chunkData = optimizedData.slice(i, i + targetEntriesPerChunk);
            const chunkId = Math.floor(i / targetEntriesPerChunk);
            
            chunks.push({
                id: chunkId,
                startIndex: i,
                endIndex: Math.min(i + targetEntriesPerChunk - 1, optimizedData.length - 1),
                size: chunkData.length,
                data: chunkData
            });
        }
        
        console.log(`📦 Created ${chunks.length} optimized chunks`);
        return chunks;
    }

    /**
     * Create optimized core index
     */
    createOptimizedCoreIndex(optimizedData) {
        console.log('🎯 Creating optimized core index...');
        
        // Take top entries by score for core index (already sorted)
        const coreEntries = optimizedData.slice(0, CORE_INDEX_SIZE);
        
        // Create optimized lookup structure
        const lookup = {};
        coreEntries.forEach((entry, index) => {
            const term = entry[0]; // term is at index 0
            const key = term.toLowerCase();
            if (!lookup[key]) {
                lookup[key] = [];
            }
            lookup[key].push(index);
        });
        
        return {
            entries: coreEntries,
            lookup: lookup,
            format: {
                0: 'term',
                1: 'parentheses', 
                2: 'score',
                3: 'source',
                4: 'termLength',
                5: 'firstLetter',
                6: 'lastLetter'
            }
        };
    }

    /**
     * Create optimized manifest
     */
    createOptimizedManifest(chunks, coreIndex) {
        return {
            version: '2.0.0',
            buildDate: new Date().toISOString(),
            optimized: true,
            format: 'compact-array',
            compression: 'gzip-supported',
            stats: {
                totalEntries: this.allEntries.length,
                coreIndexSize: coreIndex.entries.length,
                totalChunks: chunks.length,
                maxChunkSizeMB: MAX_CHUNK_SIZE_MB
            },
            sources: this.manifest.sources,
            chunks: chunks.map(chunk => ({
                id: chunk.id,
                startIndex: chunk.startIndex,
                endIndex: chunk.endIndex,
                size: chunk.size,
                filename: `chunk-${chunk.id.toString().padStart(3, '0')}.json`,
                filenameGz: `chunk-${chunk.id.toString().padStart(3, '0')}.json.gz`
            })),
            coreIndex: {
                size: coreIndex.entries.length,
                filename: 'core-index.json',
                filenameGz: 'core-index.json.gz'
            },
            dataFormat: coreIndex.format
        };
    }

    /**
     * Write optimized files with compression
     */
    async writeOptimizedFiles(chunks, coreIndex, manifest) {
        // Create output directory
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        console.log('💾 Writing optimized files...');

        // Write manifest
        const manifestJson = JSON.stringify(manifest, null, 2);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), manifestJson);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json.gz'), zlib.gzipSync(manifestJson));

        // Write core index (both regular and compressed)
        const coreIndexJson = JSON.stringify(coreIndex);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'core-index.json'), coreIndexJson);
        fs.writeFileSync(path.join(OUTPUT_DIR, 'core-index.json.gz'), zlib.gzipSync(coreIndexJson));

        // Write chunks (both regular and compressed)
        let totalUncompressed = 0;
        let totalCompressed = 0;

        for (const chunk of chunks) {
            const filename = `chunk-${chunk.id.toString().padStart(3, '0')}.json`;
            const chunkJson = JSON.stringify(chunk.data);
            const chunkCompressed = zlib.gzipSync(chunkJson);
            
            // Write both versions
            fs.writeFileSync(path.join(OUTPUT_DIR, filename), chunkJson);
            fs.writeFileSync(path.join(OUTPUT_DIR, filename + '.gz'), chunkCompressed);
            
            totalUncompressed += chunkJson.length;
            totalCompressed += chunkCompressed.length;
            
            if (chunk.id % 10 === 0) {
                console.log(`  📦 Written chunk ${chunk.id}/${chunks.length}`);
            }
        }

        const compressionRatio = (totalCompressed / totalUncompressed * 100).toFixed(1);
        console.log(`✅ Written ${chunks.length + 2} file sets to ${OUTPUT_DIR}/`);
        console.log(`📊 Compression: ${(totalUncompressed / 1024 / 1024).toFixed(1)}MB → ${(totalCompressed / 1024 / 1024).toFixed(1)}MB (${compressionRatio}%)`);
    }

    /**
     * Generate GitHub Pages deployment info
     */
    generateDeploymentInfo(manifest) {
        const totalSizeCompressed = manifest.chunks.length * MAX_CHUNK_SIZE_MB + 2; // chunks + core + manifest
        
        console.log('\n🚀 Deployment Information:');
        console.log(`📁 Total files: ${manifest.chunks.length + 2}`);
        console.log(`📊 Estimated compressed size: ~${totalSizeCompressed}MB`);
        console.log(`✅ GitHub Pages compatible: ${totalSizeCompressed < 900 ? 'YES' : 'NO'} (under 1GB limit)`);
        console.log(`🔍 Core index: ${manifest.coreIndex.size.toLocaleString()} entries for instant search`);
        console.log(`📦 Chunks: ${manifest.chunks.length} files for progressive loading`);
    }

    /**
     * Main optimization process
     */
    async optimize() {
        console.log('🚀 Starting search data optimization...\n');

        try {
            // Load existing data
            await this.loadAllData();

            // Optimize data structure
            const optimizedData = this.optimizeDataStructure();

            // Create optimized chunks and indexes
            const chunks = this.createOptimizedChunks(optimizedData);
            const coreIndex = this.createOptimizedCoreIndex(optimizedData);
            const manifest = this.createOptimizedManifest(chunks, coreIndex);

            // Write optimized files
            await this.writeOptimizedFiles(chunks, coreIndex, manifest);

            // Show deployment info
            this.generateDeploymentInfo(manifest);

            console.log('\n🎉 Search data optimization complete!');

        } catch (error) {
            console.error('❌ Optimization failed:', error);
            process.exit(1);
        }
    }
}

// Run the optimization
if (require.main === module) {
    const optimizer = new SearchDataOptimizer();
    optimizer.optimize();
}

module.exports = SearchDataOptimizer;
