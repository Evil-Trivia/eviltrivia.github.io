// Create and inject banner as soon as possible
(function injectBanner() {
    // Don't inject on 404 page
    if (document.title === "Oops!") return;

    // If body isn't ready, wait and try again
    if (!document.body) {
        return setTimeout(injectBanner, 10);
    }

    // Add CSS styles for responsive design
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #siteBanner {
            background: #000000;
            color: white;
            padding: 10px 20px;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        
        .banner-container {
            width: 100%;
            max-width: 1200px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .banner-logo {
            color: #FFCC00;
            text-decoration: none;
            font-weight: bold;
        }
        
        .banner-nav {
            display: flex;
            gap: 20px;
        }
        
        .banner-nav a {
            color: white;
            text-decoration: none;
        }
        
        .banner-account {
            display: flex;
            align-items: center;
            gap: 15px;
            white-space: nowrap;
        }
        
        .banner-account-status {
            font-size: 14px;
            display: flex;
            align-items: center;
        }
        
        .banner-account-link {
            color: white;
            text-decoration: none;
            background: #333;
            padding: 6px 12px;
            border-radius: 4px;
            margin-left: 10px;
        }
        
        #hamburgerMenu {
            display: none;
            flex-direction: column;
            justify-content: space-between;
            width: 30px;
            height: 21px;
            cursor: pointer;
        }
        
        #hamburgerMenu span {
            display: block;
            height: 3px;
            width: 100%;
            background-color: white;
        }
        
        .mobile-menu {
            display: none;
            position: fixed;
            top: 60px;
            left: 0;
            right: 0;
            background: #000000;
            padding: 20px;
            z-index: 999;
            flex-direction: column;
            gap: 15px;
        }
        
        .mobile-menu a {
            color: white;
            text-decoration: none;
            padding: 10px 0;
            border-bottom: 1px solid #333;
        }
        
        .mobile-menu .banner-account-status {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #333;
        }
        
        .mobile-menu .banner-account-status span {
            margin: 0;
        }
        
        .mobile-menu .banner-account-link {
            margin-left: 0;
            align-self: flex-start;
        }
        
        @media (max-width: 1024px) {
            .banner-nav, .banner-account {
                display: none;
            }
            
            #hamburgerMenu {
                display: flex;
            }
            
            .mobile-menu.active {
                display: flex;
            }
        }
    `;
    document.head.appendChild(styleElement);

    // Banner HTML with updated responsive classes
    const bannerHTML = `
    <div id="siteBanner">
        <div class="banner-container">
            <a href="/" class="banner-logo">Evil Trivia</a>
            <nav class="banner-nav">
                <a href="/">Home</a>
                <a href="/games">Games</a>
                <a href="/live">Live Trivia</a>
                <a href="/tools" id="toolsLink" style="display: none;">Tools</a>
                <a href="/pages/grading.html" id="gradingLink" style="display: none;">Grading</a>
                <a href="/pages/admin.html" id="adminLink" style="display: none;">Admin</a>
            </nav>
            <div class="banner-account">
                <div id="accountStatus" class="banner-account-status">
                    <span>Evil Trivia: <span id="evilTriviaStatus">Not Logged In</span></span>
                    <span style="margin: 0 10px;">|</span>
                    <span>Patreon: <span id="patreonStatus">Not Connected</span></span>
                </div>
                <a href="/pages/account.html" class="banner-account-link">My Account</a>
            </div>
            <div id="hamburgerMenu">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </div>
    <div id="mobileMenu" class="mobile-menu">
        <a href="/">Home</a>
        <a href="/games">Games</a>
        <a href="/live">Live Trivia</a>
        <a href="/tools" id="mobileToolsLink" style="display: none;">Tools</a>
        <a href="/pages/grading.html" id="mobileGradingLink" style="display: none;">Grading</a>
        <a href="/pages/admin.html" id="mobileAdminLink" style="display: none;">Admin</a>
        <div id="mobileAccountStatus" class="banner-account-status">
            <span>Evil Trivia: <span id="mobileEvilTriviaStatus">Not Logged In</span></span>
            <span>Patreon: <span id="mobilePatreonStatus">Not Connected</span></span>
        </div>
        <a href="/pages/account.html" class="banner-account-link">My Account</a>
    </div>
    `;

    // Inject banner at the start of body
    document.body.insertAdjacentHTML('afterbegin', bannerHTML);

    // Get DOM elements
    const evilTriviaStatus = document.getElementById('evilTriviaStatus');
    const patreonStatus = document.getElementById('patreonStatus');
    const toolsLink = document.getElementById('toolsLink');
    const gradingLink = document.getElementById('gradingLink');
    const adminLink = document.getElementById('adminLink');
    
    // Mobile elements
    const mobileEvilTriviaStatus = document.getElementById('mobileEvilTriviaStatus');
    const mobilePatreonStatus = document.getElementById('mobilePatreonStatus');
    const mobileToolsLink = document.getElementById('mobileToolsLink');
    const mobileGradingLink = document.getElementById('mobileGradingLink');
    const mobileAdminLink = document.getElementById('mobileAdminLink');
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const mobileMenu = document.getElementById('mobileMenu');

    // Hamburger menu toggle
    hamburgerMenu.addEventListener('click', function() {
        mobileMenu.classList.toggle('active');
    });

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
                            mobileEvilTriviaStatus.textContent = userData.firstName;
                        } else if (user.displayName) {
                            evilTriviaStatus.textContent = user.displayName.split(' ')[0];
                            mobileEvilTriviaStatus.textContent = user.displayName.split(' ')[0];
                        } else {
                            evilTriviaStatus.textContent = user.email ? user.email.split('@')[0] : 'Logged In';
                            mobileEvilTriviaStatus.textContent = user.email ? user.email.split('@')[0] : 'Logged In';
                        }

                        // Get user roles - handle both new array format and legacy string format
                        let userRoles = [];
                        if (userData?.roles && Array.isArray(userData.roles)) {
                            userRoles = userData.roles;
                        } else if (userData?.role && typeof userData.role === 'string') {
                            userRoles = [userData.role];
                        }
                        
                        // Show/hide links based on roles per requirements:
                        // Home, Live Trivia, Games = all roles (always shown)
                        // Grading = admin, grader
                        // Tools = admin, tools
                        // Admin = admin
                        
                        const isAdmin = userRoles.includes('admin');
                        const isGrader = userRoles.includes('grader');
                        const hasToolsAccess = userRoles.includes('tools');
                        
                        // Admin link - only for admins
                        adminLink.style.display = isAdmin ? 'inline' : 'none';
                        mobileAdminLink.style.display = isAdmin ? 'block' : 'none';
                        
                        // Grading link - for admins and graders
                        gradingLink.style.display = (isAdmin || isGrader) ? 'inline' : 'none';
                        mobileGradingLink.style.display = (isAdmin || isGrader) ? 'block' : 'none';
                        
                        // Tools link - for admins and those with tools access
                        toolsLink.style.display = (isAdmin || hasToolsAccess) ? 'inline' : 'none';
                        mobileToolsLink.style.display = (isAdmin || hasToolsAccess) ? 'block' : 'none';

                        // Check if user has 'patron' role - if so, that's also a connection to Patreon
                        if (userData?.patreonId || userRoles.includes('patron')) {
                            try {
                                // First try to get the Patreon tier information from the user's record
                                if (userData?.patreonId) {
                                    // Try to get the actual tier information from patreonUsers collection
                                    const patreonSnapshot = await get(ref(db, `patreonUsers/${userData.patreonId}`));
                                    const patreonData = patreonSnapshot.val();
                                    
                                    if (patreonData?.entitledTiers && Array.isArray(patreonData.entitledTiers)) {
                                        console.log("Looking for tier ID 24216420 in entitledTiers");
                                        
                                        // Check if the specific tier ID 24216420 exists in the numeric indices
                                        let bigLemonFound = false;
                                        for (let i = 0; i < patreonData.entitledTiers.length; i++) {
                                            const tier = patreonData.entitledTiers[i];
                                            if (tier && tier.id && tier.id === "24216420" && tier.attributes && tier.attributes.title) {
                                                console.log(`Found Big Lemon tier at index ${i}:`, tier.attributes.title);
                                                patreonStatus.textContent = tier.attributes.title;
                                                mobilePatreonStatus.textContent = tier.attributes.title;
                                                bigLemonFound = true;
                                                break;
                                            }
                                        }
                                        
                                        if (bigLemonFound) {
                                            console.log("Successfully displayed Big Lemon tier");
                                            return;
                                        }
                                        
                                        // If Big Lemon not found, continue with existing code
                                        // Look specifically for the "The Big Lemon" tier with ID 24216420
                                        const bigLemonTier = patreonData.entitledTiers.find(tier => 
                                            tier.id === "24216420"
                                        );
                                        
                                        // If found, use it
                                        if (bigLemonTier && bigLemonTier.attributes?.title) {
                                            patreonStatus.textContent = bigLemonTier.attributes.title;
                                            mobilePatreonStatus.textContent = bigLemonTier.attributes.title;
                                            console.log(`Banner showing The Big Lemon tier: ${bigLemonTier.attributes.title}`);
                                            return;
                                        }
                                    }
                                }
                                
                                // Fallback: If we couldn't get tier info, but have pledge amount, use that
                                if (userData?.patreonPledgeAmount) {
                                    patreonStatus.textContent = `$${userData.patreonPledgeAmount}`;
                                    mobilePatreonStatus.textContent = `$${userData.patreonPledgeAmount}`;
                                } else {
                                    patreonStatus.textContent = 'Connected';
                                    mobilePatreonStatus.textContent = 'Connected';
                                }
                            } catch (error) {
                                console.error("Error getting Patreon tier data:", error);
                                // Fallback to basic info on error
                                patreonStatus.textContent = 'Connected';
                                mobilePatreonStatus.textContent = 'Connected';
                            }
                        } else {
                            // Check localStorage as fallback
                            const patreonId = localStorage.getItem('patreonUserId');
                            if (patreonId) {
                                try {
                                    // Try to get the patreon tier info from the database
                                    const patreonSnapshot = await get(ref(db, `patreonUsers/${patreonId}`));
                                    const patreonData = patreonSnapshot.val();
                                    
                                    if (patreonData?.entitledTiers && Array.isArray(patreonData.entitledTiers)) {
                                        console.log("Looking for tier ID 24216420 in entitledTiers");
                                        
                                        // Check if the specific tier ID 24216420 exists in the numeric indices
                                        let bigLemonFound = false;
                                        for (let i = 0; i < patreonData.entitledTiers.length; i++) {
                                            const tier = patreonData.entitledTiers[i];
                                            if (tier && tier.id && tier.id === "24216420" && tier.attributes && tier.attributes.title) {
                                                console.log(`Found Big Lemon tier at index ${i}:`, tier.attributes.title);
                                                patreonStatus.textContent = tier.attributes.title;
                                                mobilePatreonStatus.textContent = tier.attributes.title;
                                                bigLemonFound = true;
                                                break;
                                            }
                                        }
                                        
                                        if (bigLemonFound) {
                                            console.log("Successfully displayed Big Lemon tier");
                                            return;
                                        }
                                        
                                        // If Big Lemon not found, continue with existing code
                                        // Look specifically for the "The Big Lemon" tier with ID 24216420
                                        const bigLemonTier = patreonData.entitledTiers.find(tier => 
                                            tier.id === "24216420"
                                        );
                                        
                                        // If found, use it
                                        if (bigLemonTier && bigLemonTier.attributes?.title) {
                                            patreonStatus.textContent = bigLemonTier.attributes.title;
                                            mobilePatreonStatus.textContent = bigLemonTier.attributes.title;
                                            console.log(`Banner showing The Big Lemon tier: ${bigLemonTier.attributes.title}`);
                                            return;
                                        }
                                    }
                                    
                                    // Fallback to pledge amount
                                    if (patreonData?.pledgeAmountDollars) {
                                        patreonStatus.textContent = `$${patreonData.pledgeAmountDollars}`;
                                        mobilePatreonStatus.textContent = `$${patreonData.pledgeAmountDollars}`;
                                        return;
                                    }
                                } catch (error) {
                                    console.error("Error getting Patreon tier data from localStorage ID:", error);
                                }
                                
                                // Fallback to localStorage pledge amount
                                const pledgeAmount = localStorage.getItem('patreonPledgeAmount');
                                if (pledgeAmount) {
                                    patreonStatus.textContent = `$${pledgeAmount}`;
                                    mobilePatreonStatus.textContent = `$${pledgeAmount}`;
                                } else {
                                    patreonStatus.textContent = 'Connected';
                                    mobilePatreonStatus.textContent = 'Connected';
                                }
                            } else {
                                patreonStatus.textContent = 'Not Connected';
                                mobilePatreonStatus.textContent = 'Not Connected';
                            }
                        }
                    } catch (error) {
                        console.error("Banner error fetching user data:", error);
                        evilTriviaStatus.textContent = 'Logged In';
                        mobileEvilTriviaStatus.textContent = 'Logged In';
                        patreonStatus.textContent = 'Not Connected';
                        mobilePatreonStatus.textContent = 'Not Connected';
                    }
                } else {
                    console.log("Banner sees user is signed out");
                    evilTriviaStatus.textContent = 'Not Logged In';
                    mobileEvilTriviaStatus.textContent = 'Not Logged In';
                    
                    // Hide admin and grading links when signed out
                    gradingLink.style.display = 'none';
                    adminLink.style.display = 'none';
                    toolsLink.style.display = 'none';
                    mobileGradingLink.style.display = 'none';
                    mobileAdminLink.style.display = 'none';
                    mobileToolsLink.style.display = 'none';
                    
                    // Check for Patreon ID in localStorage even when not signed in
                    const patreonId = localStorage.getItem('patreonUserId');
                    if (patreonId) {
                        patreonStatus.textContent = 'Connected';
                        mobilePatreonStatus.textContent = 'Connected';
                    } else {
                        patreonStatus.textContent = 'Not Connected';
                        mobilePatreonStatus.textContent = 'Not Connected';
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