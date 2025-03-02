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
            <div id="userInfo" style="display: none;">
                <span id="userGreeting" style="margin-right: 10px;">Hi, Guest</span>
            </div>
            <div id="authButtons">
                <a href="login.html" id="loginLink" style="color: white; text-decoration: none;">Log In</a>
                <button id="logoutBtn" style="display: none; background: transparent; color: white; border: 1px solid white; padding: 5px 15px; cursor: pointer;">Log Out</button>
            </div>
        </div>
    </div>
    `;

    // Inject banner at the start of body
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);

    // Get DOM elements
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const userGreeting = document.getElementById('userGreeting');

    // Wait for Firebase to be initialized
    const initBannerAuth = async () => {
        try {
            // Wait for modules to be available
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js");
            const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-database.js");

            // Get the existing Firebase app instance
            const auth = getAuth();
            const db = getDatabase();

            // Handle auth state changes
            onAuthStateChanged(auth, async (user) => {
                console.log("Banner auth state changed:", user ? "logged in" : "logged out");
                
                if (user) {
                    console.log("Banner sees user:", user.uid);
                    
                    // Update UI elements
                    loginLink.style.display = 'none';
                    logoutBtn.style.display = 'inline-block';
                    userInfo.style.display = 'inline-block';

                    try {
                        const snapshot = await get(ref(db, `users/${user.uid}`));
                        console.log("Banner user data:", snapshot.val());
                        const userData = snapshot.val();
                        
                        if (userData?.firstName) {
                            userGreeting.textContent = `Hi, ${userData.firstName}`;
                        } else {
                            const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                            userGreeting.textContent = `Hi, ${displayName}`;
                        }
                    } catch (error) {
                        console.error("Banner error fetching user data:", error);
                        const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                        userGreeting.textContent = `Hi, ${displayName}`;
                    }
                } else {
                    console.log("Banner sees user is signed out");
                    loginLink.style.display = 'inline-block';
                    logoutBtn.style.display = 'none';
                    userInfo.style.display = 'none';
                    userGreeting.textContent = 'Hi, Guest';
                }
            });

            // Handle logout
            logoutBtn.addEventListener('click', () => {
                auth.signOut().then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Error signing out:', error);
                });
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