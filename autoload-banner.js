// Create and inject banner as soon as possible
if (document.title !== "Oops!") {
    // Create script element
    const script = document.createElement('script');
    
    // Use relative path instead of absolute URL
    script.src = '/banner.js';
    
    // Add it to the head
    document.head.appendChild(script);
} 