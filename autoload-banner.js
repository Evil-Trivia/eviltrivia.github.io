// Only run if we're not on the 404 page
if (document.title !== "Oops!") {
    // Create script element with absolute path
    const script = document.createElement('script');
    
    // Use absolute path starting from domain root
    script.src = 'https://eviltrivia.com/banner.js';
    // Or alternatively use root-relative path:
    // script.src = '/banner.js';
    
    // Add it to the head
    document.head.appendChild(script);
} 