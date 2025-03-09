const express = require('express');
const path = require('path');
const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

// Billboard data URL
const BILLBOARD_DATA_URL = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/billboard-200-current.csv';

// Serve static files
app.use(express.static(path.join(__dirname)));

// Cache the billboard data
let billboardData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Function to fetch and parse the CSV data
async function fetchBillboardData() {
    try {
        // Check if we need to refresh the cache
        const now = Date.now();
        if (billboardData && (now - lastFetchTime < CACHE_DURATION)) {
            return billboardData;
        }

        console.log('Fetching fresh Billboard data...');
        const response = await axios.get(BILLBOARD_DATA_URL);
        const csvData = response.data;

        // Parse CSV data
        const results = [];
        const readableStream = Readable.from([csvData]);

        await new Promise((resolve, reject) => {
            readableStream
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    billboardData = results;
                    lastFetchTime = now;
                    console.log(`Loaded ${results.length} chart entries`);
                    resolve();
                })
                .on('error', reject);
        });

        return billboardData;
    } catch (error) {
        console.error('Error fetching Billboard data:', error);
        throw error;
    }
}

// API endpoint to get all data
app.get('/api/billboard', async (req, res) => {
    try {
        const data = await fetchBillboardData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch Billboard data' });
    }
});

// API endpoint to search by artist
app.get('/api/billboard/artist/:artist', async (req, res) => {
    try {
        const data = await fetchBillboardData();
        const artist = req.params.artist.toLowerCase();
        const exactMatch = req.query.exact === 'true';

        let results;
        if (exactMatch) {
            results = data.filter(item => 
                item.performer.toLowerCase() === artist
            );
        } else {
            results = data.filter(item => 
                item.performer.toLowerCase().includes(artist)
            );
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search Billboard data' });
    }
});

// API endpoint to search by album title
app.get('/api/billboard/album/:title', async (req, res) => {
    try {
        const data = await fetchBillboardData();
        const title = req.params.title.toLowerCase();
        const exactMatch = req.query.exact === 'true';

        let results;
        if (exactMatch) {
            results = data.filter(item => 
                item.title.toLowerCase() === title
            );
        } else {
            results = data.filter(item => 
                item.title.toLowerCase().includes(title)
            );
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search Billboard data' });
    }
});

// API endpoint to search by date range
app.get('/api/billboard/date', async (req, res) => {
    try {
        const data = await fetchBillboardData();
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const results = data.filter(item => {
            const chartDate = new Date(item.chart_week);
            return chartDate >= startDate && chartDate <= endDate;
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search Billboard data' });
    }
});

// API endpoint to search by peak position
app.get('/api/billboard/position/:position', async (req, res) => {
    try {
        const data = await fetchBillboardData();
        const position = parseInt(req.params.position, 10);

        if (isNaN(position)) {
            return res.status(400).json({ error: 'Invalid position' });
        }

        const results = data.filter(item => 
            parseInt(item.peak_pos, 10) === position
        );

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search Billboard data' });
    }
});

// Root route to serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Pre-fetch the data on startup
    fetchBillboardData().catch(console.error);
}); 