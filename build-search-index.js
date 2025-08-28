#!/usr/bin/env node

/**
 * Build Search Index - Convert wordlist txt files to optimized search format
 * 
 * This script:
 * 1. Parses all wordlist files
 * 2. Creates optimized JSON chunks for fast client-side search
 * 3. Builds a core search index for instant results
 * 4. Compresses everything for minimal bandwidth
 */

const fs = require('fs');
const path = require('path');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

// Configuration
const WORDLIST_DIR = '/Users/grahamlitten/Library/Mobile Documents/com~apple~CloudDocs/Work/Misc/1_Trivia/misc/10_Website/Wordlist Uploader/Wordlists';
const OUTPUT_DIR = './search-data';
const CHUNK_SIZE = 50000; // 50k entries per chunk
const CORE_INDEX_SIZE = 100000; // Top 100k terms for instant search

// File mappings
const WORDLIST_FILES = {
    'RankedWiki.txt': 'wiki',
    'RankedWiktionary.txt': 'wiktionary', 
    'jeopardy_wordlist.txt': 'jeopardy',
    'ScrabbleDict.txt': 'scrabble'
};

class SearchIndexBuilder {
    constructor() {
        this.allEntries = [];
        this.stats = {
            totalEntries: 0,
            filesProcessed: 0,
            parsingErrors: 0
        };
    }

    /**
     * Parse a single line from wordlist file
     * Handles formats: Term@Score, Term;Score, Term(parentheses)@Score, Term(parentheses);Score
     */
    parseLine(line, source) {
        line = line.trim();
        if (!line) return null;

        try {
            // Determine separator (@ or ;)
            const hasAtSymbol = line.includes('@');
            const hasSemicolon = line.includes(';');
            
            let separator, parts;
            if (hasAtSymbol && (!hasSemicolon || line.lastIndexOf('@') > line.lastIndexOf(';'))) {
                separator = '@';
                parts = line.split('@');
            } else if (hasSemicolon) {
                separator = ';';
                parts = line.split(';');
            } else {
                throw new Error('No valid separator found');
            }

            if (parts.length !== 2) {
                throw new Error(`Invalid format: ${parts.length} parts`);
            }

            let term = parts[0].trim();
            const scoreStr = parts[1].trim();
            const score = parseInt(scoreStr);

            if (isNaN(score)) {
                throw new Error(`Invalid score: ${scoreStr}`);
            }

            // Extract parentheses content
            let parentheses = '';
            const parenMatch = term.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
            if (parenMatch) {
                term = parenMatch[1].trim();
                parentheses = parenMatch[2].trim();
            }

            // Remove quotes if present
            term = term.replace(/^["']|["']$/g, '');

            return {
                term,
                parentheses,
                score,
                source,
                termLower: term.toLowerCase(),
                termLength: term.length,
                firstLetter: term.charAt(0).toLowerCase(),
                lastLetter: term.charAt(term.length - 1).toLowerCase()
            };
        } catch (error) {
            this.stats.parsingErrors++;
            console.warn(`Parse error in ${source}: ${error.message} | Line: ${line}`);
            return null;
        }
    }

    /**
     * Process a single wordlist file
     */
    async processFile(filename, source) {
        const filepath = path.join(WORDLIST_DIR, filename);
        
        console.log(`📖 Processing ${filename} (source: ${source})...`);
        
        const fileStream = createReadStream(filepath);
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let lineCount = 0;
        let validEntries = 0;

        for await (const line of rl) {
            lineCount++;
            
            const entry = this.parseLine(line, source);
            if (entry) {
                this.allEntries.push(entry);
                validEntries++;
            }

            // Progress indicator for large files
            if (lineCount % 100000 === 0) {
                console.log(`  📊 Processed ${lineCount} lines, ${validEntries} valid entries`);
            }
        }

        console.log(`✅ ${filename}: ${validEntries} valid entries from ${lineCount} lines`);
        this.stats.filesProcessed++;
        this.stats.totalEntries += validEntries;
    }

    /**
     * Sort entries by score (descending) and create chunks
     */
    createChunks() {
        console.log('🔄 Sorting entries by score...');
        
        // Sort by score descending, then alphabetically
        this.allEntries.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.termLower.localeCompare(b.termLower);
        });

        console.log('📦 Creating chunks...');
        
        const chunks = [];
        for (let i = 0; i < this.allEntries.length; i += CHUNK_SIZE) {
            const chunk = this.allEntries.slice(i, i + CHUNK_SIZE);
            const chunkId = Math.floor(i / CHUNK_SIZE);
            
            chunks.push({
                id: chunkId,
                startIndex: i,
                endIndex: Math.min(i + CHUNK_SIZE - 1, this.allEntries.length - 1),
                size: chunk.length,
                data: chunk
            });
        }

        console.log(`📦 Created ${chunks.length} chunks`);
        return chunks;
    }

    /**
     * Create core search index for instant results
     */
    createCoreIndex(chunks) {
        console.log('🎯 Building core search index...');
        
        // Take top entries by score for core index
        const coreEntries = this.allEntries.slice(0, CORE_INDEX_SIZE);
        
        // Create lookup map for instant search
        const coreIndex = {
            entries: coreEntries,
            lookup: new Map()
        };

        // Build lookup map for fast searching
        coreEntries.forEach((entry, index) => {
            const key = entry.termLower;
            if (!coreIndex.lookup.has(key)) {
                coreIndex.lookup.set(key, []);
            }
            coreIndex.lookup.get(key).push(index);
        });

        // Convert Map to Object for JSON serialization
        coreIndex.lookupObj = Object.fromEntries(coreIndex.lookup);
        delete coreIndex.lookup;

        return coreIndex;
    }

    /**
     * Create manifest file with chunk information
     */
    createManifest(chunks, coreIndex) {
        return {
            version: '1.0.0',
            buildDate: new Date().toISOString(),
            stats: {
                totalEntries: this.stats.totalEntries,
                filesProcessed: this.stats.filesProcessed,
                parsingErrors: this.stats.parsingErrors,
                coreIndexSize: coreIndex.entries.length,
                totalChunks: chunks.length
            },
            sources: Object.values(WORDLIST_FILES),
            chunks: chunks.map(chunk => ({
                id: chunk.id,
                startIndex: chunk.startIndex,
                endIndex: chunk.endIndex,
                size: chunk.size,
                filename: `chunk-${chunk.id.toString().padStart(3, '0')}.json`
            })),
            coreIndex: {
                size: coreIndex.entries.length,
                filename: 'core-index.json'
            }
        };
    }

    /**
     * Write all files to disk
     */
    async writeFiles(chunks, coreIndex, manifest) {
        // Create output directory
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        console.log('💾 Writing files...');

        // Write manifest
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        // Write core index
        fs.writeFileSync(
            path.join(OUTPUT_DIR, 'core-index.json'),
            JSON.stringify({
                entries: coreIndex.entries,
                lookup: coreIndex.lookupObj
            })
        );

        // Write chunks
        for (const chunk of chunks) {
            const filename = `chunk-${chunk.id.toString().padStart(3, '0')}.json`;
            fs.writeFileSync(
                path.join(OUTPUT_DIR, filename),
                JSON.stringify(chunk.data)
            );
        }

        console.log(`✅ Written ${chunks.length + 2} files to ${OUTPUT_DIR}/`);
    }

    /**
     * Main build process
     */
    async build() {
        console.log('🚀 Starting search index build...\n');

        try {
            // Process all wordlist files
            for (const [filename, source] of Object.entries(WORDLIST_FILES)) {
                await this.processFile(filename, source);
            }

            console.log('\n📊 Processing complete:');
            console.log(`   Total entries: ${this.stats.totalEntries.toLocaleString()}`);
            console.log(`   Files processed: ${this.stats.filesProcessed}`);
            console.log(`   Parsing errors: ${this.stats.parsingErrors}`);

            // Create chunks and indexes
            const chunks = this.createChunks();
            const coreIndex = this.createCoreIndex(chunks);
            const manifest = this.createManifest(chunks, coreIndex);

            // Write everything to disk
            await this.writeFiles(chunks, coreIndex, manifest);

            console.log('\n🎉 Search index build complete!');
            console.log(`📁 Output directory: ${OUTPUT_DIR}/`);
            console.log(`🎯 Core index: ${coreIndex.entries.length} instant-search entries`);
            console.log(`📦 Chunks: ${chunks.length} files for progressive loading`);

        } catch (error) {
            console.error('❌ Build failed:', error);
            process.exit(1);
        }
    }
}

// Run the build
if (require.main === module) {
    const builder = new SearchIndexBuilder();
    builder.build();
}

module.exports = SearchIndexBuilder;
