// Global variables
let chartData = [];
let currentResults = []; // Store current results to allow deduping without re-searching
const dataUrl = 'https://raw.githubusercontent.com/utdata/rwd-billboard-data/main/data-out/hot-100-current.csv';
// Alternative data source - different format
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
const totalOccurrences = document.getElementById('totalOccurrences');
const uniqueSongs = document.getElementById('uniqueSongs');
const avgPosition = document.getElementById('avgPosition');
const numberOne = document.getElementById('numberOne');
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
if (toggleClipboardBtn) toggleClipboardBtn.addEventListener('click', toggleClipboard);
if (clearClipboardBtn) clearClipboardBtn.addEventListener('click', clearClipboard);
if (copyClipboardBtn) copyClipboardBtn.addEventListener('click', copyAllSongs);

function init() {
    // Event listeners - only add if the elements exist
    if (searchForm) searchForm.addEventListener('submit', handleSearch);
    if (searchTypeSelect) searchTypeSelect.addEventListener('change', toggleSearchFields);
    if (resetBtn) resetBtn.addEventListener('click', resetForm);
    if (dedupeBtn) dedupeBtn.addEventListener('click', dedupeResults);
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Set today as the default end date
    const today = new Date().toISOString().split('T')[0];
    if (endDateInput) endDateInput.value = today;
    
    // Set a default start date (1 month ago)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    if (startDateInput) startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
    
    // Set min and max dates
    const minDate = "1958-08-04";
    const maxDate = "2023-09-02";
    if (chartWeekInput) {
        chartWeekInput.min = minDate;
        chartWeekInput.max = maxDate;
    }
    
    // Default to hidden error messages
    if (errorMessage) errorMessage.style.display = 'none';
    
    // Load the chart data
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
    if (!searchTypeSelect) return;
    
    const searchType = searchTypeSelect.value;
    console.log('Changing search type to:', searchType);
    
    // Hide all search inputs first
    if (textSearch) textSearch.style.display = 'none';
    if (dateSearch) dateSearch.style.display = 'none';
    if (positionSearch) positionSearch.style.display = 'none';
    if (durationSearch) durationSearch.style.display = 'none';
    
    // Show relevant search input based on selection
    if (searchType === 'title' || searchType === 'artist') {
        if (textSearch) textSearch.style.display = 'block';
    } else if (searchType === 'date') {
        if (dateSearch) dateSearch.style.display = 'block';
    } else if (searchType === 'position') {
        if (positionSearch) positionSearch.style.display = 'block';
    } else if (searchType === 'duration') {
        if (durationSearch) durationSearch.style.display = 'block';
    }
}

// Add debugging function
function debug(message, data) {
    console.log(`[DEBUG] ${message}`, data || '');
}

async function fetchChartData() {
    try {
        console.log('Fetching chart data from primary source...');
        debug('Starting chart data fetch');
        
        // Try the primary data source first
        const response = await fetch(dataUrl);
        if (!response.ok) {
            console.warn(`Primary data source failed with status: ${response.status}. Trying fallback...`);
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
            throw new Error('Failed to load chart data from both primary and fallback sources.');
        }
    }
}

function parseCSV(csvText) {
    // Split by lines and get header
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        console.error('CSV has insufficient lines');
        return [];
    }
    
    const headers = lines[0].split(',');
    console.log('CSV Headers:', headers);
    
    // Define column name mappings to handle different column names in source data
    const columnMap = {
        'week_id': 'chart_date',
        'week': 'chart_date',
        'chart_date': 'chart_date',
        'date': 'chart_date',
        
        'song': 'song',
        'title': 'song',
        'track': 'song',
        'name': 'song',
        
        'performer': 'artist',
        'artist': 'artist',
        'act': 'artist',
        
        'position': 'position',
        'rank': 'position',
        'this_week': 'position',
        'this_week_position': 'position',
        'chart_position': 'position',
        
        'last_week': 'previous_week_position',
        'last_week_position': 'previous_week_position',
        'previous_week': 'previous_week_position',
        'previous_week_position': 'previous_week_position',
        
        'weeks_on_chart': 'weeks_on_chart',
        'weeks': 'weeks_on_chart'
    };
    
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
        if (!rowObj.song) rowObj.song = '';
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
    if (searchType === 'title' || searchType === 'artist') {
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
        if (!searchTerm || searchTerm < 1 || searchTerm > 100) {
            showError('Please enter a valid chart position (1-100).');
            if (loading) loading.style.display = 'none';
            return;
        }
    } else if (searchType === 'duration') {
        searchTerm = minWeeksInput.value;
        if (!searchTerm || searchTerm < 1) {
            showError('Please enter a valid number of weeks.');
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
    
    if (searchType === 'title') {
        const searchRegex = isExactMatch 
            ? new RegExp(`^${escapeRegExp(searchTerm)}$`, 'i') 
            : new RegExp(escapeRegExp(searchTerm), 'i');
        
        debug('Using title regex', searchRegex);
        results = chartData.filter(entry => {
            const match = searchRegex.test(entry.song);
            if (match && results.length < 5) {
                debug('Title match found', entry);
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
    else if (searchType === 'duration') {
        // Group by song-artist to find entries with minimum weeks
        debug('Searching for duration', searchTerm);
        const songMap = new Map();
        
        chartData.forEach(entry => {
            const key = `${entry.song} - ${entry.artist}`;
            if (!songMap.has(key)) {
                songMap.set(key, []);
            }
            songMap.get(key).push(entry);
        });
        
        debug('Song groups created', { mapSize: songMap.size });
        
        // Filter for songs that appeared at least the specified number of weeks
        songMap.forEach((entries, key) => {
            if (entries.length >= parseInt(searchTerm)) {
                // Add all entries for this song
                results = results.concat(entries);
                debug(`Duration match found: ${key}`, { 
                    weeks: entries.length,
                    firstEntry: entries[0]
                });
            }
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
        if (statsContainer) statsContainer.style.display = 'none';
        return;
    }
    
    if (statsContainer) statsContainer.style.display = 'block';
    
    // Total occurrences
    if (totalOccurrences) totalOccurrences.textContent = results.length;
    
    // Count unique songs
    const uniqueSet = new Set();
    results.forEach(item => {
        uniqueSet.add(`${item.song.toLowerCase()}-${item.artist.toLowerCase()}`);
    });
    if (uniqueSongs) uniqueSongs.textContent = uniqueSet.size;
    
    // Calculate average position
    const totalPos = results.reduce((sum, entry) => sum + parseInt(entry.position, 10), 0);
    const average = (totalPos / results.length).toFixed(1);
    if (avgPosition) avgPosition.textContent = average;
    
    // Count number of #1s
    const numberOnes = results.filter(entry => entry.position === '1').length;
    if (numberOne) numberOne.textContent = numberOnes;
    
    // If we have top songs list element, display it
    if (topSongsList) {
        displayTopSongs(results, searchType);
    }
    
    // Display timeline information if the elements exist
    if (firstAppearance || lastAppearance || chartTimeline) {
        try {
            const chartDates = results.map(item => new Date(item.chart_date));
            const firstDate = new Date(Math.min(...chartDates));
            const lastDate = new Date(Math.max(...chartDates));
            
            if (firstAppearance) firstAppearance.textContent = formatDate(firstDate);
            if (lastAppearance) lastAppearance.textContent = formatDate(lastDate);
            
            // Calculate timeline percentage (what percentage of the entire Hot 100 history this spans)
            const hot100Start = new Date('1958-08-04'); // Approximate start of Hot 100
            const today = new Date();
            const totalTimespan = today - hot100Start;
            const resultTimespan = lastDate - firstDate;
            const percentage = Math.min(100, Math.round((resultTimespan / totalTimespan) * 100));
            
            if (chartTimeline) chartTimeline.style.width = `${percentage}%`;
        } catch (e) {
            console.error('Error calculating timeline stats:', e);
        }
    }
}

function displayTopSongs(results, searchType) {
    if (!topSongsList) return;
    
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
                    weeks: parseInt(item.weeks_on_chart, 10) || 0
                };
            } else {
                // Update position if better
                songGroups[title].position = Math.min(songGroups[title].position, parseInt(item.position, 10));
                // Update weeks if higher
                songGroups[title].weeks = Math.max(songGroups[title].weeks, parseInt(item.weeks_on_chart, 10) || 0);
            }
        });
        
        topItems = Object.values(songGroups);
        
        // Sort by position
        topItems.sort((a, b) => a.position - b.position);
        
    } else if (searchType === 'title') {
        // For song searches, we might have multiple versions/artists
        const artistGroups = {};
        
        results.forEach(item => {
            const performer = item.artist.toLowerCase();
            if (!artistGroups[performer]) {
                artistGroups[performer] = {
                    title: item.song,
                    artist: item.artist,
                    position: parseInt(item.position, 10),
                    weeks: parseInt(item.weeks_on_chart, 10) || 0
                };
            } else {
                // Update position if better
                artistGroups[performer].position = Math.min(artistGroups[performer].position, parseInt(item.position, 10));
                // Update weeks if higher
                artistGroups[performer].weeks = Math.max(artistGroups[performer].weeks, parseInt(item.weeks_on_chart, 10) || 0);
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
                    weeks: parseInt(item.weeks_on_chart, 10) || 0
                };
            } else {
                // Update position if better
                itemGroups[key].position = Math.min(itemGroups[key].position, parseInt(item.position, 10));
                // Update weeks if higher
                itemGroups[key].weeks = Math.max(itemGroups[key].weeks, parseInt(item.weeks_on_chart, 10) || 0);
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
    
    // Show deduplicated results
    displayResults(dedupedResults);
    calculateStatistics(dedupedResults, searchTypeSelect.value);
    if (resultCount) resultCount.textContent = `${dedupedResults.length} (deduplicated from ${currentResults.length})`;
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
    if (!jsonData) {
        return [];
    }
    
    // Log the structure to debug
    console.log('JSON Data structure:', Object.keys(jsonData));
    
    // Handle the mhollingshead format
    if (jsonData.date && jsonData.songs) {
        console.log('Using mhollingshead format');
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
    
    // Error fallback - create minimal dataset if format is unknown
    console.log('Unknown JSON format, creating minimal dataset');
    return [];
} 