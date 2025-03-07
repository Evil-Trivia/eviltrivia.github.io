// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBruAY3SH0eO000LrYqwcOGXNaUuznoMkc",
    authDomain: "eviltrivia-47664.firebaseapp.com",
    databaseURL: "https://eviltrivia-47664-default-rtdb.firebaseio.com",
    projectId: "eviltrivia-47664",
    storageBucket: "eviltrivia-47664.firebaseapp.com",
    messagingSenderId: "401826818140",
    appId: "1:401826818140:web:c1df0bf4c602cc48231e99",
    measurementId: "G-2W6RK96Y34"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
const app = initializeApp(firebaseConfig);

// Load banner
if (document.title !== "Oops!") {
    const script = document.createElement('script');
    script.src = '/banner.js';
    document.head.appendChild(script);
}

export { app }; 