/**
 * Static Search Engine - Ultra-fast client-side search for static wordlists
 * 
 * Features:
 * - Instant search on core index (100k top terms)
 * - Progressive loading of additional chunks
 * - Wildcard support (*, ?)
 * - Variable mode (pattern matching)
 * - Crossword mode (letters only)
 * - Simple mode (boundary matching)
 * - Aggressive caching for speed
 */

class StaticSearchEngine {
    constructor(dataPath = './search-data/') {
        this.dataPath = dataPath;
        this.manifest = null;
        this.coreIndex = null;
        this.loadedChunks = new Map();
        this.isLoading = false;
        this.preloadQueue = [];
        
        // Performance tracking
        this.stats = {
            coreHits: 0,
            chunkLoads: 0,
            cacheHits: 0
        };
    }

    /**
     * Initialize the search engine
     */
    async init() {
        try {
            // Load manifest
            this.manifest = await this.loadJSON('manifest.json');
            
            // Load core index for instant search
            this.coreIndex = await this.loadJSON('core-index.json');
            
            // Start preloading popular chunks in background
            this.startBackgroundPreloading();
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize StaticSearchEngine:', error);
            throw error;
        }
    }

    /**
     * Load JSON file with error handling
     */
    async loadJSON(filename) {
        const url = `${this.dataPath}${filename}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
    }

    /**
     * Start background preloading of popular chunks
     */
    startBackgroundPreloading() {
        // Preload first few chunks (highest scoring terms)
        const chunksToPreload = Math.min(3, this.manifest.chunks.length);
        
        for (let i = 0; i < chunksToPreload; i++) {
            setTimeout(() => {
                this.loadChunk(i);
            }, i * 500); // Stagger loading
        }
    }

    /**
     * Load a specific chunk
     */
    async loadChunk(chunkId) {
        if (this.loadedChunks.has(chunkId)) {
            this.stats.cacheHits++;
            return this.loadedChunks.get(chunkId);
        }

        const chunkInfo = this.manifest.chunks.find(c => c.id === chunkId);
        if (!chunkInfo) {
            throw new Error(`Chunk ${chunkId} not found`);
        }

        try {
                            const chunkData = await this.loadJSON(chunkInfo.filename);
                this.loadedChunks.set(chunkId, chunkData);
                this.stats.chunkLoads++;
            return chunkData;
            
        } catch (error) {
            console.error(`❌ Failed to load chunk ${chunkId}:`, error);
            throw error;
        }
    }

    /**
     * Convert wildcard pattern to regex
     */
    wildcardToRegex(pattern, options = {}) {
        try {
            const { crosswordMode = false, simpleMode = false } = options;
            
            if (simpleMode) {
                // Simple mode uses custom matching logic, return a permissive regex
                // Actual filtering will be done in simpleMatch function
                return new RegExp(pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&'), 'i');
            }

            // Standard wildcard mode
            let regexPattern = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
            regexPattern = regexPattern.replace(/\*/g, '.*');
            
            if (crosswordMode) {
                // In crossword mode, ? matches only letters
                regexPattern = regexPattern.replace(/\?/g, '[A-Za-z]');
            } else {
                // Standard mode, ? matches any character
                regexPattern = regexPattern.replace(/\?/g, '.');
            }
            
            return new RegExp(`^${regexPattern}$`, 'i');
        } catch (error) {
            console.warn('Regex creation failed, using fallback:', error);
            // Fallback to simple exact match
            try {
                return new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            } catch (fallbackError) {
                console.warn('Fallback regex also failed, using match-all:', fallbackError);
                return new RegExp('.*', 'i');
            }
        }
    }

    /**
     * Variable pattern matching with wildcard support (e.g., "X Y X" matches "MOM", "*X*" matches "AXE")
     */
    variableMatch(pattern, text) {
        return this.variableMatchRecursive(pattern, text, 0, 0, new Map());
    }
    
    /**
     * Recursive helper for variable matching with wildcards
     */
    variableMatchRecursive(pattern, text, patternIndex, textIndex, variables) {
        // Base cases
        if (patternIndex >= pattern.length) {
            return textIndex >= text.length;
        }
        
        if (textIndex >= text.length) {
            // Check if remaining pattern is only * wildcards
            for (let i = patternIndex; i < pattern.length; i++) {
                if (pattern[i] !== '*') {
                    return false;
                }
            }
            return true;
        }
        
        const patternChar = pattern[patternIndex];
        const textChar = text[textIndex];
        
        if (patternChar === '*') {
            // * wildcard - try matching 0 or more characters
            // Try matching 0 characters (skip the *)
            if (this.variableMatchRecursive(pattern, text, patternIndex + 1, textIndex, new Map(variables))) {
                return true;
            }
            // Try matching 1 or more characters
            return this.variableMatchRecursive(pattern, text, patternIndex, textIndex + 1, new Map(variables));
        }
        
        if (patternChar === '?') {
            // ? wildcard - matches any single character
            return this.variableMatchRecursive(pattern, text, patternIndex + 1, textIndex + 1, new Map(variables));
        }
        
        if (/[A-Z]/i.test(patternChar)) {
            // It's a variable (letter)
            const upperPatternChar = patternChar.toUpperCase();
            const upperTextChar = textChar.toUpperCase();
            
            if (variables.has(upperPatternChar)) {
                // Check if it matches the stored value
                if (variables.get(upperPatternChar) !== upperTextChar) {
                    return false;
                }
            } else {
                // Store the variable value
                variables.set(upperPatternChar, upperTextChar);
            }
            
            return this.variableMatchRecursive(pattern, text, patternIndex + 1, textIndex + 1, variables);
        } else {
            // It's a literal character
            if (patternChar.toUpperCase() !== textChar.toUpperCase()) {
                return false;
            }
            
            return this.variableMatchRecursive(pattern, text, patternIndex + 1, textIndex + 1, variables);
        }
    }

    /**
     * Simple mode pattern matching with specific boundary rules
     */
    simpleMatch(pattern, text) {
        const patternLower = pattern.toLowerCase();
        const textLower = text.toLowerCase();
        
        // Find all occurrences of the pattern in the text
        let index = textLower.indexOf(patternLower);
        
        while (index !== -1) {
            const beforeIndex = index - 1;
            const afterIndex = index + pattern.length;
            
            // Check BEFORE boundary
            let beforeOk = false;
            if (beforeIndex < 0) {
                // Start of string
                beforeOk = true;
            } else {
                const beforeChar = text[beforeIndex];
                if (/[\s\W\d]/.test(beforeChar)) {
                    // Space, special character, or number
                    beforeOk = true;
                } else if (/[a-zA-Z]/.test(beforeChar) && /[A-Z]/.test(text[index])) {
                    // Letter before, but search term starts with capital (e.g., "CompuServe")
                    beforeOk = true;
                }
            }
            
            // Check AFTER boundary
            let afterOk = false;
            if (afterIndex >= text.length) {
                // End of string
                afterOk = true;
            } else {
                const afterChar = text[afterIndex];
                if (/[\s\W\d]/.test(afterChar)) {
                    // Space, special character, or number
                    afterOk = true;
                } else if (/[A-Z]/.test(afterChar)) {
                    // Uppercase letter (e.g., "ServeSoft")
                    afterOk = true;
                }
            }
            
            if (beforeOk && afterOk) {
                return true;
            }
            
            // Look for next occurrence
            index = textLower.indexOf(patternLower, index + 1);
        }
        
        return false;
    }

    /**
     * Search the core index for instant results
     */
    searchCore(searchTerm, options = {}) {
        if (!this.coreIndex || !this.coreIndex.entries) return [];
        
        const results = [];
        let regex;
        
        try {
            regex = this.wildcardToRegex(searchTerm, options);
        } catch (error) {
            console.warn('Regex creation error:', error);
            return [];
        }
        
        // First try direct lookup if it's a simple term
        if (!searchTerm.includes('*') && !searchTerm.includes('?') && !(options.variableMode || options.crosswordMode || options.simpleMode)) {
            const key = searchTerm.toLowerCase();
            if (this.coreIndex.lookup && this.coreIndex.lookup[key]) {
                try {
                    const indexes = this.coreIndex.lookup[key];
                    if (Array.isArray(indexes)) {
                        for (const index of indexes) {
                            if (typeof index === 'number' && index >= 0 && index < this.coreIndex.entries.length) {
                                const entry = this.coreIndex.entries[index];
                                if (entry) {
                                    results.push(entry);
                                }
                            }
                        }
                    }
                    this.stats.coreHits++;
                    return results;
                } catch (error) {
                    console.warn('Direct lookup error:', error);
                }
            }
        }
        
        // Fallback to linear search through all entries
        try {
            for (let i = 0; i < this.coreIndex.entries.length; i++) {
                const entry = this.coreIndex.entries[i];
                if (entry && this.matchEntry(entry, searchTerm, regex, options)) {
                    results.push(entry);
                }
            }
        } catch (error) {
            console.warn('Linear search error:', error);
        }
        
        this.stats.coreHits++;
        return results;
    }

    /**
     * Check if an entry matches the search criteria
     */
    matchEntry(entry, searchTerm, regex, options) {
        const { variableMode = false, crosswordMode = false, simpleMode = false } = options;
        
        // Handle both old format (object) and new format (array)
        let testText = Array.isArray(entry) ? entry[0] : (entry ? entry.term : '');
        if (!testText) return false;
        
        if (simpleMode) {
            return this.simpleMatch(searchTerm, testText);
        }
        
        if (crosswordMode) {
            // Remove non-letters for crossword mode
            testText = testText.replace(/[^a-zA-Z]/g, '');
            const cleanPattern = searchTerm.replace(/[^a-zA-Z*?]/g, '');
            const cleanRegex = this.wildcardToRegex(cleanPattern, options);
            return cleanRegex.test(testText);
        }
        
        if (variableMode) {
            return this.variableMatch(searchTerm, testText);
        }
        
        return regex.test(testText);
    }

    /**
     * Determine which chunks might contain relevant results
     */
    getRelevantChunks(searchTerm, options = {}) {
        // Load all chunks for comprehensive results
        const maxChunks = options.maxChunks || Math.min(6, this.manifest.chunks.length);
        return this.manifest.chunks.slice(0, maxChunks).map(c => c.id);
    }

    /**
     * Search specific chunks
     */
    async searchChunks(chunkIds, searchTerm, options = {}) {
        const results = [];
        const regex = this.wildcardToRegex(searchTerm, options);
        
        for (const chunkId of chunkIds) {
            try {
                const chunkData = await this.loadChunk(chunkId);
                
                for (const entry of chunkData) {
                    if (this.matchEntry(entry, searchTerm, regex, options)) {
                        results.push(entry);
                    }
                }
            } catch (error) {
                console.warn(`Failed to search chunk ${chunkId}:`, error);
            }
        }
        
        return results;
    }

    /**
     * Apply filters to search results
     */
    applyFilters(results, options = {}) {
        const { 
            minScore = 0, 
            maxScore = 100, 
            sources = [], 
            ignoreTerms = [],
            maxResults = 10000,
            dedupe = true
        } = options;
        
        let filtered = results || [];
        
        // Deduplicate results first
        if (dedupe) {
            const seen = new Set();
            filtered = filtered.filter(r => {
                const term = Array.isArray(r) ? r[0] : (r ? r.term : '');
                if (!term) return false;
                
                const key = term.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }
        
        // Score range filter
        if (minScore > 0 || maxScore < 100) {
            filtered = filtered.filter(r => {
                if (!r) return false;
                const score = Array.isArray(r) ? r[2] : (r.score || 0);
                return score >= minScore && score <= maxScore;
            });
        }
        
        // Source filter
        if (sources.length > 0) {
            filtered = filtered.filter(r => {
                if (!r) return false;
                const source = Array.isArray(r) ? r[3] : (r.source || '');
                return sources.includes(source);
            });
        }
        
        // Ignore terms filter with pattern matching
        if (ignoreTerms.length > 0) {
            filtered = filtered.filter(r => {
                if (!r) return false;
                const testText = Array.isArray(r) ? r[0] : (r.term || '');
                
                // Check if this term should be filtered out
                for (const filterTerm of ignoreTerms) {
                    if (this.matchEntry(r, filterTerm, this.wildcardToRegex(filterTerm, options), options)) {
                        return false; // Filter this result out
                    }
                }
                return true; // Keep this result
            });
        }
        
        // Sort by score descending, then alphabetically
        filtered.sort((a, b) => {
            if (!a || !b) return 0;
            
            const scoreA = Array.isArray(a) ? (a[2] || 0) : (a.score || 0);
            const scoreB = Array.isArray(b) ? (b[2] || 0) : (b.score || 0);
            const termA = Array.isArray(a) ? (a[0] || '').toLowerCase() : (a.termLower || '');
            const termB = Array.isArray(b) ? (b[0] || '').toLowerCase() : (b.termLower || '');
            
            if (scoreB !== scoreA) return scoreB - scoreA;
            return termA.localeCompare(termB);
        });
        
        // Return all results (pagination handled in UI)
        return filtered.slice(0, maxResults);
    }

    /**
     * Reset search state for clean searches
     */
    resetSearchState() {
        // Clear any cached regex or state that might interfere
        this.lastSearchTerm = null;
        this.lastOptions = null;
    }

    /**
     * Main search function
     */
    async search(searchTerm, options = {}) {
        const startTime = performance.now();
        
        // Reset state for fresh search
        this.resetSearchState();
        
        if (!searchTerm || !searchTerm.trim()) {
            return { results: [], stats: { searchTime: 0, source: 'empty' } };
        }
        
        searchTerm = searchTerm.trim();
        
        // Ensure we have required components
        if (!this.manifest || !this.coreIndex) {
            return { 
                results: [], 
                stats: { 
                    searchTime: Math.round(performance.now() - startTime), 
                    source: 'not-initialized',
                    error: 'Search engine not initialized' 
                } 
            };
        }
        
        try {
            // 1. Search core index for instant results
            let coreResults = [];
            try {
                coreResults = this.searchCore(searchTerm, options);
                if (!Array.isArray(coreResults)) {
                    coreResults = [];
                }
            } catch (error) {
                coreResults = [];
            }
            
            // 2. If we need more results, search relevant chunks
            let chunkResults = [];
            if (options.searchChunks !== false && coreResults.length < 1000) {
                try {
                    const relevantChunks = this.getRelevantChunks(searchTerm, options);
                    if (Array.isArray(relevantChunks) && relevantChunks.length > 0) {
                        chunkResults = await this.searchChunks(relevantChunks, searchTerm, options);
                        if (!Array.isArray(chunkResults)) {
                            chunkResults = [];
                        }
                    }
                } catch (error) {
                    chunkResults = [];
                }
            }
            
            // 3. Combine and filter results
            const allResults = [...coreResults, ...chunkResults];
            let filteredResults = [];
            
            try {
                filteredResults = this.applyFilters(allResults, options);
                if (!Array.isArray(filteredResults)) {
                    filteredResults = allResults.slice(0, 1000);
                }
            } catch (error) {
                filteredResults = allResults.slice(0, 1000);
            }
            
            const searchTime = performance.now() - startTime;
            
            return {
                results: filteredResults,
                stats: {
                    searchTime: Math.round(searchTime),
                    coreResults: coreResults.length,
                    chunkResults: chunkResults.length,
                    totalResults: filteredResults.length,
                    source: chunkResults.length > 0 ? 'core+chunks' : 'core'
                }
            };
            
        } catch (error) {
            console.error('❌ Search error:', error);
            return { 
                results: [], 
                stats: { 
                    searchTime: Math.round(performance.now() - startTime), 
                    source: 'error',
                    error: error.message 
                } 
            };
        }
    }

    /**
     * Get search engine status
     */
    getStatus() {
        return {
            initialized: !!this.manifest,
            coreLoaded: !!this.coreIndex,
            chunksLoaded: this.loadedChunks.size,
            totalChunks: this.manifest?.chunks.length || 0,
            stats: this.stats
        };
    }
}

// Export for both module and browser usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StaticSearchEngine;
} else {
    window.StaticSearchEngine = StaticSearchEngine;
}
