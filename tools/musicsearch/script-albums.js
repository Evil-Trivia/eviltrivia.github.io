// Global variables
let chartData = [];
let currentResults = []; // Store current results to allow deduping without re-searching
const dataUrl = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/billboard-200-current.csv';
// Alternative data source
const fallbackDataUrl = 'https://raw.githubusercontent.com/KoreanThinker/billboard-json/main/billboard-200/recent.json';
let clipboardAlbums = []; // Array to store albums for clipboard

// DOM elements
const searchForm = document.getElementById('searchForm');
const searchTypeSelect = document.getElementById('searchType');
const queryInput = document.getElementById('query');
const exactMatchCheckbox = document.getElementById('exactMatch');
const loading = document.getElementById('loading');
const resultsBody = document.getElementById('resultsBody');
const resultCount = document.getElementById('resultCount');
const statsContainer = document.getElementById('statsContainer');
const resultsContainer = document.getElementById('resultsContainer');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Text search inputs
const textSearch = document.getElementById('text-search');
const dateSearch = document.getElementById('date-search');
const positionSearch = document.getElementById('position-search');
const chartWeekInput = document.getElementById('chartWeek');
const chartPositionInput = document.getElementById('chartPosition');

// Stats elements
const totalOccurrences = document.getElementById('totalOccurrences');
const uniqueAlbums = document.getElementById('uniqueAlbums');
const avgPosition = document.getElementById('avgPosition');
const numberOne = document.getElementById('numberOne');

// Clipboard elements
const clipboardContainer = document.getElementById('clipboard-container');
const clipboardContent = document.getElementById('clipboard-content');
const toggleClipboardBtn = document.getElementById('toggle-clipboard');
const clearClipboardBtn = document.getElementById('clear-clipboard');
const copyClipboardBtn = document.getElementById('copy-clipboard');

// Initialize once DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get element references
    resultsContainer = document.getElementById('resultsContainer');
    resultsBody = document.getElementById('resultsBody');
    loading = document.getElementById('loading');
    searchForm = document.getElementById('searchForm');
    searchTypeSelect = document.getElementById('searchType');
    queryInput = document.getElementById('query');
    chartWeekInput = document.getElementById('chartWeek');
    chartPositionInput = document.getElementById('chartPosition');
    minWeeksInput = document.getElementById('minWeeks');
    exactMatchCheckbox = document.getElementById('exactMatch');
    resultCount = document.getElementById('resultCount');
    errorContainer = document.getElementById('errorContainer');
    errorMessage = document.getElementById('errorMessage');
    errorText = document.getElementById('errorText');
    clipboardContainer = document.getElementById('clipboard-container');
    clipboardContent = document.getElementById('clipboard-content');
    toggleClipboardBtn = document.getElementById('toggle-clipboard');
    clearClipboardBtn = document.getElementById('clear-clipboard');
    copyClipboardBtn = document.getElementById('copy-clipboard');
    resetBtn = document.getElementById('resetBtn');
    dedupeBtn = document.getElementById('dedupeBtn');
    statsContainer = document.getElementById('statsContainer');
    statsBody = document.getElementById('statsBody');
    
    // Call init to set up event handlers
    init();
    
    // Load data
    fetchChartData();
    
    // Initialize from localStorage
    loadClipboardFromStorage();
});

// Add event listeners for clipboard
if (toggleClipboardBtn) toggleClipboardBtn.addEventListener('click', toggleClipboard);
if (clearClipboardBtn) clearClipboardBtn.addEventListener('click', clearClipboard);
if (copyClipboardBtn) copyClipboardBtn.addEventListener('click', copyAllAlbums);

function init() {
    // Event listeners
    if (searchForm) searchForm.addEventListener('submit', handleSearch);
    if (searchTypeSelect) searchTypeSelect.addEventListener('change', toggleSearchFields);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    if (dedupeBtn) dedupeBtn.addEventListener('click', dedupeResults);
    
    // Set min and max dates
    const minDate = "1967-01-01";
    const maxDate = "2023-09-02";
    if (chartWeekInput) {
        chartWeekInput.min = minDate;
        chartWeekInput.max = maxDate;
    }
    
    // Default to hidden error messages
    if (errorMessage) errorMessage.style.display = 'none';
    
    // Load chart data
    if (loading) loading.style.display = 'block';
    fetchChartData()
        .then(() => {
            if (loading) loading.style.display = 'none';
            console.log('Chart data loaded successfully.');
        })
        .catch(error => {
            if (loading) loading.style.display = 'none';
            showError('Failed to load chart data. Please try refreshing the page.');
            console.error('Error loading chart data:', error);
        });
}

function toggleSearchFields() {
    const searchType = searchTypeSelect.value;
    
    // Hide all search inputs first
    if (textSearch) textSearch.style.display = 'none';
    if (dateSearch) dateSearch.style.display = 'none';
    if (positionSearch) positionSearch.style.display = 'none';
    
    // Show relevant search input based on selection
    if (searchType === 'album' || searchType === 'artist') {
        if (textSearch) textSearch.style.display = 'block';
    } else if (searchType === 'date') {
        if (dateSearch) dateSearch.style.display = 'block';
    } else if (searchType === 'position') {
        if (positionSearch) positionSearch.style.display = 'block';
    }
}

// Display error messages
function showError(message) {
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.style.display = 'block';
}

// Hide error messages
function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}

// Add debugging function
function debug(message, data) {
    console.log(`[DEBUG] ${message}`, data || '');
}

async function fetchChartData() {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    debug('Starting chart data fetch');
    
    while (retryCount < maxRetries) {
        try {
            console.log(`Fetching chart data (attempt ${retryCount + 1}/${maxRetries})...`);
            const response = await fetch(dataUrl);
            
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            
            const csvText = await response.text();
            console.log(`CSV data fetched, size: ${csvText.length} bytes`);
            
            if (!csvText || csvText.length < 100) {
                console.error('CSV data appears to be empty or too small');
                throw new Error('CSV data appears to be empty or corrupted');
            }
            
            chartData = parseCSV(csvText);
            console.log(`Parsed ${chartData.length} records from CSV`);
            
            if (chartData.length === 0) {
                throw new Error('No chart data parsed from CSV');
            }
            
            // Log some sample records for debugging
            if (chartData.length > 0) {
                debug('Sample record', chartData[0]);
            }
            
            return chartData;
        } catch (error) {
            console.error(`Error fetching chart data (attempt ${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            
            if (retryCount >= maxRetries) {
                console.log('Attempting to fetch data from fallback source...');
                showError('Primary data source is currently unavailable. Trying alternative source...');
                
                try {
                    const fallbackResponse = await fetch(fallbackDataUrl);
                    if (!fallbackResponse.ok) {
                        throw new Error(`Fallback data source failed: ${fallbackResponse.status}`);
                    }
                    
                    const jsonData = await fallbackResponse.json();
                    console.log(`Fallback JSON data fetched, size: ${JSON.stringify(jsonData).length} bytes`);
                    
                    // Convert the JSON format to match our expected CSV format
                    chartData = convertJsonToChartFormat(jsonData);
                    console.log(`Converted ${chartData.length} records from JSON`);
                    
                    if (chartData.length === 0) {
                        throw new Error('No chart data converted from JSON');
                    }
                    
                    // Log some sample records for debugging
                    if (chartData.length > 0) {
                        debug('Sample record from fallback', chartData[0]);
                    }
                    
                    // Clear the error since we succeeded with the fallback
                    hideError();
                    showError('Using alternative data source. Some features may be limited.');
                    setTimeout(() => hideError(), 5000);
                    
                    return chartData;
                } catch (fallbackError) {
                    console.error('Error fetching fallback chart data:', fallbackError);
                    showError('Failed to load chart data after multiple attempts. The data source may be temporarily unavailable. Please try again later.');
                    throw new Error('Failed to load chart data from both primary and fallback sources.');
                }
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
            showError(`Retrying data load... (${retryCount}/${maxRetries})`);
        }
    }
}

// Define column name mappings to handle different column names in source data
const columnMap = {
    'chart_week': 'chart_date',
    'chart_date': 'chart_date',
    'week_id': 'chart_date',
    'week': 'chart_date',
    'date': 'chart_date',
    
    'title': 'album',
    'album': 'album',
    'name': 'album',
    
    'performer': 'artist',
    'artist': 'artist',
    'act': 'artist',
    
    'current_week': 'position',
    'position': 'position',
    'rank': 'position',
    'this_week': 'position',
    'this_week_position': 'position',
    'chart_position': 'position',
    
    'last_week': 'previous_week_position',
    'last_week_position': 'previous_week_position',
    'previous_week': 'previous_week_position',
    'previous_week_position': 'previous_week_position',
    
    'wks_on_chart': 'weeks_on_chart',
    'weeks_on_chart': 'weeks_on_chart',
    'weeks': 'weeks_on_chart'
};

function parseCSV(csvText) {
    // Split by lines and get header
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        console.error('CSV has insufficient lines');
        return [];
    }
    
    const headers = lines[0].split(',');
    console.log('CSV Headers:', headers);
    
    // Map headers to standardized field names
    const standardHeaders = headers.map(header => {
        const cleanHeader = header.trim().toLowerCase();
        return columnMap[cleanHeader] || cleanHeader;
    });
    
    console.log('Mapped headers:', standardHeaders);
    
    const data = [];
    
    // Process each line
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        // Handle commas within quotes
        let row = [];
        let inQuotes = false;
        let currentValue = '';
        
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        row.push(currentValue); // Add the last value
        
        // Create object with header keys
        const rowObj = {};
        for (let j = 0; j < standardHeaders.length; j++) {
            const key = standardHeaders[j];
            let value = (j < row.length) ? row[j] || '' : '';
            
            // Clean up quotes
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            
            rowObj[key] = value.trim();
        }
        
        // Ensure required fields exist
        if (!rowObj.album) rowObj.album = '';
        if (!rowObj.artist) rowObj.artist = '';
        if (!rowObj.position) rowObj.position = '';
        if (!rowObj.chart_date) rowObj.chart_date = '';
        
        data.push(rowObj);
    }
    
    return data;
}

function handleSearch(event) {
    event.preventDefault();
    
    // Reset UI
    hideError();
    if (loading) loading.style.display = 'block';
    if (resultsBody) resultsBody.innerHTML = '';
    if (statsContainer) statsContainer.style.display = 'none';
    
    const searchType = searchTypeSelect.value;
    let searchTerm = '';
    let isExactMatch = exactMatchCheckbox.checked;
    
    // Get search term based on search type
    if (searchType === 'album' || searchType === 'artist') {
        searchTerm = queryInput.value.trim();
        if (!searchTerm) {
            showError('Please enter a search term.');
            if (loading) loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'date') {
        searchTerm = chartWeekInput.value;
        if (!searchTerm) {
            showError('Please select a chart week.');
            if (loading) loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'position') {
        searchTerm = chartPositionInput.value;
        if (!searchTerm || searchTerm < 1 || searchTerm > 200) {
            showError('Please enter a valid chart position (1-200).');
            if (loading) loading.style.display = 'none';
            return;
        }
    }
    
    // Log data state for debugging
    debug(`Searching for "${searchTerm}" in ${searchType}`, {
        dataLength: chartData.length,
        exactMatch: isExactMatch
    });
    
    // Search chart data
    let results = [];
    
    if (searchType === 'album') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        debug('Using album regex', searchRegex);
        results = chartData.filter(entry => {
            const match = searchRegex.test(entry.album);
            if (match && results.length < 5) {
                debug('Album match found', entry);
            }
            return match;
        });
    } 
    else if (searchType === 'artist') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        debug('Using artist regex', searchRegex);
        results = chartData.filter(entry => {
            const match = searchRegex.test(entry.artist);
            if (match && results.length < 5) {
                debug('Artist match found', entry);
            }
            return match;
        });
    } 
    else if (searchType === 'date') {
        debug('Searching for date', searchTerm);
        results = chartData.filter(entry => {
            const match = entry.chart_date === searchTerm;
            if (match && results.length < 5) {
                debug('Date match found', entry);
            }
            return match;
        });
    } 
    else if (searchType === 'position') {
        const searchPosition = parseInt(searchTerm);
        debug('Searching for position', searchPosition);
        results = chartData.filter(entry => {
            const match = parseInt(entry.position) === searchPosition;
            if (match && results.length < 5) {
                debug('Position match found', entry);
            }
            return match;
        });
    }
    
    // Log results for debugging
    debug(`Found ${results.length} results`, { 
        firstFew: results.slice(0, 3) 
    });
    
    // Sort results by chart date and position
    results.sort((a, b) => {
        if (a.chart_date === b.chart_date) {
            return parseInt(a.position) - parseInt(b.position);
        }
        return a.chart_date.localeCompare(b.chart_date);
    });
    
    // Store for potential further operations
    currentResults = results;
    
    // Display results
    displayResults(results);
    
    // Update statistics
    if (results.length > 0) {
        calculateStatistics(results, searchType);
        if (statsContainer) statsContainer.style.display = 'block';
    }
    
    if (resultsContainer) resultsContainer.style.display = 'block';
    if (loading) loading.style.display = 'none';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayResults(results) {
    if (!resultsBody) return;
    resultsBody.innerHTML = '';
    
    if (results.length === 0) {
        if (resultCount) resultCount.textContent = '0';
        resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">No results found</td></tr>';
        return;
    }
    
    if (resultCount) resultCount.textContent = results.length;
    
    results.forEach(entry => {
        const row = document.createElement('tr');
        
        // Generate search URLs
        const spotifySearchQuery = `${encodeURIComponent(entry.album)} ${encodeURIComponent(entry.artist)}`;
        const spotifyUrl = `https://open.spotify.com/search/${spotifySearchQuery.replace(/%20/g, "+")}`;
        
        // Format the date properly
        const formattedDate = formatDate(entry.chart_date);
        
        // Create table row
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${escapeHtml(entry.album)}</td>
            <td>${escapeHtml(entry.artist)}</td>
            <td>${entry.position}</td>
            <td>
                <div class="d-flex">
                    <a href="${spotifyUrl}" target="_blank" class="btn btn-sm btn-success me-1" title="Search on Spotify">
                        <i class="bi bi-spotify"></i>
                    </a>
                    <button class="btn btn-sm btn-primary add-album-btn" title="Add to clipboard" 
                        data-album="${escapeHtml(entry.album)}" data-artist="${escapeHtml(entry.artist)}">
                        <i class="bi bi-clipboard-plus"></i>
                    </button>
                </div>
            </td>
        `;
        
        resultsBody.appendChild(row);
    });
    
    // Add event listeners to the clipboard buttons
    document.querySelectorAll('.add-album-btn').forEach(button => {
        button.addEventListener('click', () => {
            const albumName = button.getAttribute('data-album');
            const artistName = button.getAttribute('data-artist');
            addToClipboard(`${albumName} - ${artistName}`);
        });
    });
}

function calculateStatistics(results, searchType) {
    // Calculate basic statistics
    const total = results.length;
    if (totalOccurrences) totalOccurrences.textContent = total;
    
    // Count unique albums
    const uniqueAlbumSet = new Set();
    results.forEach(entry => {
        uniqueAlbumSet.add(`${entry.album} - ${entry.artist}`);
    });
    if (uniqueAlbums) uniqueAlbums.textContent = uniqueAlbumSet.size;
    
    // Calculate average position
    const totalPosition = results.reduce((sum, entry) => sum + parseInt(entry.position), 0);
    if (avgPosition) avgPosition.textContent = (totalPosition / total).toFixed(1);
    
    // Count number of #1s
    const numberOnes = results.filter(entry => entry.position === '1').length;
    if (numberOne) numberOne.textContent = numberOnes;
}

function formatDate(dateString) {
    if (!dateString) return '';
    
    try {
        // Check if it's already in a readable format
        if (dateString.includes('/')) return dateString;
        
        // Assume YYYY-MM-DD format
        const parts = dateString.split('-');
        if (parts.length !== 3) return dateString;
        
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June', 
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Format as "Month DD, YYYY"
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const year = parts[0];
        
        if (isNaN(month) || month < 1 || month > 12) return dateString;
        
        return `${months[month-1]} ${day}, ${year}`;
    } catch (e) {
        console.error('Error formatting date:', e);
        return dateString; // Return original if there's any error
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Clipboard management functions
function addToClipboard(albumInfo) {
    // Check if the album is already in the clipboard
    if (!clipboardAlbums.includes(albumInfo)) {
        clipboardAlbums.push(albumInfo);
        updateClipboardDisplay();
        
        // Show clipboard if it's the first item
        if (clipboardAlbums.length === 1) {
            toggleClipboard(true);
        }
    }
}

function removeFromClipboard(index) {
    clipboardAlbums.splice(index, 1);
    updateClipboardDisplay();
}

function clearClipboard() {
    clipboardAlbums = [];
    updateClipboardDisplay();
}

function copyAllAlbums() {
    if (clipboardAlbums.length === 0) {
        return;
    }
    
    const textToCopy = clipboardAlbums.join('\n');
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('All albums copied to clipboard!');
        })
        .catch(err => {
            // Fallback for browsers that don't support clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('All albums copied to clipboard!');
        });
}

function updateClipboardDisplay() {
    if (!clipboardContent) return;
    
    if (clipboardAlbums.length === 0) {
        clipboardContent.innerHTML = '<p>No albums added yet.</p>';
        return;
    }
    
    let html = '';
    clipboardAlbums.forEach((album, index) => {
        html += `
        <div class="clipboard-item">
            ${escapeHtml(album)}
            <span class="remove-item" onclick="removeFromClipboard(${index})">×</span>
        </div>
        `;
    });
    
    clipboardContent.innerHTML = html;
}

function toggleClipboard(show) {
    if (!clipboardContainer) return;
    
    const isCollapsed = clipboardContainer.classList.contains('collapsed');
    
    if (show === true || isCollapsed) {
        clipboardContainer.classList.remove('collapsed');
        if (toggleClipboardBtn) {
            toggleClipboardBtn.innerHTML = '▲';
            toggleClipboardBtn.setAttribute('aria-label', 'Collapse clipboard');
            toggleClipboardBtn.title = 'Hide clipboard';
        }
    } else {
        clipboardContainer.classList.add('collapsed');
        if (toggleClipboardBtn) {
            toggleClipboardBtn.innerHTML = '▼';
            toggleClipboardBtn.setAttribute('aria-label', 'Expand clipboard');
            toggleClipboardBtn.title = 'Show clipboard';
        }
    }
}

// Make clipboard functions globally available
window.addToClipboard = addToClipboard;
window.removeFromClipboard = removeFromClipboard;

// Function to convert JSON data from the alternative source to our expected format
function convertJsonToChartFormat(jsonData) {
    if (!jsonData) {
        return [];
    }
    
    // Log the structure to debug
    console.log('JSON Data structure:', Object.keys(jsonData));
    
    // Handle KoreanThinker/billboard-json format
    if (jsonData.date && jsonData.data) {
        console.log('Using KoreanThinker format');
        return jsonData.data.map(item => {
            return {
                'chart_date': jsonData.date || new Date().toISOString().split('T')[0],
                'album': item.name || '',
                'performer': item.artist || '',
                'this_week_position': item.rank || '',
                'previous_week_position': item.last_week_rank || '',
                'peak_position': item.peak_rank || '',
                'weeks_on_chart': item.weeks_on_chart || '',
                'instance': '1'
            };
        });
    }
    
    // Error fallback - create minimal dataset if format is unknown
    console.log('Unknown JSON format, creating minimal dataset');
    return [];
}

// Add resetForm function
function resetForm() {
    console.log('Resetting form');
    if (searchForm) searchForm.reset();
    toggleSearchFields();
    
    // Hide statistics
    if (statsContainer) statsContainer.style.display = 'none';
    
    // Clear results
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (resultsBody) resultsBody.innerHTML = '';
    if (resultCount) resultCount.textContent = '0';
}

function dedupeResults() {
    console.log('Deduping results');
    if (!currentResults || currentResults.length === 0) {
        showError('No results to deduplicate');
        return; // Nothing to dedupe
    }
    
    debug(`Starting deduplication of ${currentResults.length} results`);
    
    // Create a map to hold unique album-artist combinations
    const uniqueMap = new Map();
    
    // Group by album-artist
    currentResults.forEach(item => {
        if (!item.album || !item.artist) {
            debug('Skipping item with missing album or artist', item);
            return;
        }
        
        const key = `${item.album.toLowerCase()}-${item.artist.toLowerCase()}`;
        
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        } else {
            const existingItem = uniqueMap.get(key);
            
            // Choose the better record based on criteria:
            // 1. Better position (lower number is better)
            // 2. If same position, longer chart run
            const existingPos = parseInt(existingItem.position, 10);
            const currentPos = parseInt(item.position, 10);
            const existingWeeks = parseInt(existingItem.weeks_on_chart, 10) || 0;
            const currentWeeks = parseInt(item.weeks_on_chart, 10) || 0;
            
            if (currentPos < existingPos || 
                (currentPos === existingPos && currentWeeks > existingWeeks)) {
                uniqueMap.set(key, item);
            }
        }
    });
    
    // Get the deduplicated array and display
    const dedupedResults = Array.from(uniqueMap.values());
    debug(`Deduplicated to ${dedupedResults.length} results`);
    
    // Show deduplicated results
    displayResults(dedupedResults);
    calculateStatistics(dedupedResults, searchTypeSelect.value);
    if (resultCount) resultCount.textContent = `${dedupedResults.length} (deduplicated from ${currentResults.length})`;
} 