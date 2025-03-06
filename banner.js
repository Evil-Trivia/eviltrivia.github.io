// Create and inject banner as soon as possible
(function injectBanner() {
    // Don't inject on 404 page
    if (document.title === "Oops!") return;

    // If body isn't ready, wait and try again
    if (!document.body) {
        return setTimeout(injectBanner, 10);
    }

    // Banner HTML
    const bannerHTML = `
    <div id="siteBanner" style="
        background: #000000;
        color: white;
        padding: 10px 20px;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        display: flex;
        justify-content: space-between;
        align-items: center;
    ">
        <a href="index.html" style="color: #FFCC00; text-decoration: none; font-weight: bold;">Evil Trivia</a>
        <nav style="display: flex; gap: 20px;">
            <a href="index.html" style="color: white; text-decoration: none;">Home</a>
            <a href="grading.html" style="color: white; text-decoration: none;">Grading</a>
            <a href="admin.html" style="color: white; text-decoration: none;">Admin</a>
        </nav>
        <div style="display: flex; align-items: center; gap: 15px;">
            <div id="accountStatus" style="font-size: 14px; display: flex; align-items: center;">
                <span>Evil Trivia: <span id="evilTriviaStatus">Not Logged In</span></span>
                <span style="margin: 0 10px;">|</span>
                <span>Patreon: <span id="patreonStatus">Not Connected</span></span>
            </div>
            <a href="account.html" style="color: white; text-decoration: none; background: #333; padding: 6px 12px; border-radius: 4px; margin-left: 10px;">My Account</a>
        </div>
    </div>
    `;

    // Inject banner at the start of body
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);

    // Get DOM elements
    const evilTriviaStatus = document.getElementById('evilTriviaStatus');
    const patreonStatus = document.getElementById('patreonStatus');

    // Wait for Firebase to be initialized
    const initBannerAuth = async () => {
        try {
            // Wait for modules to be available
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js");
            const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-database.js");

            // Get the existing Firebase app instance or initialize a new one if needed
            let auth, db;
            try {
                // Try to get existing app
                const { getApp } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js");
                const app = getApp();
                auth = getAuth(app);
                db = getDatabase(app);
            } catch (e) {
                // No app exists, initialize a new one
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js");
                const firebaseConfig = {
                    apiKey: "AIzaSyBruAY3SH0eO000LrYqwcOGXNaUuznoMkc",
                    authDomain: "eviltrivia-47664.firebaseapp.com",
                    databaseURL: "https://eviltrivia-47664-default-rtdb.firebaseio.com",
                    projectId: "eviltrivia-47664",
                    storageBucket: "eviltrivia-47664.firebasestorage.app",
                    messagingSenderId: "401826818140",
                    appId: "1:401826818140:web:c1df0bf4c602cc48231e99"
                };
                const app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                db = getDatabase(app);
            }

            // Handle auth state changes
            onAuthStateChanged(auth, async (user) => {
                console.log("Banner auth state changed:", user ? "logged in" : "logged out");
                
                if (user) {
                    console.log("Banner sees user:", user.uid);
                    
                    // Update Evil Trivia status
                    try {
                        const snapshot = await get(ref(db, `users/${user.uid}`));
                        const userData = snapshot.val();
                        
                        if (userData?.firstName) {
                            evilTriviaStatus.textContent = userData.firstName;
                        } else if (user.displayName) {
                            evilTriviaStatus.textContent = user.displayName.split(' ')[0];
                        } else {
                            evilTriviaStatus.textContent = user.email ? user.email.split('@')[0] : 'Logged In';
                        }
                        
                        // Check for Patreon connection
                        if (userData?.patreonId) {
                            patreonStatus.textContent = 'Connected';
                        } else {
                            // Check localStorage as fallback
                            const patreonId = localStorage.getItem('patreonUserId');
                            if (patreonId) {
                                patreonStatus.textContent = 'Connected';
                            } else {
                                patreonStatus.textContent = 'Not Connected';
                            }
                        }
                    } catch (error) {
                        console.error("Banner error fetching user data:", error);
                        evilTriviaStatus.textContent = 'Logged In';
                        patreonStatus.textContent = 'Not Connected';
                    }
                } else {
                    console.log("Banner sees user is signed out");
                    evilTriviaStatus.textContent = 'Not Logged In';
                    
                    // Check for Patreon ID in localStorage even when not signed in
                    const patreonId = localStorage.getItem('patreonUserId');
                    if (patreonId) {
                        patreonStatus.textContent = 'Connected';
                    } else {
                        patreonStatus.textContent = 'Not Connected';
                    }
                }
            });

        } catch (error) {
            console.error("Banner error initializing Firebase:", error);
        }
    };

    // Initialize banner auth after a short delay to ensure Firebase is ready
    setTimeout(initBannerAuth, 100);
})();

// Also try to inject when DOM is fully loaded (backup)
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('siteBanner')) {
        injectBanner();
    }
}); 