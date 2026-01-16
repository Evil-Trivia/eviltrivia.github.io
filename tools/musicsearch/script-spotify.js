// Spotify API integration
// Configuration - replace these with your own values from Spotify Developer Dashboard
const clientId = '02c2d852391944d58f80d2aa3fd9296e'; // Replace with your Spotify Client ID
const redirectUri = 'https://eviltrivia.com/tools/musicsearch/spotify.html'; // Explicit redirect URI

// Spotify API endpoints
const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';
const apiBaseUrl = 'https://api.spotify.com/v1';

// Required scopes for the application
const scopes = [
    'user-read-private',
    'user-read-email'
];

// PKCE helper functions
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// DOM elements
const loginButton = document.getElementById('loginButton');
const loginContainer = document.getElementById('loginContainer');
const searchContainer = document.getElementById('searchContainer');
const searchForm = document.getElementById('searchForm');
const searchTrackCheckbox = document.getElementById('searchTrack');
const searchArtistCheckbox = document.getElementById('searchArtist');
const searchAlbumCheckbox = document.getElementById('searchAlbum');
const queryInput = document.getElementById('query');
const loading = document.getElementById('loading');
const trackResults = document.getElementById('trackResults');
const tracksContainer = document.getElementById('tracksContainer');
const resultCount = document.getElementById('resultCount');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const clipboardContainer = document.getElementById('clipboard-container');
const clipboardContent = document.getElementById('clipboard-content');
const toggleClipboardBtn = document.getElementById('toggle-clipboard');
const clearClipboardBtn = document.getElementById('clear-clipboard');
const copyClipboardBtn = document.getElementById('copy-clipboard');

// Search state variables
let lastQuery = '';
let lastSearchFields = [];
let currentOffset = 0;
let totalTracks = 0;
let allLoadedTracks = []; // New array to store all loaded tracks
const RESULTS_PER_PAGE = 50; // Increased from 25 to 50
let clipboardTracks = []; // Array to store tracks for clipboard

// Event listeners
document.addEventListener('DOMContentLoaded', init);

// Initialize the application
async function init() {
    // Set up event listeners after DOM is loaded
    if (loginButton) {
        loginButton.addEventListener('click', authorizeWithSpotify);
    }
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', handleLoadMore);
    }
    if (toggleClipboardBtn) {
        toggleClipboardBtn.addEventListener('click', toggleClipboard);
    }
    if (clearClipboardBtn) {
        clearClipboardBtn.addEventListener('click', clearClipboard);
    }
    if (copyClipboardBtn) {
        copyClipboardBtn.addEventListener('click', copyAllTracks);
    }
    
    // Check for errors in URL (both hash and query string)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    
    const error = hashParams.get('error') || queryParams.get('error');
    if (error) {
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description') || error;
        showError(`Spotify authentication error: ${errorDescription}. Please check your Spotify app configuration.`);
        // Clean up the URL
        window.history.replaceState({}, document.title, redirectUri);
        // Clean up stored values
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_auth_state');
        showLoginInterface();
        return;
    }
    
    // Check if we're coming back from Spotify authorization with a code (PKCE flow)
    const code = queryParams.get('code');
    const state = queryParams.get('state');
    
    if (code) {
        // Verify state
        const storedState = localStorage.getItem('spotify_auth_state');
        if (state !== storedState) {
            showError('Invalid state parameter. Authentication failed.');
            window.history.replaceState({}, document.title, redirectUri);
            localStorage.removeItem('spotify_code_verifier');
            localStorage.removeItem('spotify_auth_state');
            showLoginInterface();
            return;
        }
        
        // Exchange code for token
        try {
            const codeVerifier = localStorage.getItem('spotify_code_verifier');
            if (!codeVerifier) {
                throw new Error('Code verifier not found');
            }
            
            const tokenResponse = await exchangeCodeForToken(code, codeVerifier);
            
            // Store token
            localStorage.setItem('spotify_access_token', tokenResponse.access_token);
            localStorage.setItem('spotify_token_timestamp', Date.now());
            
            // Clean up
            localStorage.removeItem('spotify_code_verifier');
            localStorage.removeItem('spotify_auth_state');
            
            // Remove code from URL
            window.history.replaceState({}, document.title, redirectUri);
            
            // Show search interface
            showSearchInterface();
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            showError(`Failed to authenticate: ${error.message}`);
            localStorage.removeItem('spotify_code_verifier');
            localStorage.removeItem('spotify_auth_state');
            showLoginInterface();
        }
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
}

// Redirect to Spotify authorization page using Authorization Code flow with PKCE
async function authorizeWithSpotify() {
    console.log("Authorizing with Spotify using PKCE:");
    console.log("Client ID:", clientId);
    console.log("Redirect URI:", redirectUri);
    
    // Generate PKCE parameters
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Store code verifier for later use
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    
    // Create state parameter for CSRF protection
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);
    
    const authUrl = `${authEndpoint}?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes.join(' '))}&` +
        `code_challenge_method=S256&` +
        `code_challenge=${codeChallenge}&` +
        `state=${state}&` +
        `show_dialog=true`;
    
    console.log("Auth URL:", authUrl);
    
    window.location.href = authUrl;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code, codeVerifier) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier
    });
    
    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
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
    
    // Get selected search fields
    const searchFields = [];
    if (searchTrackCheckbox.checked) searchFields.push('track');
    if (searchArtistCheckbox.checked) searchFields.push('artist');
    if (searchAlbumCheckbox.checked) searchFields.push('album');
    
    // Ensure at least one field is selected
    if (searchFields.length === 0) {
        showError('Please select at least one field to search');
        return;
    }
    
    // Reset pagination for new search
    currentOffset = 0;
    lastQuery = query;
    lastSearchFields = searchFields;
    
    try {
        loading.style.display = 'block';
        trackResults.style.display = 'none';
        hideError();
        hideFilterInfo();
        
        // Clear previous results
        tracksContainer.innerHTML = '';
        
        const tracks = await searchTracks(query, searchFields, currentOffset, RESULTS_PER_PAGE);
        
        loading.style.display = 'none';
        
        if (tracks.items.length > 0) {
            // Store the tracks
            allLoadedTracks = [...tracks.items];
            
            // Display tracks
            displayTracks(allLoadedTracks);
            trackResults.style.display = 'block';
            
            // Update total count 
            totalTracks = tracks.originalTotal;
            resultCount.textContent = allLoadedTracks.length;
            
            // Use the toggle function to update the load more button
            toggleLoadMoreButton(allLoadedTracks.length, tracks.originalTotal);
            
            // Make sure the loadMoreBtn has a click event handler
            loadMoreBtn.addEventListener('click', handleLoadMore);
            
            console.log(`Search complete. Showing ${allLoadedTracks.length} of ${tracks.originalTotal} total results.`);
        } else {
            showError('No tracks found matching your search.');
        }
    } catch (error) {
        loading.style.display = 'none';
        console.error('Error searching tracks:', error);
        showError(`Error: ${error.message || 'Failed to search tracks'}`);
    }
}

// Handle load more button click
async function handleLoadMore() {
    if (!lastQuery) return;
    
    currentOffset += RESULTS_PER_PAGE;
    
    try {
        loading.style.display = 'block';
        loadMoreBtn.disabled = true;
        
        // Use the same multi-field search approach as the initial search
        const tracks = await searchTracks(lastQuery, lastSearchFields, currentOffset, RESULTS_PER_PAGE);
        
        loading.style.display = 'none';
        loadMoreBtn.disabled = false;
        
        if (tracks.items.length > 0) {
            // We need to deduplicate the tracks since we're combining results
            const newTrackIds = new Set(tracks.items.map(track => track.id));
            const existingTrackIds = new Set(allLoadedTracks.map(track => track.id));
            
            // Filter out any tracks we already have
            const uniqueNewTracks = tracks.items.filter(track => !existingTrackIds.has(track.id));
            
            // If we got results but they're all duplicates, we've exhausted the results
            if (uniqueNewTracks.length === 0) {
                loadMoreBtn.style.display = 'none';
                showFilterInfo(`All available tracks loaded for "${lastQuery}" (${allLoadedTracks.length} tracks)`);
                console.log('No new unique tracks found. All results loaded.');
                return;
            }
            
            // Add only unique new tracks to our allLoadedTracks array
            allLoadedTracks = [...allLoadedTracks, ...uniqueNewTracks];
            
            // Re-sort the entire list by popularity
            allLoadedTracks.sort((a, b) => b.popularity - a.popularity);
            
            // Display all tracks (this will clear and redisplay everything)
            displayTracks(allLoadedTracks);
            
            // Update displayed count
            resultCount.textContent = allLoadedTracks.length;
            
            // Update load more button visibility and text
            toggleLoadMoreButton(allLoadedTracks.length, tracks.originalTotal);
            
            console.log(`Added ${uniqueNewTracks.length} unique new tracks. Total: ${allLoadedTracks.length}`);
        } else {
            // If no more results, hide the load more button
            loadMoreBtn.style.display = 'none';
            showFilterInfo(`All available tracks loaded for "${lastQuery}" (${allLoadedTracks.length} tracks)`);
        }
    } catch (error) {
        loading.style.display = 'none';
        loadMoreBtn.disabled = false;
        showError(`Error loading more tracks: ${error.message}`);
        console.error('Error loading more tracks:', error);
    }
}

// Toggle load more button visibility and update text
function toggleLoadMoreButton(currentCount, totalCount) {
    console.log(`toggleLoadMoreButton: currentCount=${currentCount}, totalCount=${totalCount}`);
    
    // Always show the button if we have more results to load
    if (totalCount > currentCount) {
        loadMoreBtn.style.display = 'inline-block';
        loadMoreBtn.textContent = `Load More (${currentCount} of ${totalCount}+ shown)`;
        
        // Update filter info with counts
        if (lastSearchFields.length > 1) {
            const fieldNames = lastSearchFields.map(field => {
                if (field === 'track') return 'title';
                return field;
            }).join(', ');
            showFilterInfo(`Showing ${currentCount} tracks with "${lastQuery}" in ${fieldNames} (${totalCount}+ total matches)`);
        } else {
            const fieldType = lastSearchFields[0] === 'track' ? 'track title' : 
                             lastSearchFields[0] === 'artist' ? 'artist name' : 'album title';
            showFilterInfo(`Showing ${currentCount} tracks matching "${lastQuery}" in ${fieldType} (${totalCount}+ total matches)`);
        }
    } else {
        // Hide the button if we've loaded all available results
        loadMoreBtn.style.display = 'none';
        showFilterInfo(`All available tracks loaded for "${lastQuery}" (${currentCount} tracks)`);
    }
}

// Search for tracks
async function searchTracks(query, searchFields, offset = 0, limit = RESULTS_PER_PAGE) {
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
        
        // IMPORTANT: For OR logic between fields, we need a simpler approach
        // Instead of constructing complex queries with field:query syntax,
        // We'll make separate requests for each field and combine the results
        
        let allResults = [];
        let totalPotentialResults = 0; // Track this properly for pagination
        
        // Make a request for each selected field
        for (const field of searchFields) {
            // Construct a simple query for this field
            let fieldQuery;
            
            if (field === 'track') {
                fieldQuery = `track:${query}`;
            } else if (field === 'artist') {
                fieldQuery = `artist:${query}`;
            } else if (field === 'album') {
                fieldQuery = `album:${query}`;
            }
            
            console.log(`Searching with ${field} query: ${fieldQuery}`);
            
            // Make the search request for this field
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodeURIComponent(fieldQuery)}&type=track&limit=${limit}&offset=${offset}&market=US`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                console.error(`API request for ${field} failed with status ${response.status}`);
                continue; // Skip this field if request fails, but try others
            }
            
            const data = await response.json();
            
            if (data.tracks && data.tracks.items.length > 0) {
                console.log(`${field} search returned ${data.tracks.items.length} results (total of ${data.tracks.total} available)`);
                
                // Add these results to our collection
                allResults = allResults.concat(data.tracks.items);
                
                // Update the max potential total results across all search types
                // This helps us know if there are more results to load
                totalPotentialResults = Math.max(totalPotentialResults, data.tracks.total);
            }
        }
        
        // If we didn't find any results from any fields
        if (allResults.length === 0) {
            showFilterInfo(`No results found for "${query}" in the selected fields`);
            return { items: [], total: 0, originalTotal: 0 };
        }
        
        // De-duplicate results (tracks can appear in multiple searches)
        const uniqueTrackMap = new Map();
        
        allResults.forEach(track => {
            // Use track ID as the unique key
            if (!uniqueTrackMap.has(track.id)) {
                uniqueTrackMap.set(track.id, track);
            }
        });
        
        // Convert back to array
        const uniqueTracks = Array.from(uniqueTrackMap.values());
        
        // Sort tracks by popularity (descending)
        const sortedTracks = uniqueTracks.sort((a, b) => b.popularity - a.popularity);
        
        // Set the proper filter message
        if (searchFields.length > 1) {
            const fieldNames = searchFields.map(field => {
                if (field === 'track') return 'title';
                return field;
            }).join(', ');
            showFilterInfo(`Showing tracks with "${query}" in ${fieldNames} (${sortedTracks.length} results)`);
        } else if (searchFields[0] === 'track') {
            showFilterInfo(`Showing tracks with "${query}" in the title (${sortedTracks.length} results)`);
        } else if (searchFields[0] === 'artist') {
            showFilterInfo(`Showing tracks by artists matching "${query}" (${sortedTracks.length} results)`);
        } else if (searchFields[0] === 'album') {
            showFilterInfo(`Showing tracks from albums matching "${query}" (${sortedTracks.length} results)`);
        }
        
        // We need a larger "total" to tell the pagination system there are more results
        // For multi-field searches, if any field has more results available, we should allow loading more
        // We'll use a generous estimate: if we got results and totalPotentialResults is high, enable load more
        const hasMorePotential = totalPotentialResults > sortedTracks.length;
        // Set originalTotal higher than current results if there's potential for more
        const calculatedTotal = hasMorePotential ? Math.max(totalPotentialResults, sortedTracks.length + 1) : sortedTracks.length;
        
        console.log(`Search complete. Found ${sortedTracks.length} unique tracks. Total potential: ${totalPotentialResults}, calculatedTotal: ${calculatedTotal}`);
        
        return {
            items: sortedTracks,
            total: sortedTracks.length,
            originalTotal: calculatedTotal
        };
    } catch (error) {
        console.error('Error searching tracks:', error);
        showError(`Search error: ${error.message}`);
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
        
        // Generate YouTube search URL
        const youtubeSearchQuery = `${encodeURIComponent(track.name)} ${encodeURIComponent(artistNames)}`;
        const youtubeUrl = `https://www.youtube.com/results?search_query=${youtubeSearchQuery.replace(/%20/g, "+")}`;
        
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
            <td>
                <div class="d-flex">
                    <a href="${track.external_urls.spotify}" target="_blank" class="btn btn-sm btn-spotify me-1" title="Open in Spotify">
                        <i class="bi bi-spotify"></i>
                    </a>
                    <a href="${youtubeUrl}" target="_blank" class="btn btn-sm btn-danger me-1" title="Search on YouTube">
                        <i class="bi bi-youtube"></i>
                    </a>
                    <button class="btn btn-sm btn-primary me-1 add-track-btn" title="Add to clipboard" 
                        data-track="${escapeHtml(track.name)}" data-artist="${escapeHtml(artistNames)}">
                        <i class="bi bi-clipboard-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary track-details-btn" data-track-id="${track.id}" title="View Details">
                        <i class="bi bi-info-circle"></i>
                    </button>
                </div>
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
    
    // Add event listeners to the "Add to clipboard" buttons
    document.querySelectorAll('.add-track-btn').forEach(button => {
        button.addEventListener('click', () => {
            const trackName = button.getAttribute('data-track');
            const artistName = button.getAttribute('data-artist');
            addToClipboard(`${trackName} - ${artistName}`);
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

// Clipboard management functions
function addToClipboard(trackInfo) {
    // Check if the track is already in the clipboard
    if (!clipboardTracks.includes(trackInfo)) {
        clipboardTracks.push(trackInfo);
        updateClipboardDisplay();
        
        // Show clipboard if it's the first item
        if (clipboardTracks.length === 1) {
            toggleClipboard(true);
        }
    }
}

function removeFromClipboard(index) {
    clipboardTracks.splice(index, 1);
    updateClipboardDisplay();
}

function clearClipboard() {
    clipboardTracks = [];
    updateClipboardDisplay();
}

function copyAllTracks() {
    if (clipboardTracks.length === 0) {
        return;
    }
    
    const textToCopy = clipboardTracks.join('\n');
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            alert('All tracks copied to clipboard!');
        })
        .catch(err => {
            // Fallback for browsers that don't support clipboard API
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('All tracks copied to clipboard!');
        });
}

function updateClipboardDisplay() {
    if (clipboardTracks.length === 0) {
        clipboardContent.innerHTML = '<p>No tracks added yet.</p>';
        return;
    }
    
    let html = '';
    clipboardTracks.forEach((track, index) => {
        html += `
        <div class="clipboard-item">
            ${escapeHtml(track)}
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