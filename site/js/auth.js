// Simple authentication manager for admin portal
class AuthManager {
    constructor() {
        this.storageKey = 'voting_admin_auth';
        this.apiBase = this.getApiBase();
    }

    getApiBase() {
        // Try to get from environment or use default
        return window.VOTING_API_BASE || 'https://your-api-endpoint.com/api';
    }

    async signIn(email, password) {
        try {
            const response = await fetch(`${this.apiBase}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.message || 'Login failed' };
            }

            const data = await response.json();
            
            // Store auth token
            localStorage.setItem(this.storageKey, JSON.stringify({
                token: data.token,
                user: data.user,
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            }));

            return { success: true, data };
        } catch (error) {
            console.error('Sign in error:', error);
            return { 
                success: false, 
                error: 'Unable to connect to server. Please check your connection.' 
            };
        }
    }

    async redirectIfAuthenticated(dashboardUrl) {
        const auth = this.getAuth();
        if (auth && auth.token) {
            // Verify token is still valid
            if (Date.now() < auth.expiresAt) {
                window.location.href = dashboardUrl;
            } else {
                this.signOut();
            }
        }
    }

    getAuth() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    signOut() {
        localStorage.removeItem(this.storageKey);
    }

    isAuthenticated() {
        const auth = this.getAuth();
        return auth && auth.token && Date.now() < auth.expiresAt;
    }

    getToken() {
        const auth = this.getAuth();
        return auth?.token;
    }
}

export const authManager = new AuthManager();
