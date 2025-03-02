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
            <div id="patreonInfo" style="display: none;">
                <span style="color: #FF424D;">★ Patron</span>
            </div>
            <div id="authButtons">
                <a href="login.html" id="loginLink" style="color: white; text-decoration: none;">Log In</a>
                <button id="logoutBtn" style="display: none; background: transparent; color: white; border: 1px solid white; padding: 5px 15px; cursor: pointer;">Log Out</button>
                <a href="#" id="patreonLoginBtn" style="
                    display: none;
                    background: #FF424D;
                    color: white;
                    text-decoration: none;
                    padding: 5px 15px;
                    border-radius: 4px;
                    margin-left: 10px;
                ">Sign in with Patreon</a>
            </div>
        </div>
    </div>
    `;

    // Inject banner at the start of body
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);
    
    // Handle auth state changes if Firebase is available
    if (typeof firebase !== 'undefined') {
        const auth = firebase.auth();
        const db = firebase.database();
        
        const loginLink = document.getElementById('loginLink');
        const logoutBtn = document.getElementById('logoutBtn');
        const userInfo = document.getElementById('userInfo');
        const userGreeting = document.getElementById('userGreeting');
        const patreonInfo = document.getElementById('patreonInfo');
        const patreonLoginBtn = document.getElementById('patreonLoginBtn');

        // Check Patreon auth status
        function checkPatreonAuth() {
            const isPatreonAuth = localStorage.getItem('patreonAuthenticated') === 'true';
            if (isPatreonAuth) {
                patreonInfo.style.display = 'block';
                patreonLoginBtn.style.display = 'none';
            } else {
                patreonInfo.style.display = 'none';
                patreonLoginBtn.style.display = 'inline-block';
            }
        }

        // Handle regular Firebase auth
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                // User is signed in
                loginLink.style.display = 'none';
                logoutBtn.style.display = 'block';
                userInfo.style.display = 'block';

                // Get user's first name from the database
                try {
                    const snapshot = await db.ref(`users/${user.uid}`).once('value');
                    const userData = snapshot.val();
                    if (userData?.firstName) {
                        userGreeting.textContent = `Hi, ${userData.firstName}`;
                    } else {
                        // If no firstName, use email or 'Guest'
                        const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                        userGreeting.textContent = `Hi, ${displayName}`;
                        
                        // Log for debugging
                        console.log('User data:', userData);
                        console.log('No firstName found for user:', user.uid);
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                    // Fallback to email if database fetch fails
                    const displayName = user.email ? user.email.split('@')[0] : 'Guest';
                    userGreeting.textContent = `Hi, ${displayName}`;
                }

                // Check Patreon status
                checkPatreonAuth();
            } else {
                // User is signed out
                loginLink.style.display = 'block';
                logoutBtn.style.display = 'none';
                userInfo.style.display = 'none';
                userGreeting.textContent = 'Hi, Guest';
                
                // Show Patreon login only when not signed in
                patreonLoginBtn.style.display = 'inline-block';
                patreonInfo.style.display = 'none';
            }
        });

        // Handle logout
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                // Also clear Patreon auth if exists
                localStorage.removeItem('patreonAuthenticated');
                localStorage.removeItem('patreonUserId');
                window.location.href = 'login.html';
            }).catch((error) => {
                console.error('Error signing out:', error);
            });
        });

        // Handle Patreon login
        patreonLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Use your Patreon auth endpoint
            window.location.href = 'https://patreonauth-vapvabofwq-uc.a.run.app/auth/patreon';
        });
    }
})();

// Also try to inject when DOM is fully loaded (backup)
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('siteBanner')) {
        injectBanner();
    }
}); 