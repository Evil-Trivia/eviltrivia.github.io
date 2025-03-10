// Spotify API integration
// Configuration - replace these with your own values from Spotify Developer Dashboard
const clientId = '02c2d852391944d58f80d2aa3fd9296e'; // Replace with your Spotify Client ID
const redirectUri = 'https://eviltrivia.com/tools/musicsearch/spotify.html'; // Explicit redirect URI

// Spotify API endpoints
const authEndpoint = 'https://accounts.spotify.com/authorize';
const apiBaseUrl = 'https://api.spotify.com/v1';

// Required scopes for the application
const scopes = [
    'user-read-private',
    'user-read-email'
];

// DOM elements
const loginButton = document.getElementById('loginButton');
const loginContainer = document.getElementById('loginContainer');
const searchContainer = document.getElementById('searchContainer');
const searchForm = document.getElementById('searchForm');
const searchTypeSelect = document.getElementById('searchType');
const searchMethodSelect = document.getElementById('searchMethod'); // New element for search method
const queryInput = document.getElementById('query');
const loading = document.getElementById('loading');
const trackResults = document.getElementById('trackResults');
const tracksContainer = document.getElementById('tracksContainer');
const resultCount = document.getElementById('resultCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Search state variables
let lastQuery = '';
let lastSearchType = '';
let lastSearchMethod = ''; // New variable to track search method
let currentOffset = 0;
let totalTracks = 0;
const RESULTS_PER_PAGE = 50;

// Event listeners
document.addEventListener('DOMContentLoaded', init);
loginButton.addEventListener('click', authorizeWithSpotify);
searchForm.addEventListener('submit', handleSearch);
loadMoreBtn.addEventListener('click', handleLoadMore);

// Initialize the application
function init() {
    // Check if we're coming back from Spotify authorization
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        // We have an access token - store it
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_timestamp', Date.now());
        
        // Remove the access token from the URL to prevent sharing it
        window.history.replaceState({}, document.title, redirectUri);
        
        // Show search interface
        showSearchInterface();
    } else {
        // Check if we have a valid token stored
        const storedToken = localStorage.getItem('spotify_access_token');
        const tokenTimestamp = localStorage.getItem('spotify_token_timestamp');
        
        // Tokens expire after 1 hour (3600000 ms)
        if (storedToken && tokenTimestamp && (Date.now() - tokenTimestamp < 3600000)) {
            showSearchInterface();
        } else {
            // No valid token, show login
            showLoginInterface();
        }
    }
    
    // Set up search method dropdown if it exists
    if (searchMethodSelect) {
        searchMethodSelect.addEventListener('change', function() {
            // Show/hide filter info when search method changes
            if (this.value === 'comprehensive') {
                showFilterInfo('Comprehensive search combines results from multiple query types and sorts by popularity');
            } else {
                hideFilterInfo();
            }
        });
    }
}

// Redirect to Spotify authorization page
function authorizeWithSpotify() {
    console.log("Authorizing with Spotify using:");
    console.log("Client ID:", clientId);
    console.log("Redirect URI:", redirectUri);
    
    const authUrl = `${authEndpoint}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&response_type=token&show_dialog=true`;
    console.log("Auth URL:", authUrl);
    
    window.location.href = authUrl;
}

// Show the search interface
function showSearchInterface() {
    loginContainer.style.display = 'none';
    searchContainer.style.display = 'block';
}

// Show the login interface
function showLoginInterface() {
    loginContainer.style.display = 'block';
    searchContainer.style.display = 'none';
    trackResults.style.display = 'none';
}

// Handle the search form submission
async function handleSearch(event) {
    event.preventDefault();
    
    const query = queryInput.value.trim();
    if (!query) return;
    
    // Reset pagination for new search
    currentOffset = 0;
    lastQuery = query;
    lastSearchType = searchTypeSelect.value;
    lastSearchMethod = searchMethodSelect.value;
    
    try {
        loading.style.display = 'block';
        trackResults.style.display = 'none';
        hideError();
        hideFilterInfo();
        
        // Clear previous results
        tracksContainer.innerHTML = '';
        
        const tracks = await searchTracks(query, lastSearchType, lastSearchMethod, currentOffset, RESULTS_PER_PAGE);
        
        loading.style.display = 'none';
        
        if (tracks.items.length > 0) {
            displayTracks(tracks.items);
            trackResults.style.display = 'block';
            
            // Update total count 
            totalTracks = tracks.originalTotal;
            resultCount.textContent = tracks.items.length;
            
            // Update the load more button and its text
            if (tracks.items.length < tracks.originalTotal) {
                loadMoreBtn.style.display = 'inline-block';
                loadMoreBtn.textContent = `Load More (Showing ${tracks.items.length} of ${tracks.originalTotal}+)`;
            } else {
                loadMoreBtn.style.display = 'none';
            }
            
            // Check if using track filter, show info about filtering
            if (lastSearchType === 'track' && tracks.items.length < tracks.originalTotal) {
                showFilterInfo(`Showing ${tracks.items.length} tracks that actually contain "${query}" in title (Spotify returned ${tracks.originalTotal} total results)`);
            }
        } else {
            showError('No tracks found matching your search.');
        }
    } catch (error) {
        loading.style.display = 'none';
        console.error('Error searching tracks:', error);
        
        if (error.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_token_timestamp');
            showError('Your session has expired. Please log in again.');
            showLoginInterface();
        } else {
            showError(`Error: ${error.message || 'Failed to search tracks'}`);
        }
    }
}

// Handle load more button click
async function handleLoadMore() {
    if (!lastQuery) return;
    
    currentOffset += RESULTS_PER_PAGE;
    
    try {
        loading.style.display = 'block';
        loadMoreBtn.disabled = true;
        
        const tracks = await searchTracks(lastQuery, lastSearchType, lastSearchMethod, currentOffset, RESULTS_PER_PAGE);
        
        loading.style.display = 'none';
        loadMoreBtn.disabled = false;
        
        if (tracks.items.length > 0) {
            // Add new tracks to the display
            displayTracks(tracks.items, true); // true means append to existing results
            
            // Update displayed count
            const currentCount = document.querySelectorAll('#tracksContainer tr').length;
            resultCount.textContent = currentCount;
            
            // Update load more button text
            if (currentCount < tracks.originalTotal) {
                loadMoreBtn.style.display = 'inline-block';
                loadMoreBtn.textContent = `Load More (Showing ${currentCount} of ${tracks.originalTotal}+)`;
            } else {
                loadMoreBtn.style.display = 'none';
            }
            
            // Update filter info if we're doing track title filtering
            if (lastSearchType === 'track') {
                showFilterInfo(`Showing ${currentCount} tracks that actually contain "${lastQuery}" in title (Spotify returned ${tracks.originalTotal} total results)`);
            }
        } else {
            // No more results to load
            loadMoreBtn.style.display = 'none';
            showFilterInfo(`All available tracks loaded that contain "${lastQuery}" (${document.querySelectorAll('#tracksContainer tr').length} tracks)`);
        }
    } catch (error) {
        loading.style.display = 'none';
        loadMoreBtn.disabled = false;
        console.error('Error loading more tracks:', error);
        showError(`Error: ${error.message || 'Failed to load more tracks'}`);
    }
}

// Toggle load more button visibility
function toggleLoadMoreButton(currentCount, totalCount) {
    if (currentCount < totalCount) {
        loadMoreBtn.style.display = 'inline-block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// Search for tracks
async function searchTracks(query, searchBy, searchMethod = 'standard', offset = 0, limit = RESULTS_PER_PAGE) {
    try {
        if (!query) {
            showError('Please enter a search query');
            return { items: [], total: 0 };
        }

        // Clear error message if any
        hideError();
        
        // Get access token
        const token = localStorage.getItem('spotify_access_token');
        if (!token) {
            throw new Error('Not authenticated');
        }
        
        // For comprehensive search, we'll combine multiple search strategies
        if (searchMethod === 'comprehensive' && searchBy === 'track') {
            return await comprehensiveTrackSearch(query, token, offset, limit);
        }
        
        // Standard search approach
        // Construct search query based on filter selection
        let searchQuery = '';
        
        if (searchBy === 'all') {
            searchQuery = query;
        } else if (searchBy === 'track') {
            if (searchMethod === 'contains') {
                // Search for tracks containing the term
                searchQuery = `track:${query}`;
            } else if (searchMethod === 'exact') {
                // Search for exact track title matches
                searchQuery = `track:"${query}"`;
            } else {
                // Default (standard) - use quotes for better matching
                searchQuery = `track:"${query}"`;
            }
        } else if (searchBy === 'artist') {
            searchQuery = `artist:"${query}"`;
        } else if (searchBy === 'album') {
            searchQuery = `album:"${query}"`;
        }
        
        // Log the constructed query for debugging
        console.log('Searching with query:', searchQuery);
        
        // Make search request
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}&offset=${offset}&market=US`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = new Error(`API request failed with status ${response.status}`);
            error.status = response.status;
            throw error;
        }

        const data = await response.json();
        
        if (!data.tracks || data.tracks.items.length === 0) {
            return { items: [], total: 0, originalTotal: 0 };
        }
        
        // Log the total available before filtering
        console.log(`Spotify reports ${data.tracks.total} total tracks available for this search`);
        
        // If searching by track title, do an additional client-side filter
        // to ensure results actually contain the search term in the title
        let filteredTracks = data.tracks.items;
        let originalTotal = data.tracks.total;
        
        if (searchBy === 'track' && searchMethod !== 'contains') {
            const lowerQuery = query.toLowerCase();
            filteredTracks = data.tracks.items.filter(track => 
                track.name.toLowerCase().includes(lowerQuery)
            );
            console.log(`Filtered from ${data.tracks.items.length} to ${filteredTracks.length} tracks that actually contain "${query}" in title`);
        }
        
        // Sort tracks by popularity (descending)
        const sortedTracks = filteredTracks.sort((a, b) => b.popularity - a.popularity);
        
        // Return the data in the format expected by handleSearch with both original and filtered totals
        return {
            items: sortedTracks,
            total: filteredTracks.length, // Filtered count for pagination
            originalTotal: originalTotal  // Keep track of original total from Spotify
        };
    } catch (error) {
        console.error('Error searching tracks:', error);
        throw error;
    }
}

// Comprehensive track search that combines multiple search strategies
async function comprehensiveTrackSearch(query, token, offset = 0, limit = RESULTS_PER_PAGE) {
    console.log('Performing comprehensive search for:', query);
    
    try {
        // Create multiple search queries to cast a wide net
        const searchStrategies = [
            `track:"${query}"`,          // Exact phrase in track title
            `track:${query}`,            // Term in track title
            `${query}`,                  // General search
            `track:${query.split(' ').join(' track:')}` // Each word must appear in track title
        ];
        
        // Track unique songs to avoid duplicates
        const uniqueTracks = new Map();
        let totalFound = 0;
        
        // Execute all searches in parallel for speed
        const searchPromises = searchStrategies.map(async (searchQuery) => {
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}&market=US`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            totalFound += data.tracks.total;
            return data.tracks.items || [];
        });
        
        // Wait for all searches to complete
        const resultsArrays = await Promise.all(searchPromises);
        
        // Combine results, keeping track of unique items by ID
        for (const tracks of resultsArrays) {
            for (const track of tracks) {
                // Only add if not already in our results and if it contains the search term
                if (!uniqueTracks.has(track.id) && 
                    track.name.toLowerCase().includes(query.toLowerCase())) {
                    uniqueTracks.set(track.id, track);
                }
            }
        }
        
        console.log(`Comprehensive search found ${uniqueTracks.size} unique relevant tracks`);
        
        // Convert to array and sort by popularity
        const combinedTracks = Array.from(uniqueTracks.values())
            .sort((a, b) => b.popularity - a.popularity);
        
        // Apply pagination (client-side)
        const paginatedTracks = combinedTracks.slice(offset, offset + limit);
        
        return {
            items: paginatedTracks,
            total: uniqueTracks.size,
            originalTotal: totalFound
        };
    } catch (error) {
        console.error('Error in comprehensive search:', error);
        throw error;
    }
}

// Get detailed track information
async function getTrack(trackId) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${apiBaseUrl}/tracks/${trackId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    
    if (!response.ok) {
        const error = new Error(`API request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }
    
    return await response.json();
}

// Display tracks in the UI as a table
function displayTracks(tracks, append = false) {
    if (!append) {
        tracksContainer.innerHTML = '';
    }
    
    tracks.forEach(track => {
        const albumImage = track.album.images.length > 0 
            ? track.album.images[track.album.images.length - 1].url  // Use smallest image for table
            : 'https://placehold.co/50/333/fff?text=NA';
        
        const artistNames = track.artists.map(artist => artist.name).join(', ');
        const releaseDate = track.album.release_date || 'Unknown';
        const duration = formatDuration(track.duration_ms);
        
        // Check if preview URL exists and is not null (robustly check for non-empty string)
        const hasPreview = track.preview_url !== null && track.preview_url !== undefined && track.preview_url !== '';
        const previewHtml = hasPreview 
            ? `<audio controls preload="none" src="${track.preview_url}" class="preview-player"></audio>` 
            : '<span class="text-muted">No preview</span>';
        
        // For debugging
        console.log(`Track: ${track.name}, Preview URL: ${track.preview_url || 'none'}`);
        
        const row = document.createElement('tr');
        
        // Create the table row HTML
        row.innerHTML = `
            <td>
                <img src="${albumImage}" class="album-cover" alt="${escapeHtml(track.album.name)}">
            </td>
            <td>${escapeHtml(track.name)}</td>
            <td>${escapeHtml(artistNames)}</td>
            <td>${escapeHtml(track.album.name)}</td>
            <td>${releaseDate}</td>
            <td>
                <div class="popularity-bar" title="Popularity: ${track.popularity}/100">
                    <div class="popularity-fill" style="width: ${track.popularity}%"></div>
                </div>
                ${track.popularity}/100
            </td>
            <td>${duration}</td>
            <td>${previewHtml}</td>
            <td>
                <a href="${track.external_urls.spotify}" target="_blank" class="btn btn-sm btn-spotify me-1" title="Open in Spotify">
                    <i class="bi bi-spotify"></i>
                </a>
                <button class="btn btn-sm btn-outline-secondary track-details-btn" data-track-id="${track.id}" title="View Details">
                    <i class="bi bi-info-circle"></i>
                </button>
            </td>
        `;
        
        tracksContainer.appendChild(row);
    });
    
    // Add event listeners to the "More Details" buttons
    document.querySelectorAll('.track-details-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const trackId = event.currentTarget.getAttribute('data-track-id');
            try {
                loading.style.display = 'block';
                const trackDetails = await getTrack(trackId);
                loading.style.display = 'none';
                showTrackDetails(trackDetails);
            } catch (error) {
                loading.style.display = 'none';
                console.error('Error fetching track details:', error);
                showError(`Error: Failed to fetch track details`);
            }
        });
    });
}

// Format duration from milliseconds to MM:SS
function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Show track details in a modal (can be implemented later)
function showTrackDetails(track) {
    // This could be enhanced to show more details in a modal
    alert(`
        Track: ${track.name}
        Artist: ${track.artists.map(a => a.name).join(', ')}
        Album: ${track.album.name}
        Release Date: ${track.album.release_date}
        Popularity: ${track.popularity}/100
        Track Number: ${track.track_number}
        Explicit: ${track.explicit ? 'Yes' : 'No'}
        ISRC: ${track.external_ids.isrc || 'N/A'}
    `);
}

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error message
function hideError() {
    errorMessage.style.display = 'none';
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show filter info message
function showFilterInfo(message) {
    // Create info alert if it doesn't exist
    if (!document.getElementById('filterInfoMessage')) {
        const infoAlert = document.createElement('div');
        infoAlert.id = 'filterInfoMessage';
        infoAlert.className = 'alert alert-info mt-3';
        infoAlert.innerHTML = `<i class="bi bi-info-circle"></i> <span id="filterInfoText"></span>`;
        
        // Insert after error message
        const errorMsg = document.getElementById('errorMessage');
        errorMsg.parentNode.insertBefore(infoAlert, errorMsg.nextSibling);
    }
    
    // Set message and show
    document.getElementById('filterInfoText').textContent = message;
    document.getElementById('filterInfoMessage').style.display = 'block';
}

// Hide filter info message
function hideFilterInfo() {
    const filterInfo = document.getElementById('filterInfoMessage');
    if (filterInfo) {
        filterInfo.style.display = 'none';
    }
} 