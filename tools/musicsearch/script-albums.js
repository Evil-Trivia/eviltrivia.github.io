// Global variables
let chartData = [];
let currentResults = []; // Store current results to allow deduping without re-searching
const dataUrl = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/billboard-200-current.csv';
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

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

// Add event listeners for clipboard
toggleClipboardBtn.addEventListener('click', toggleClipboard);
clearClipboardBtn.addEventListener('click', clearClipboard);
copyClipboardBtn.addEventListener('click', copyAllAlbums);

function init() {
    // Event listeners
    searchForm.addEventListener('submit', handleSearch);
    searchTypeSelect.addEventListener('change', toggleSearchFields);
    
    // Set min and max dates
    const minDate = "1967-01-01";
    const maxDate = "2023-09-02";
    chartWeekInput.min = minDate;
    chartWeekInput.max = maxDate;
    
    // Default to hidden error messages
    errorMessage.style.display = 'none';
    
    // Load chart data
    loading.style.display = 'block';
    fetchChartData()
        .then(() => {
            loading.style.display = 'none';
            console.log('Chart data loaded successfully.');
        })
        .catch(error => {
            loading.style.display = 'none';
            showError('Failed to load chart data. Please try refreshing the page.');
            console.error('Error loading chart data:', error);
        });
}

function toggleSearchFields() {
    const searchType = searchTypeSelect.value;
    
    // Hide all search inputs first
    textSearch.style.display = 'none';
    dateSearch.style.display = 'none';
    positionSearch.style.display = 'none';
    
    // Show relevant search input based on selection
    if (searchType === 'album' || searchType === 'artist') {
        textSearch.style.display = 'block';
    } else if (searchType === 'date') {
        dateSearch.style.display = 'block';
    } else if (searchType === 'position') {
        positionSearch.style.display = 'block';
    }
}

// Display error messages
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error messages
function hideError() {
    errorMessage.style.display = 'none';
}

async function fetchChartData() {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    while (retryCount < maxRetries) {
        try {
            const response = await fetch(dataUrl);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            const csvText = await response.text();
            chartData = parseCSV(csvText);
            return chartData;
        } catch (error) {
            console.error(`Error fetching chart data (attempt ${retryCount + 1}/${maxRetries}):`, error);
            retryCount++;
            
            if (retryCount >= maxRetries) {
                showError('Failed to load chart data after multiple attempts. The data source may be temporarily unavailable. Please try again later.');
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
            showError(`Retrying data load... (${retryCount}/${maxRetries})`);
        }
    }
}

function parseCSV(csvText) {
    // Split by lines and get header
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    
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
        for (let j = 0; j < headers.length; j++) {
            const key = headers[j].trim();
            let value = row[j] || '';
            
            // Clean up quotes
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            
            rowObj[key] = value.trim();
        }
        
        data.push(rowObj);
    }
    
    return data;
}

function handleSearch(event) {
    event.preventDefault();
    
    // Reset UI
    hideError();
    loading.style.display = 'block';
    resultsBody.innerHTML = '';
    statsContainer.style.display = 'none';
    
    const searchType = searchTypeSelect.value;
    let searchTerm = '';
    let isExactMatch = exactMatchCheckbox.checked;
    
    // Get search term based on search type
    if (searchType === 'album' || searchType === 'artist') {
        searchTerm = queryInput.value.trim();
        if (!searchTerm) {
            showError('Please enter a search term.');
            loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'date') {
        searchTerm = chartWeekInput.value;
        if (!searchTerm) {
            showError('Please select a chart week.');
            loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'position') {
        searchTerm = chartPositionInput.value;
        if (!searchTerm || searchTerm < 1 || searchTerm > 200) {
            showError('Please enter a valid chart position (1-200).');
            loading.style.display = 'none';
            return;
        }
    }
    
    // Search chart data
    let results = [];
    
    if (searchType === 'album') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        results = chartData.filter(entry => searchRegex.test(entry.album));
    } 
    else if (searchType === 'artist') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        results = chartData.filter(entry => searchRegex.test(entry.artist));
    } 
    else if (searchType === 'date') {
        results = chartData.filter(entry => entry.chart_date === searchTerm);
    } 
    else if (searchType === 'position') {
        results = chartData.filter(entry => parseInt(entry.position) === parseInt(searchTerm));
    }
    
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
        statsContainer.style.display = 'block';
    }
    
    resultsContainer.style.display = 'block';
    loading.style.display = 'none';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayResults(results) {
    resultsBody.innerHTML = '';
    
    if (results.length === 0) {
        resultCount.textContent = '0';
        resultsBody.innerHTML = '<tr><td colspan="5" class="text-center">No results found</td></tr>';
        return;
    }
    
    resultCount.textContent = results.length;
    
    results.forEach(entry => {
        const row = document.createElement('tr');
        
        // Generate YouTube search URL
        const youtubeSearchQuery = `${encodeURIComponent(entry.album)} ${encodeURIComponent(entry.artist)}`;
        const youtubeUrl = `https://www.youtube.com/results?search_query=${youtubeSearchQuery.replace(/%20/g, "+")}`;
        
        // Create table row
        row.innerHTML = `
            <td>${formatDate(entry.chart_date)}</td>
            <td>${escapeHtml(entry.album)}</td>
            <td>${escapeHtml(entry.artist)}</td>
            <td>${entry.position}</td>
            <td>
                <div class="d-flex">
                    <a href="${youtubeUrl}" target="_blank" class="btn btn-sm btn-danger me-1" title="Search on YouTube">
                        <i class="bi bi-youtube"></i>
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
    totalOccurrences.textContent = total;
    
    // Count unique albums
    const uniqueAlbumSet = new Set();
    results.forEach(entry => {
        uniqueAlbumSet.add(`${entry.album} - ${entry.artist}`);
    });
    uniqueAlbums.textContent = uniqueAlbumSet.size;
    
    // Calculate average position
    const totalPosition = results.reduce((sum, entry) => sum + parseInt(entry.position), 0);
    avgPosition.textContent = (totalPosition / total).toFixed(1);
    
    // Count number of #1s
    const numberOnes = results.filter(entry => entry.position === '1').length;
    numberOne.textContent = numberOnes;
}

// Format date from YYYY-MM-DD to MM/DD/YYYY
function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
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
    const isCollapsed = clipboardContainer.classList.contains('collapsed');
    
    if (show === true || isCollapsed) {
        clipboardContainer.classList.remove('collapsed');
        toggleClipboardBtn.innerHTML = '▲';
        toggleClipboardBtn.setAttribute('aria-label', 'Collapse clipboard');
        toggleClipboardBtn.title = 'Hide clipboard';
    } else {
        clipboardContainer.classList.add('collapsed');
        toggleClipboardBtn.innerHTML = '▼';
        toggleClipboardBtn.setAttribute('aria-label', 'Expand clipboard');
        toggleClipboardBtn.title = 'Show clipboard';
    }
}

// Make clipboard functions globally available
window.addToClipboard = addToClipboard;
window.removeFromClipboard = removeFromClipboard; 