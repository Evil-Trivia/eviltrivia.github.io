#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class JeopardyEngine {
    constructor(dataPath = null) {
        this.dataPath = dataPath || path.join(__dirname, 'data', 'jeopardy_clues_latest.json');
        this.clues = [];
        this.metadata = null;
        this.categories = new Set();
        this.difficultyLevels = new Set();
        this.loaded = false;
    }

    /**
     * Load the Jeopardy dataset from JSON file
     */
    loadData() {
        try {
            if (!fs.existsSync(this.dataPath)) {
                throw new Error(`Data file not found: ${this.dataPath}`);
            }

            const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
            this.clues = data.clues || [];
            this.metadata = data.metadata || {};
            
            // Extract unique categories and difficulty levels
            this.clues.forEach(clue => {
                if (clue.category) {
                    this.categories.add(clue.category.trim());
                }
                if (clue.clue_value) {
                    this.difficultyLevels.add(clue.clue_value.trim());
                }
            });

            this.loaded = true;
            console.log(`Loaded ${this.clues.length} clues from ${this.metadata.originalFile || 'unknown source'}`);
            
            return true;
        } catch (error) {
            console.error('Failed to load Jeopardy data:', error.message);
            return false;
        }
    }

    /**
     * Get random clues for a game
     */
    getRandomClues(count = 30, options = {}) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        let filteredClues = [...this.clues];

        // Apply filters
        if (options.categories && options.categories.length > 0) {
            filteredClues = filteredClues.filter(clue => 
                options.categories.includes(clue.category)
            );
        }

        if (options.rounds && options.rounds.length > 0) {
            filteredClues = filteredClues.filter(clue => 
                options.rounds.includes(clue.round)
            );
        }

        if (options.difficultyLevels && options.difficultyLevels.length > 0) {
            filteredClues = filteredClues.filter(clue => 
                options.difficultyLevels.includes(clue.clue_value)
            );
        }

        if (options.minDate) {
            filteredClues = filteredClues.filter(clue => 
                new Date(clue.air_date) >= new Date(options.minDate)
            );
        }

        if (options.maxDate) {
            filteredClues = filteredClues.filter(clue => 
                new Date(clue.air_date) <= new Date(options.maxDate)
            );
        }

        // Shuffle and return requested number of clues
        const shuffled = this.shuffleArray(filteredClues);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    /**
     * Get clues for a specific category
     */
    getCluesByCategory(category, count = 5) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        const categoryClues = this.clues.filter(clue => 
            clue.category && clue.category.trim() === category.trim()
        );

        return this.shuffleArray(categoryClues).slice(0, count);
    }

    /**
     * Get clues for a specific round
     */
    getCluesByRound(round, count = 30) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        const roundClues = this.clues.filter(clue => 
            clue.round && clue.round.trim() === round.trim()
        );

        return this.shuffleArray(roundClues).slice(0, count);
    }

    /**
     * Get clues by difficulty (value)
     */
    getCluesByDifficulty(difficulty, count = 10) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        const difficultyClues = this.clues.filter(clue => 
            clue.value && clue.value.trim() === difficulty.trim()
        );

        return this.shuffleArray(difficultyClues).slice(0, count);
    }

    /**
     * Get clues by date range
     */
    getCluesByDateRange(startDate, endDate, count = 50) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const dateClues = this.clues.filter(clue => {
            if (!clue.air_date) return false;
            const clueDate = new Date(clue.air_date);
            return clueDate >= start && clueDate <= end;
        });

        return this.shuffleArray(dateClues).slice(0, count);
    }

    /**
     * Get all available categories
     */
    getCategories() {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }
        return Array.from(this.categories).sort();
    }

    /**
     * Get all available difficulty levels
     */
    getDifficultyLevels() {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }
        return Array.from(this.difficultyLevels).sort((a, b) => {
            // Sort by dollar amount
            const aValue = parseInt(a.replace(/[^\d]/g, '') || '0');
            const bValue = parseInt(b.replace(/[^\d]/g, '') || '0');
            return aValue - bValue;
        });
    }

    /**
     * Get all available rounds
     */
    getRounds() {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }
        const rounds = new Set(this.clues.map(clue => clue.round).filter(Boolean));
        return Array.from(rounds).sort();
    }

    /**
     * Get dataset statistics
     */
    getStats() {
        if (!this.loaded) {
            if (!this.loadData()) {
                return null;
            }
        }

        const stats = {
            totalClues: this.clues.length,
            totalCategories: this.categories.size,
            totalRounds: this.getRounds().length,
            totalDifficultyLevels: this.difficultyLevels.size,
            dateRange: {
                earliest: null,
                latest: null
            },
            roundBreakdown: {},
            categoryBreakdown: {}
        };

        // Date range
        const dates = this.clues
            .map(clue => clue.air_date)
            .filter(Boolean)
            .map(date => new Date(date))
            .sort((a, b) => a - b);

        if (dates.length > 0) {
            stats.dateRange.earliest = dates[0].toISOString().split('T')[0];
            stats.dateRange.latest = dates[dates.length - 1].toISOString().split('T')[0];
        }

        // Round breakdown
        this.clues.forEach(clue => {
            if (clue.round) {
                stats.roundBreakdown[clue.round] = (stats.roundBreakdown[clue.round] || 0) + 1;
            }
        });

        // Category breakdown (top 20)
        const categoryCounts = {};
        this.clues.forEach(clue => {
            if (clue.category) {
                categoryCounts[clue.category] = (categoryCounts[clue.category] || 0) + 1;
            }
        });

        stats.categoryBreakdown = Object.entries(categoryCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});

        return stats;
    }

    /**
     * Search clues by text
     */
    searchClues(query, options = {}) {
        if (!this.loaded) {
            if (!this.loadData()) {
                return [];
            }
        }

        const searchTerm = query.toLowerCase();
        const maxResults = options.maxResults || 100;

        const results = this.clues.filter(clue => {
            const question = (clue.question || '').toLowerCase();
            const answer = (clue.answer || '').toLowerCase();
            const category = (clue.category || '').toLowerCase();

            return question.includes(searchTerm) || 
                   answer.includes(searchTerm) || 
                   category.includes(searchTerm);
        });

        return results.slice(0, maxResults);
    }

    /**
     * Utility: Shuffle array
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Export filtered data to JSON
     */
    exportData(clues, outputPath) {
        try {
            const exportData = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    totalClues: clues.length,
                    source: this.metadata
                },
                clues: clues
            };

            fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
            console.log(`Exported ${clues.length} clues to ${outputPath}`);
            return true;
        } catch (error) {
            console.error('Failed to export data:', error.message);
            return false;
        }
    }
}

// Command line interface for testing
if (require.main === module) {
    const engine = new JeopardyEngine();
    
    if (engine.loadData()) {
        console.log('\n=== Jeopardy Engine Test ===\n');
        
        // Show stats
        const stats = engine.getStats();
        console.log('Dataset Statistics:');
        console.log(`- Total Clues: ${stats.totalClues}`);
        console.log(`- Categories: ${stats.totalCategories}`);
        console.log(`- Rounds: ${stats.totalRounds}`);
        console.log(`- Date Range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}\n`);
        
        // Show sample categories
        const categories = engine.getCategories().slice(0, 10);
        console.log('Sample Categories:');
        categories.forEach(cat => console.log(`- ${cat}`));
        console.log('');
        
        // Show sample clues
        const sampleClues = engine.getRandomClues(3);
        console.log('Sample Clues:');
        sampleClues.forEach((clue, i) => {
            console.log(`${i + 1}. [${clue.category}] $${clue.clue_value}`);
            console.log(`   Q: ${clue.question}`);
            console.log(`   A: ${clue.answer}\n`);
        });
    }
}

module.exports = JeopardyEngine;
