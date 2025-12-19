import { authManager } from './auth.js';

// Redirect if already logged in
await authManager.redirectIfAuthenticated();

// Handle login form
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const result = await authManager.signIn(email, password);
    
    if (result.success) {
        // Will redirect automatically via redirectIfAuthenticated
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('return') || '/admin/dashboard.html';
        window.location.href = decodeURIComponent(returnUrl);
    } else {
        // Show error message
        alert('Login failed: ' + result.error);
    }
});

// In any admin page
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await authManager.signOut();
    // Automatic redirect to login handled by handleSignOut
});
