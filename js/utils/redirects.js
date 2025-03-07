// This script handles redirects from old file locations to new ones
// Add this to your HTML files that have been moved

const redirects = {
  '/account.html': '/pages/account.html',
  '/admin.html': '/pages/admin.html',
  '/grading.html': '/pages/grading.html',
  '/patreon.html': '/pages/patreon.html',
  '/partner.html': '/pages/partner.html',
  '/banner.js': '/js/components/banner.js',
  '/autoload-banner.js': '/js/components/autoload-banner.js',
  '/firebase-init.js': '/js/firebase/firebase-init.js',
  '/reset.css': '/css/reset.css',
  '/styles.css': '/css/styles.css'
};

// Check if the current path needs to be redirected
const currentPath = window.location.pathname;
if (redirects[currentPath]) {
  window.location.href = redirects[currentPath];
} 