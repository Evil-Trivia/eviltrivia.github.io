// Global variables
let chartData = [];

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
const loading = document.getElementById('loading');
const resultsBody = document.getElementById('resultsBody');
const resultCount = document.getElementById('resultCount');
const statsContainer = document.getElementById('statsContainer');

// Stats elements
const totalAppearances = document.getElementById('totalAppearances');
const bestPosition = document.getElementById('bestPosition');
const longestRun = document.getElementById('longestRun');
const uniqueEntries = document.getElementById('uniqueEntries');
const topAlbumsList = document.getElementById('topAlbumsList');
const firstAppearance = document.getElementById('firstAppearance');
const lastAppearance = document.getElementById('lastAppearance');
const chartTimeline = document.getElementById('chartTimeline');

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Event listeners
    searchForm.addEventListener('submit', handleSearch);
    searchTypeSelect.addEventListener('change', toggleSearchFields);
    resetBtn.addEventListener('click', resetForm);
    
    // Set today as the default end date
    const today = new Date().toISOString().split('T')[0];
    endDateInput.value = today;
    
    // Set a default start date (1 month ago)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    startDateInput.value = oneMonthAgo.toISOString().split('T')[0];
    
    // Load initial data
    fetchRecentChartData();
}

function toggleSearchFields() {
    if (searchTypeSelect.value === 'date') {
        queryContainer.style.display = 'none';
        dateRangeContainer.style.display = 'block';
    } else {
        queryContainer.style.display = 'block';
        dateRangeContainer.style.display = 'none';
    }
    
    // Show/hide exact match option based on search type
    if (searchTypeSelect.value === 'position') {
        document.querySelector('.form-check').style.display = 'none';
    } else {
        document.querySelector('.form-check').style.display = 'block';
    }
}

async function fetchRecentChartData() {
    try {
        loading.style.display = 'block';
        
        // Get the last month of data using the date API endpoint
        const today = new Date();
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const endDate = today.toISOString().split('T')[0];
        const startDate = oneMonthAgo.toISOString().split('T')[0];
        
        const response = await fetch(`/api/billboard/date?start=${startDate}&end=${endDate}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        loading.style.display = 'none';
        
        // Display recent results
        displayResults(data);
        resultCount.textContent = data.length;
        
    } catch (error) {
        console.error('Error fetching recent chart data:', error);
        loading.style.display = 'none';
        alert(`Error loading chart data: ${error.message}`);
    }
}

async function handleSearch(event) {
    event.preventDefault();
    
    const searchType = searchTypeSelect.value;
    const query = queryInput.value.trim();
    const exactMatch = exactMatchCheckbox.checked;
    
    loading.style.display = 'block';
    
    try {
        let response;
        let endpoint = '';
        
        switch (searchType) {
            case 'artist':
                endpoint = `/api/billboard/artist/${encodeURIComponent(query)}`;
                if (exactMatch) {
                    endpoint += '?exact=true';
                }
                break;
                
            case 'album':
                endpoint = `/api/billboard/album/${encodeURIComponent(query)}`;
                if (exactMatch) {
                    endpoint += '?exact=true';
                }
                break;
                
            case 'date':
                const startDate = startDateInput.value;
                const endDate = endDateInput.value;
                endpoint = `/api/billboard/date?start=${startDate}&end=${endDate}`;
                break;
                
            case 'position':
                endpoint = `/api/billboard/position/${query}`;
                break;
        }
        
        response = await fetch(endpoint);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const results = await response.json();
        
        loading.style.display = 'none';
        
        displayResults(results);
        calculateStatistics(results, searchType);
        resultCount.textContent = results.length;
        
    } catch (error) {
        console.error('Error during search:', error);
        loading.style.display = 'none';
        alert(`Error searching chart data: ${error.message}`);
    }
}

function displayResults(results) {
    resultsBody.innerHTML = '';
    
    if (results.length === 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.innerHTML = '<td colspan="7" class="text-center">No results found</td>';
        resultsBody.appendChild(noResultsRow);
        return;
    }
    
    // Sort results by chart date (newest first)
    results.sort((a, b) => new Date(b.chart_week) - new Date(a.chart_week));
    
    results.forEach(item => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${formatDate(item.chart_week)}</td>
            <td>${item.current_week}</td>
            <td>${escapeHtml(item.title)}</td>
            <td>${escapeHtml(item.performer)}</td>
            <td>${item.last_week}</td>
            <td>${item.peak_pos}</td>
            <td>${item.wks_on_chart}</td>
        `;
        
        resultsBody.appendChild(row);
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
    const bestPos = Math.min(...results.map(item => parseInt(item.peak_pos, 10)));
    bestPosition.textContent = bestPos || '-';
    
    // Longest run on chart
    const maxWeeks = Math.max(...results.map(item => parseInt(item.wks_on_chart, 10) || 0));
    longestRun.textContent = maxWeeks || 0;
    
    // Count unique entries (by title-artist combination or just one depending on search type)
    let uniqueItems = new Set();
    
    if (searchType === 'artist') {
        // Count unique albums for this artist
        results.forEach(item => uniqueItems.add(item.title.toLowerCase()));
        uniqueEntries.textContent = uniqueItems.size;
    } else if (searchType === 'album') {
        // For album searches, just count different artists if there are cover versions
        results.forEach(item => uniqueItems.add(item.performer.toLowerCase()));
        uniqueEntries.textContent = uniqueItems.size;
    } else {
        // For other searches, count unique title-performer combinations
        results.forEach(item => uniqueItems.add(`${item.title.toLowerCase()}-${item.performer.toLowerCase()}`));
        uniqueEntries.textContent = uniqueItems.size;
    }
    
    // Display top albums (by weeks on chart or peak position)
    displayTopAlbums(results, searchType);
    
    // Display timeline information
    const chartDates = results.map(item => new Date(item.chart_week));
    const firstDate = new Date(Math.min(...chartDates));
    const lastDate = new Date(Math.max(...chartDates));
    
    firstAppearance.textContent = formatDate(firstDate);
    lastAppearance.textContent = formatDate(lastDate);
    
    // Calculate timeline percentage (what percentage of the entire Billboard 200 history this spans)
    const billboardStart = new Date('1967-01-01'); // Approximate start of Billboard 200
    const today = new Date();
    const totalTimespan = today - billboardStart;
    const resultTimespan = lastDate - firstDate;
    const percentage = Math.min(100, Math.round((resultTimespan / totalTimespan) * 100));
    
    chartTimeline.style.width = `${percentage}%`;
}

function displayTopAlbums(results, searchType) {
    topAlbumsList.innerHTML = '';
    
    let topItems = [];
    
    if (searchType === 'artist') {
        // Group by album title
        const albumGroups = {};
        
        results.forEach(item => {
            const title = item.title.toLowerCase();
            if (!albumGroups[title]) {
                albumGroups[title] = {
                    title: item.title,
                    performer: item.performer,
                    peak: parseInt(item.peak_pos, 10),
                    weeks: parseInt(item.wks_on_chart, 10) || 0
                };
            } else {
                // Update peak position if better
                albumGroups[title].peak = Math.min(albumGroups[title].peak, parseInt(item.peak_pos, 10));
                // Update weeks if higher
                albumGroups[title].weeks = Math.max(albumGroups[title].weeks, parseInt(item.wks_on_chart, 10) || 0);
            }
        });
        
        topItems = Object.values(albumGroups);
        
        // Sort by peak position
        topItems.sort((a, b) => a.peak - b.peak);
        
    } else if (searchType === 'album') {
        // For album searches, we might have multiple versions/artists
        const artistGroups = {};
        
        results.forEach(item => {
            const performer = item.performer.toLowerCase();
            if (!artistGroups[performer]) {
                artistGroups[performer] = {
                    title: item.title,
                    performer: item.performer,
                    peak: parseInt(item.peak_pos, 10),
                    weeks: parseInt(item.wks_on_chart, 10) || 0
                };
            } else {
                // Update peak position if better
                artistGroups[performer].peak = Math.min(artistGroups[performer].peak, parseInt(item.peak_pos, 10));
                // Update weeks if higher
                artistGroups[performer].weeks = Math.max(artistGroups[performer].weeks, parseInt(item.wks_on_chart, 10) || 0);
            }
        });
        
        topItems = Object.values(artistGroups);
        
        // Sort by peak position
        topItems.sort((a, b) => a.peak - b.peak);
        
    } else {
        // For other searches, group by title-performer
        const itemGroups = {};
        
        results.forEach(item => {
            const key = `${item.title.toLowerCase()}-${item.performer.toLowerCase()}`;
            if (!itemGroups[key]) {
                itemGroups[key] = {
                    title: item.title,
                    performer: item.performer,
                    peak: parseInt(item.peak_pos, 10),
                    weeks: parseInt(item.wks_on_chart, 10) || 0
                };
            } else {
                // Update peak position if better
                itemGroups[key].peak = Math.min(itemGroups[key].peak, parseInt(item.peak_pos, 10));
                // Update weeks if higher
                itemGroups[key].weeks = Math.max(itemGroups[key].weeks, parseInt(item.wks_on_chart, 10) || 0);
            }
        });
        
        topItems = Object.values(itemGroups);
        
        // Sort by peak position
        topItems.sort((a, b) => a.peak - b.peak);
    }
    
    // Display top 5 items
    topItems.slice(0, 5).forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'list-group-item';
        listItem.innerHTML = `
            <b>${escapeHtml(item.title)}</b> - ${escapeHtml(item.performer)}
            <br>
            <small>Peak Position: #${item.peak} | Weeks on Chart: ${item.weeks}</small>
        `;
        topAlbumsList.appendChild(listItem);
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
    
    // Fetch recent data again
    fetchRecentChartData();
} 