// Create and inject banner as soon as possible
if (document.title !== "Oops!") {
    // Create script element
    const script = document.createElement('script');
    
    // Always use absolute path
    script.src = '/js/components/banner.js';
    
    // Add it to the head
    document.head.appendChild(script);
} 