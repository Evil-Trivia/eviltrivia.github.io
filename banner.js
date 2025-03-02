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

    // Load Firebase modules
    const loadFirebase = async () => {
        try {
            const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js");
            const { getAuth, onAuthStateChanged, signOut } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js");
            const { getDatabase, ref, get } = await import("https://www.gstatic.com/firebasejs/9.17.2/firebase-database.js");

            const firebaseConfig = {
                apiKey: "AIzaSyBruAY3SH0eO000LrYqwcOGXNaUuznoMkc",
                authDomain: "eviltrivia-47664.firebaseapp.com",
                databaseURL: "https://eviltrivia-47664-default-rtdb.firebaseio.com",
                projectId: "eviltrivia-47664",
                storageBucket: "eviltrivia-47664.firebaseapp.com",
                messagingSenderId: "401826818140",
                appId: "1:401826818140:web:c1df0bf4c602cc48231e99"
            };

            // Initialize Firebase
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getDatabase(app);

            // Get DOM elements
            const loginLink = document.getElementById('loginLink');
            const logoutBtn = document.getElementById('logoutBtn');
            const userInfo = document.getElementById('userInfo');
            const userGreeting = document.getElementById('userGreeting');

            // Handle auth state changes
            onAuthStateChanged(auth, async (user) => {
                console.log("Auth state changed:", user ? "logged in" : "logged out");
                
                if (user) {
                    console.log("User is signed in with ID:", user.uid);
                    
                    // Update UI elements
                    loginLink.style.display = 'none';
                    logoutBtn.style.display = 'inline-block';
                    userInfo.style.display = 'inline-block';

                    try {
                        const snapshot = await get(ref(db, `users/${user.uid}`));
                        console.log("User data:", snapshot.val());
                        const userData = snapshot.val();
                        
                        if (userData?.firstName) {
                            userGreeting.textContent = `Hi, ${userData.firstName}`;
                        } else {
                            const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                            userGreeting.textContent = `Hi, ${displayName}`;
                        }
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                        const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                        userGreeting.textContent = `Hi, ${displayName}`;
                    }
                } else {
                    console.log("User is signed out");
                    loginLink.style.display = 'inline-block';
                    logoutBtn.style.display = 'none';
                    userInfo.style.display = 'none';
                    userGreeting.textContent = 'Hi, Guest';
                }
            });

            // Handle logout
            logoutBtn.addEventListener('click', () => {
                signOut(auth).then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Error signing out:', error);
                });
            });

        } catch (error) {
            console.error("Error loading Firebase:", error);
        }
    };

    // Load Firebase and initialize auth
    loadFirebase();
})();

// Also try to inject when DOM is fully loaded (backup)
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('siteBanner')) {
        injectBanner();
    }
}); 