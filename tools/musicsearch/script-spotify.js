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
const queryInput = document.getElementById('query');
const loading = document.getElementById('loading');
const trackResults = document.getElementById('trackResults');
const tracksContainer = document.getElementById('tracksContainer');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Event listeners
document.addEventListener('DOMContentLoaded', init);
loginButton.addEventListener('click', authorizeWithSpotify);
searchForm.addEventListener('submit', handleSearch);

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
    
    try {
        loading.style.display = 'block';
        trackResults.style.display = 'none';
        hideError();
        
        const tracks = await searchTracks(query);
        
        loading.style.display = 'none';
        
        if (tracks.length > 0) {
            displayTracks(tracks);
            trackResults.style.display = 'block';
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

// Search for tracks on Spotify
async function searchTracks(query) {
    const accessToken = localStorage.getItem('spotify_access_token');
    if (!accessToken) {
        throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${apiBaseUrl}/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
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
    
    const data = await response.json();
    return data.tracks.items;
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

// Display tracks in the UI
function displayTracks(tracks) {
    tracksContainer.innerHTML = '';
    
    tracks.forEach(track => {
        const albumImage = track.album.images.length > 0 
            ? track.album.images[0].url 
            : 'https://placehold.co/300/333/fff?text=No+Image';
        
        const artistNames = track.artists.map(artist => artist.name).join(', ');
        const releaseDate = track.album.release_date || 'Unknown';
        const duration = formatDuration(track.duration_ms);
        
        const trackCard = document.createElement('div');
        trackCard.className = 'col-md-6';
        trackCard.innerHTML = `
            <div class="track-card">
                <div class="row g-0">
                    <div class="col-md-4 d-flex align-items-center justify-content-center p-3">
                        <img src="${albumImage}" class="album-cover" alt="${track.album.name}">
                    </div>
                    <div class="col-md-8">
                        <div class="track-info">
                            <div class="track-title">${escapeHtml(track.name)}</div>
                            <div class="track-artist">${escapeHtml(artistNames)}</div>
                            <div class="track-album">Album: ${escapeHtml(track.album.name)} (${releaseDate})</div>
                            
                            <div class="popularity-bar" title="Popularity: ${track.popularity}/100">
                                <div class="popularity-fill" style="width: ${track.popularity}%"></div>
                            </div>
                            
                            <div class="track-metadata">
                                <span>Popularity: ${track.popularity}/100</span>
                                <span>Duration: ${duration}</span>
                            </div>
                            
                            ${track.preview_url ? `
                                <audio controls class="preview-player" src="${track.preview_url}"></audio>
                            ` : `
                                <p class="text-muted mt-2"><small>No preview available</small></p>
                            `}
                            
                            <div class="mt-2">
                                <a href="${track.external_urls.spotify}" target="_blank" class="btn btn-sm btn-spotify">
                                    <i class="bi bi-spotify"></i> Open in Spotify
                                </a>
                                <button class="btn btn-sm btn-outline-secondary ms-2 track-details-btn" data-track-id="${track.id}">
                                    <i class="bi bi-info-circle"></i> More Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        tracksContainer.appendChild(trackCard);
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