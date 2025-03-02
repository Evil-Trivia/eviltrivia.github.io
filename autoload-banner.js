// Self-executing function to inject banner script
(function() {
    const bannerHTML = `
        <div id="siteBanner">
            <div class="banner-content">
                <a href="index.html" class="banner-logo">Evil Trivia</a>
                <nav class="banner-nav">
                    <a href="index.html">Home</a>
                    <a href="grading.html">Grading</a>
                    <a href="admin.html">Admin</a>
                </nav>
                <div class="banner-auth">
                    <a href="login.html" id="loginLink">Log In</a>
                    <button id="logoutBtn" style="display: none;">Log Out</button>
                </div>
            </div>
        </div>

        <style>
            #siteBanner {
                background: #000000;
                color: white;
                padding: 10px 20px;
                position: sticky;
                top: 0;
                z-index: 1000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .banner-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                max-width: 1200px;
                margin: 0 auto;
            }

            .banner-logo {
                font-size: 1.5em;
                font-weight: bold;
                color: #FFCC00;
                text-decoration: none;
            }

            .banner-nav {
                display: flex;
                gap: 20px;
            }

            .banner-nav a {
                color: white;
                text-decoration: none;
                padding: 5px 10px;
            }

            .banner-nav a:hover {
                color: #FFCC00;
            }

            .banner-auth {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .banner-auth a, .banner-auth button {
                color: white;
                text-decoration: none;
                padding: 5px 15px;
                border-radius: 4px;
                border: 1px solid white;
            }

            .banner-auth a:hover, .banner-auth button:hover {
                background: white;
                color: black;
                cursor: pointer;
            }

            #logoutBtn {
                background: transparent;
            }
        </style>
    `;

    // Function to inject banner
    function injectBanner() {
        if (!document.getElementById('siteBanner')) {
            document.body.insertAdjacentHTML('afterbegin', bannerHTML);
        }
    }

    // Handle auth state changes
    function setupAuth() {
        if (typeof firebase !== 'undefined') {
            const auth = firebase.auth();
            const loginLink = document.getElementById('loginLink');
            const logoutBtn = document.getElementById('logoutBtn');

            auth.onAuthStateChanged((user) => {
                if (user) {
                    loginLink.style.display = 'none';
                    logoutBtn.style.display = 'block';
                } else {
                    loginLink.style.display = 'block';
                    logoutBtn.style.display = 'none';
                }
            });

            logoutBtn.addEventListener('click', () => {
                auth.signOut().then(() => {
                    window.location.href = 'login.html';
                }).catch((error) => {
                    console.error('Error signing out:', error);
                });
            });
        }
    }

    // Try to inject as soon as possible
    if (document.body) {
        injectBanner();
        setupAuth();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            injectBanner();
            setupAuth();
        });
    }
})(); 