// Global variables
let chartData = [];
let currentResults = []; // Store current results to allow deduping without re-searching
const dataUrl = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/hot-100-current.csv';
// Alternative data source
const fallbackDataUrl = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/recent.json';
let clipboardSongs = []; // Array to store songs for clipboard

// DOM elements
const searchForm = document.getElementById('searchForm');
const searchTypeSelect = document.getElementById('searchType');
const queryInput = document.getElementById('query');
const queryContainer = document.getElementById('queryContainer');
const dateRangeContainer = document.getElementById('dateRangeContainer');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const exactMatchCheckbox = document.getElementById('exactMatch');
const resetBtn = document.getElementById('resetBtn');
const dedupeBtn = document.getElementById('dedupeBtn');
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
const durationSearch = document.getElementById('duration-search');
const chartWeekInput = document.getElementById('chartWeek');
const chartPositionInput = document.getElementById('chartPosition');
const minWeeksInput = document.getElementById('minWeeks');

// Stats elements
const totalAppearances = document.getElementById('totalAppearances');
const bestPosition = document.getElementById('bestPosition');
const longestRun = document.getElementById('longestRun');
const uniqueEntries = document.getElementById('uniqueEntries');
const topSongsList = document.getElementById('topSongsList');
const firstAppearance = document.getElementById('firstAppearance');
const lastAppearance = document.getElementById('lastAppearance');
const chartTimeline = document.getElementById('chartTimeline');

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
copyClipboardBtn.addEventListener('click', copyAllSongs);

function init() {
    // Event listeners
    searchForm.addEventListener('submit', handleSearch);
    searchTypeSelect.addEventListener('change', toggleSearchFields);
    resetBtn.addEventListener('click', resetForm);
    dedupeBtn.addEventListener('click', dedupeResults);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Set today as the default end date
    const today = new Date().toISOString().split('T')[0];
    endDateInput.value = today;
    
    // Set a default start date (1 month ago)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
    
    // Set min and max dates
    const minDate = "1958-08-04";
    const maxDate = "2023-09-02";
    chartWeekInput.min = minDate;
    chartWeekInput.max = maxDate;
    
    // Default to hidden error messages
    errorMessage.style.display = 'none';
    
    // Load the chart data
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
    durationSearch.style.display = 'none';
    
    // Show relevant search input based on selection
    if (searchType === 'title' || searchType === 'artist') {
        textSearch.style.display = 'block';
    } else if (searchType === 'date') {
        dateSearch.style.display = 'block';
    } else if (searchType === 'position') {
        positionSearch.style.display = 'block';
    } else if (searchType === 'duration') {
        durationSearch.style.display = 'block';
    }
}

async function fetchChartData() {
    try {
        // Try the primary data source first
        const response = await fetch(dataUrl);
        if (!response.ok) {
            console.warn(`Primary data source failed with status: ${response.status}. Trying fallback...`);
            throw new Error(`Network response was not ok: ${response.status}`);
        }
        const csvText = await response.text();
        chartData = parseCSV(csvText);
        return chartData;
    } catch (primaryError) {
        console.error('Error fetching primary chart data:', primaryError);
        
        // Try the fallback data source
        try {
            console.log('Attempting to fetch data from fallback source...');
            showError('Primary data source is currently unavailable. Trying alternative source...');
            
            const fallbackResponse = await fetch(fallbackDataUrl);
            if (!fallbackResponse.ok) {
                throw new Error(`Fallback data source failed: ${fallbackResponse.status}`);
            }
            
            const jsonData = await fallbackResponse.json();
            
            // Convert the JSON format to match our expected CSV format
            chartData = convertJsonToChartFormat(jsonData);
            
            // Clear the error since we succeeded with the fallback
            hideError();
            showError('Using alternative data source. Some features may be limited.');
            setTimeout(() => hideError(), 5000);
            
            return chartData;
        } catch (fallbackError) {
            console.error('Error fetching fallback chart data:', fallbackError);
            throw new Error('Failed to load chart data from both primary and fallback sources.');
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
    if (searchType === 'title' || searchType === 'artist') {
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
        if (!searchTerm || searchTerm < 1 || searchTerm > 100) {
            showError('Please enter a valid chart position (1-100).');
            loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'duration') {
        searchTerm = minWeeksInput.value;
        if (!searchTerm || searchTerm < 1) {
            showError('Please enter a valid number of weeks.');
            loading.style.display = 'none';
            return;
        }
    }
    
    // Search chart data
    let results = [];
    
    if (searchType === 'title') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        results = chartData.filter(entry => searchRegex.test(entry.song));
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
    else if (searchType === 'duration') {
        // Group by song-artist to find entries with minimum weeks
        const songMap = new Map();
        
        chartData.forEach(entry => {
            const key = `${entry.song} - ${entry.artist}`;
            if (!songMap.has(key)) {
                songMap.set(key, []);
            }
            songMap.get(key).push(entry);
        });
        
        // Filter for songs that appeared at least the specified number of weeks
        songMap.forEach((entries, key) => {
            if (entries.length >= parseInt(searchTerm)) {
                // Add all entries for this song
                results = results.concat(entries);
            }
        });
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
        const youtubeSearchQuery = `${encodeURIComponent(entry.song)} ${encodeURIComponent(entry.artist)}`;
        const youtubeUrl = `https://www.youtube.com/results?search_query=${youtubeSearchQuery.replace(/%20/g, "+")}`;
        
        // Create table row
        row.innerHTML = `
            <td>${formatDate(entry.chart_date)}</td>
            <td>${escapeHtml(entry.song)}</td>
            <td>${escapeHtml(entry.artist)}</td>
            <td>${entry.position}</td>
            <td>
                <div class="d-flex">
                    <a href="${youtubeUrl}" target="_blank" class="btn btn-sm btn-danger me-1" title="Search on YouTube">
                        <i class="bi bi-youtube"></i>
                    </a>
                    <button class="btn btn-sm btn-primary add-song-btn" title="Add to clipboard" 
                        data-song="${escapeHtml(entry.song)}" data-artist="${escapeHtml(entry.artist)}">
                        <i class="bi bi-clipboard-plus"></i>
                    </button>
                </div>
            </td>
        `;
        
        resultsBody.appendChild(row);
    });
    
    // Add event listeners to the clipboard buttons
    document.querySelectorAll('.add-song-btn').forEach(button => {
        button.addEventListener('click', () => {
            const songName = button.getAttribute('data-song');
            const artistName = button.getAttribute('data-artist');
            addToClipboard(`${songName} - ${artistName}`);
        });
    });
}

function calculateStatistics(results, searchType) {
    // Only show statistics if there are results
    if (results.length === 0) {
        statsContainer.style.display = 'none';
        return;
    }
    
    statsContainer.style.display = 'block';
    
    // Total appearances
    totalAppearances.textContent = results.length;
    
    // Best position (lowest number is better)
    const bestPos = Math.min(...results.map(item => parseInt(item.position, 10)));
    bestPosition.textContent = bestPos || '-';
    
    // Longest run on chart
    const maxWeeks = Math.max(...results.map(item => parseInt(item.position, 10) || 0));
    longestRun.textContent = maxWeeks || 0;
    
    // Count unique entries (by title-artist combination or just one depending on search type)
    let uniqueItems = new Set();
    
    if (searchType === 'artist') {
        // Count unique songs for this artist
        results.forEach(item => uniqueItems.add(item.song.toLowerCase()));
        uniqueEntries.textContent = uniqueItems.size;
    } else if (searchType === 'song') {
        // For song searches, just count different artists if there are cover versions
        results.forEach(item => uniqueItems.add(item.artist.toLowerCase()));
        uniqueEntries.textContent = uniqueItems.size;
    } else {
        // For other searches, count unique title-performer combinations
        results.forEach(item => uniqueItems.add(`${item.song.toLowerCase()}-${item.artist.toLowerCase()}`));
        uniqueEntries.textContent = uniqueItems.size;
    }
    
    // Display top songs (by weeks on chart or peak position)
    displayTopSongs(results, searchType);
    
    // Display timeline information
    const chartDates = results.map(item => new Date(item.chart_date));
    const firstDate = new Date(Math.min(...chartDates));
    const lastDate = new Date(Math.max(...chartDates));
    
    firstAppearance.textContent = formatDate(firstDate);
    lastAppearance.textContent = formatDate(lastDate);
    
    // Calculate timeline percentage (what percentage of the entire Hot 100 history this spans)
    const hot100Start = new Date('1958-08-04'); // Approximate start of Hot 100
    const today = new Date();
    const totalTimespan = today - hot100Start;
    const resultTimespan = lastDate - firstDate;
    const percentage = Math.min(100, Math.round((resultTimespan / totalTimespan) * 100));
    
    chartTimeline.style.width = `${percentage}%`;
}

function displayTopSongs(results, searchType) {
    topSongsList.innerHTML = '';
    
    let topItems = [];
    
    if (searchType === 'artist') {
        // Group by song title
        const songGroups = {};
        
        results.forEach(item => {
            const title = item.song.toLowerCase();
            if (!songGroups[title]) {
                songGroups[title] = {
                    title: item.song,
                    artist: item.artist,
                    position: parseInt(item.position, 10),
                    weeks: parseInt(item.position, 10) || 0
                };
            } else {
                // Update position if better
                songGroups[title].position = Math.min(songGroups[title].position, parseInt(item.position, 10));
                // Update weeks if higher
                songGroups[title].weeks = Math.max(songGroups[title].weeks, parseInt(item.position, 10) || 0);
            }
        });
        
        topItems = Object.values(songGroups);
        
        // Sort by position
        topItems.sort((a, b) => a.position - b.position);
        
    } else if (searchType === 'song') {
        // For song searches, we might have multiple versions/artists
        const artistGroups = {};
        
        results.forEach(item => {
            const performer = item.artist.toLowerCase();
            if (!artistGroups[performer]) {
                artistGroups[performer] = {
                    title: item.song,
                    artist: item.artist,
                    position: parseInt(item.position, 10),
                    weeks: parseInt(item.position, 10) || 0
                };
            } else {
                // Update position if better
                artistGroups[performer].position = Math.min(artistGroups[performer].position, parseInt(item.position, 10));
                // Update weeks if higher
                artistGroups[performer].weeks = Math.max(artistGroups[performer].weeks, parseInt(item.position, 10) || 0);
            }
        });
        
        topItems = Object.values(artistGroups);
        
        // Sort by position
        topItems.sort((a, b) => a.position - b.position);
        
    } else {
        // For other searches, group by title-performer
        const itemGroups = {};
        
        results.forEach(item => {
            const key = `${item.song.toLowerCase()}-${item.artist.toLowerCase()}`;
            if (!itemGroups[key]) {
                itemGroups[key] = {
                    title: item.song,
                    artist: item.artist,
                    position: parseInt(item.position, 10),
                    weeks: parseInt(item.position, 10) || 0
                };
            } else {
                // Update position if better
                itemGroups[key].position = Math.min(itemGroups[key].position, parseInt(item.position, 10));
                // Update weeks if higher
                itemGroups[key].weeks = Math.max(itemGroups[key].weeks, parseInt(item.position, 10) || 0);
            }
        });
        
        topItems = Object.values(itemGroups);
        
        // Sort by position
        topItems.sort((a, b) => a.position - b.position);
    }
    
    // Display top 5 items
    topItems.slice(0, 5).forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <b>${escapeHtml(item.title)}</b> - ${escapeHtml(item.artist)}
            <br>
            <small>Position: #${item.position} | Weeks on Chart: ${item.weeks}</small>
        `;
        topSongsList.appendChild(listItem);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function resetForm() {
    searchForm.reset();
    toggleSearchFields();
    
    // Reset date inputs
    const today = new Date().toISOString().split('T')[0];
    endDateInput.value = today;
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
    
    // Hide statistics
    statsContainer.style.display = 'none';
    
    // Show recent results
    currentResults = chartData.slice(0, 25);
    displayResults(currentResults);
    resultCount.textContent = '25';
}

function dedupeResults() {
    if (currentResults.length === 0) {
        return; // Nothing to dedupe
    }
    
    // Create a map to hold unique song-artist combinations
    const uniqueMap = new Map();
    
    // Group by song-artist
    currentResults.forEach(item => {
        const key = `${item.song.toLowerCase()}-${item.artist.toLowerCase()}`;
        
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
        } else {
            const existingItem = uniqueMap.get(key);
            
            // Choose the better record based on criteria:
            // 1. Better position (lower number is better)
            // 2. If same position, longer chart run
            const existingPos = parseInt(existingItem.position, 10);
            const currentPos = parseInt(item.position, 10);
            const existingWeeks = parseInt(existingItem.position, 10) || 0;
            const currentWeeks = parseInt(item.position, 10) || 0;
            
            if (currentPos < existingPos || 
                (currentPos === existingPos && currentWeeks > existingWeeks)) {
                uniqueMap.set(key, item);
            }
        }
    });
    
    // Get the deduplicated array and display
    const dedupedResults = Array.from(uniqueMap.values());
    
    // Show deduplicated results
    displayResults(dedupedResults);
    calculateStatistics(dedupedResults, searchTypeSelect.value);
    resultCount.textContent = `${dedupedResults.length} (deduplicated from ${currentResults.length})`;
}

// Clipboard management functions
function addToClipboard(songInfo) {
    // Check if the song is already in the clipboard
    if (!clipboardSongs.includes(songInfo)) {
        clipboardSongs.push(songInfo);
        updateClipboardDisplay();
        
        // Show clipboard if it's the first item
        if (clipboardSongs.length === 1) {
            toggleClipboard(true);
        }
    }
}

function removeFromClipboard(index) {
    clipboardSongs.splice(index, 1);
    updateClipboardDisplay();
}

function clearClipboard() {
    clipboardSongs = [];
    updateClipboardDisplay();
}

function copyAllSongs() {
    if (clipboardSongs.length === 0) {
        return;
    }
    
    const textToCopy = clipboardSongs.join('\n');
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('All songs copied to clipboard!');
        })
        .catch(err => {
            // Fallback for browsers that don't support clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('All songs copied to clipboard!');
        });
}

function updateClipboardDisplay() {
    if (clipboardSongs.length === 0) {
        clipboardContent.innerHTML = '<p>No songs added yet.</p>';
        return;
    }
    
    let html = '';
    clipboardSongs.forEach((song, index) => {
        html += `
        <div class="clipboard-item">
            ${escapeHtml(song)}
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

// Display error messages
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error messages
function hideError() {
    errorMessage.style.display = 'none';
}

// Make clipboard functions globally available
window.addToClipboard = addToClipboard;
window.removeFromClipboard = removeFromClipboard;

// Function to convert JSON data from the alternative source to our expected format
function convertJsonToChartFormat(jsonData) {
    if (!jsonData || !jsonData.songs) {
        return [];
    }
    
    return jsonData.songs.map(song => {
        return {
            'chart_date': jsonData.date || new Date().toISOString().split('T')[0],
            'performer': song.artist || '',
            'song': song.title || '',
            'instance': '1',
            'previous_week_position': song.last_week || '',
            'peak_position': song.peak_position || '',
            'weeks_on_chart': song.weeks_on_chart || '',
            'this_week_position': song.position || '',
        };
    });
} 