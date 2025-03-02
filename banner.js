// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Simple banner HTML
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
        <div>
            <a href="login.html" id="loginLink" style="color: white; text-decoration: none;">Log In</a>
            <button id="logoutBtn" style="display: none; background: transparent; color: white; border: 1px solid white; padding: 5px 15px; cursor: pointer;">Log Out</button>
        </div>
    </div>
    `;

    // Only inject banner if we're not on the 404 page
    if (document.title !== "Oops!") {
        document.body.insertAdjacentHTML('afterbegin', bannerHTML);
        
        // Handle auth state changes
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
}); 