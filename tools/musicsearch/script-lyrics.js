// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBruAY3SH0eO000LrYqwcOGXNaUuznoMkc",
    authDomain: "eviltrivia-47664.firebaseapp.com",
    databaseURL: "https://eviltrivia-47664-default-rtdb.firebaseio.com",
    projectId: "eviltrivia-47664",
    storageBucket: "eviltrivia-47664.firebasestorage.app",
    messagingSenderId: "401826818140",
    appId: "1:401826818140:web:c1df0bf4c602cc48231e99"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Spotify API integration
const clientId = '02c2d852391944d58f80d2aa3fd9296e'; 
const redirectUri = 'https://eviltrivia.com/tools/musicsearch/lyrics.html'; 

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
const queryInput = document.getElementById('query');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const trackResults = document.getElementById('trackResults');
const tracksContainer = document.getElementById('tracksContainer');
const resultCount = document.getElementById('resultCount');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const clipboardContainer = document.getElementById('clipboard-container');
const clipboardContent = document.getElementById('clipboard-content');
const toggleClipboardBtn = document.getElementById('toggle-clipboard');
const clearClipboardBtn = document.getElementById('clear-clipboard');
const copyClipboardBtn = document.getElementById('copy-clipboard');

let clipboardTracks = []; // Array to store tracks for clipboard

// Event listeners
document.addEventListener('DOMContentLoaded', init);

// Initialize the application
async function init() {
    // Set up event listeners
    if (loginButton) loginButton.addEventListener('click', authorizeWithSpotify);
    if (searchForm) searchForm.addEventListener('submit', handleSearch);
    if (toggleClipboardBtn) toggleClipboardBtn.addEventListener('click', toggleClipboard);
    if (clearClipboardBtn) clearClipboardBtn.addEventListener('click', clearClipboard);
    if (copyClipboardBtn) copyClipboardBtn.addEventListener('click', copyAllTracks);

    // Check for errors in URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    
    const error = hashParams.get('error') || queryParams.get('error');
    if (error) {
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description') || error;
        showError(`Spotify authentication error: ${errorDescription}.`);
        window.history.replaceState({}, document.title, redirectUri);
        localStorage.removeItem('spotify_code_verifier');
        localStorage.removeItem('spotify_auth_state');
        showLoginInterface();
        return;
    }

    // Check for PKCE code
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
            if (!codeVerifier) throw new Error('Code verifier not found');
            
            const tokenResponse = await exchangeCodeForToken(code, codeVerifier);
            
            localStorage.setItem('spotify_access_token', tokenResponse.access_token);
            localStorage.setItem('spotify_token_timestamp', Date.now());
            
            localStorage.removeItem('spotify_code_verifier');
            localStorage.removeItem('spotify_auth_state');
            
            window.history.replaceState({}, document.title, redirectUri);
            showSearchInterface();
        } catch (error) {
            console.error('Error exchanging code for token:', error);
            showError(`Failed to authenticate: ${error.message}`);
            showLoginInterface();
        }
    } else {
        // Check stored token
        const storedToken = localStorage.getItem('spotify_access_token');
        const tokenTimestamp = localStorage.getItem('spotify_token_timestamp');
        
        if (storedToken && tokenTimestamp && (Date.now() - tokenTimestamp < 3600000)) {
            showSearchInterface();
        } else {
            showLoginInterface();
        }
    }
}

async function authorizeWithSpotify() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    localStorage.setItem('spotify_code_verifier', codeVerifier);
    
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
    
    window.location.href = authUrl;
}

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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
}

function showSearchInterface() {
    loginContainer.style.display = 'none';
    searchContainer.style.display = 'block';
}

function showLoginInterface() {
    loginContainer.style.display = 'block';
    searchContainer.style.display = 'none';
    trackResults.style.display = 'none';
}

// Search Logic
async function handleSearch(event) {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (!query) return;

    try {
        loading.style.display = 'block';
        loadingText.textContent = 'Searching Genius for lyrics...';
        trackResults.style.display = 'none';
        hideError();
        tracksContainer.innerHTML = '';
        
        // 1. Search Genius via Firebase Function
        const geniusSearch = firebase.functions().httpsCallable('geniusSearch');
        const geniusResponse = await geniusSearch({ query: query });
        const geniusHits = geniusResponse.data.hits;

        if (!geniusHits || geniusHits.length === 0) {
            loading.style.display = 'none';
            showError('No lyrics found matching your search.');
            return;
        }

        loadingText.textContent = `Found ${geniusHits.length} lyric matches. Fetching Spotify data...`;

        // 2. Cross-reference with Spotify
        const spotifyToken = localStorage.getItem('spotify_access_token');
        const results = [];

        for (const hit of geniusHits) {
            const geniusTrack = hit.result;
            const title = geniusTrack.title;
            const artist = geniusTrack.primary_artist.name;
            
            // Search Spotify for this track
            try {
                const spotifyQuery = `track:${title} artist:${artist}`;
                const spotifyResp = await fetch(
                    `${apiBaseUrl}/search?q=${encodeURIComponent(spotifyQuery)}&type=track&limit=1`, {
                    headers: { 'Authorization': `Bearer ${spotifyToken}` }
                });

                if (spotifyResp.ok) {
                    const spotifyData = await spotifyResp.json();
                    if (spotifyData.tracks.items.length > 0) {
                        const spotifyTrack = spotifyData.tracks.items[0];
                        results.push({
                            genius: geniusTrack,
                            spotify: spotifyTrack,
                            popularity: spotifyTrack.popularity
                        });
                    } else {
                        // Track found on Genius but not Spotify (or mismatch)
                        // Include it but with 0 popularity so it's at the bottom
                        results.push({
                            genius: geniusTrack,
                            spotify: null,
                            popularity: 0
                        });
                    }
                }
            } catch (err) {
                console.warn(`Failed to fetch Spotify data for ${title} by ${artist}`, err);
                results.push({ genius: geniusTrack, spotify: null, popularity: 0 });
            }
        }

        // 3. Sort by Popularity
        results.sort((a, b) => b.popularity - a.popularity);

        // 4. Display Results
        loading.style.display = 'none';
        displayResults(results);
        trackResults.style.display = 'block';
        resultCount.textContent = results.length;

    } catch (error) {
        loading.style.display = 'none';
        console.error('Search error:', error);
        showError(`Error: ${error.message}`);
    }
}

function displayResults(results) {
    tracksContainer.innerHTML = '';

    results.forEach(item => {
        const genius = item.genius;
        const spotify = item.spotify;

        const row = document.createElement('tr');
        
        let albumImage = 'https://placehold.co/50/333/fff?text=NA';
        let spotifyLink = '#';
        let youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(genius.full_title.replace(/%20/g, "+"))}`;
        let spotifyBtn = '';
        let popularityHtml = '<span class="text-muted">N/A</span>';
        let duration = 'N/A';
        let releaseDate = 'Unknown';
        let albumName = 'Unknown';

        if (spotify) {
            albumImage = spotify.album.images.length > 0 ? spotify.album.images[spotify.album.images.length - 1].url : albumImage;
            spotifyLink = spotify.external_urls.spotify;
            spotifyBtn = `
                <a href="${spotifyLink}" target="_blank" class="btn btn-sm btn-spotify me-1" title="Open in Spotify">
                    <i class="bi bi-spotify"></i>
                </a>`;
            
            popularityHtml = `
                <div class="popularity-bar" title="Popularity: ${spotify.popularity}/100">
                    <div class="popularity-fill" style="width: ${spotify.popularity}%"></div>
                </div>
                ${spotify.popularity}/100`;
            
            duration = formatDuration(spotify.duration_ms);
            releaseDate = spotify.album.release_date || 'Unknown';
            albumName = spotify.album.name;
        }

        row.innerHTML = `
            <td>
                <img src="${genius.song_art_image_thumbnail_url || albumImage}" class="album-cover" alt="Art">
            </td>
            <td>
                <strong>${escapeHtml(genius.title)}</strong>
                ${spotify ? '' : '<br><span class="badge bg-secondary">Genius Only</span>'}
            </td>
            <td>${escapeHtml(genius.primary_artist.name)}</td>
            <td>${escapeHtml(albumName)}</td>
            <td>${releaseDate}</td>
            <td>${popularityHtml}</td>
            <td>
                <div class="d-flex">
                    <a href="${genius.url}" target="_blank" class="btn btn-sm btn-genius me-1" title="View Lyrics on Genius">
                        <strong>G</strong>
                    </a>
                    ${spotifyBtn}
                    <a href="${youtubeUrl}" target="_blank" class="btn btn-sm btn-danger me-1" title="Search on YouTube">
                        <i class="bi bi-youtube"></i>
                    </a>
                    <button class="btn btn-sm btn-primary me-1 add-track-btn" title="Add to clipboard" 
                        data-track="${escapeHtml(genius.title)}" data-artist="${escapeHtml(genius.primary_artist.name)}">
                        <i class="bi bi-clipboard-plus"></i>
                    </button>
                </div>
            </td>
        `;
        tracksContainer.appendChild(row);
    });

    // Add clipboard listeners
    document.querySelectorAll('.add-track-btn').forEach(button => {
        button.addEventListener('click', () => {
            const trackName = button.getAttribute('data-track');
            const artistName = button.getAttribute('data-artist');
            addToClipboard(`${trackName} - ${artistName}`);
        });
    });
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showFilterInfo(message) {
    // Helper used in spotify script, not strictly needed here but good for future
}

function hideFilterInfo() {
    // Helper used in spotify script
}

// Clipboard functions
function addToClipboard(trackInfo) {
    if (!clipboardTracks.includes(trackInfo)) {
        clipboardTracks.push(trackInfo);
        updateClipboardDisplay();
        if (clipboardTracks.length === 1) toggleClipboard(true);
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
    if (clipboardTracks.length === 0) return;
    const textToCopy = clipboardTracks.join('\n');
    navigator.clipboard.writeText(textToCopy)
        .then(() => alert('All tracks copied to clipboard!'))
        .catch(err => {
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
            <span class="remove-item" onclick="removeFromClipboard(${index})" style="cursor:pointer; color:red;">×</span>
        </div>`;
    });
    clipboardContent.innerHTML = html;
}

function toggleClipboard(show) {
    const isCollapsed = clipboardContainer.classList.contains('collapsed');
    if (show === true || isCollapsed) {
        clipboardContainer.classList.remove('collapsed');
        toggleClipboardBtn.innerHTML = '▲';
    } else {
        clipboardContainer.classList.add('collapsed');
        toggleClipboardBtn.innerHTML = '▼';
    }
}

window.addToClipboard = addToClipboard;
window.removeFromClipboard = removeFromClipboard;
