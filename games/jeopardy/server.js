#!/usr/bin/env node

const express = require('express');
const path = require('path');
const fs = require('fs');
const JeopardyEngine = require('./jeopardy-engine');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Initialize Jeopardy engine
const engine = new JeopardyEngine();

// API Routes
app.get('/api/jeopardy/stats', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const stats = engine.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/categories', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const categories = engine.getCategories();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/rounds', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const rounds = engine.getRounds();
        res.json(rounds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/difficulty-levels', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const levels = engine.getDifficultyLevels();
        res.json(levels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/random', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const count = parseInt(req.query.count) || 30;
        const options = {
            categories: req.query.categories ? req.query.categories.split(',') : [],
            rounds: req.query.rounds ? req.query.rounds.split(',') : [],
            difficultyLevels: req.query.difficultyLevels ? req.query.difficultyLevels.split(',') : [],
            minDate: req.query.minDate,
            maxDate: req.query.maxDate
        };
        
        const clues = engine.getRandomClues(count, options);
        res.json({ clues, count: clues.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/category/:category', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const category = decodeURIComponent(req.params.category);
        const count = parseInt(req.query.count) || 5;
        
        const clues = engine.getCluesByCategory(category, count);
        res.json({ clues, category, count: clues.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/search', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }
        
        const maxResults = parseInt(req.query.maxResults) || 100;
        const clues = engine.searchClues(query, { maxResults });
        res.json({ clues, query, count: clues.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jeopardy/export', (req, res) => {
    try {
        if (!engine.loadData()) {
            return res.status(500).json({ error: 'Failed to load Jeopardy data' });
        }
        
        const options = {
            categories: req.query.categories ? req.query.categories.split(',') : [],
            rounds: req.query.rounds ? req.query.rounds.split(',') : [],
            difficultyLevels: req.query.difficultyLevels ? req.query.difficultyLevels.split(',') : [],
            minDate: req.query.minDate,
            maxDate: req.query.maxDate
        };
        
        const clues = engine.getRandomClues(1000, options); // Export up to 1000 clues
        
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                totalClues: clues.length,
                filters: options
            },
            clues: clues
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="jeopardy_export.json"');
        res.json(exportData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Jeopardy API'
    });
});

// Serve the main Jeopardy HTML file
app.get('/jeopardy', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'jeopardy.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Jeopardy API server running on port ${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/jeopardy/`);
    console.log(`🎮 Game available at http://localhost:${PORT}/jeopardy`);
});

module.exports = app;
