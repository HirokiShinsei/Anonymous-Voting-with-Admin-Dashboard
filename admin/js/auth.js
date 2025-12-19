import { supabase } from '../../js/supabase.js';

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initialized = false;
    }

    /**
     * Initialize auth state and set up session listener
     */
    async init() {
        if (this.initialized) return;

        // Get initial session
        const { data: { session } } = await supabase.auth.getSession();
        this.currentUser = session?.user || null;

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, session) => {
            this.currentUser = session?.user || null;
            
            if (event === 'SIGNED_OUT') {
                this.handleSignOut();
            }
        });

        this.initialized = true;
    }

    /**
     * Sign in with email and password
     */
    async signIn(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.currentUser = data.user;
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Sign in error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            this.currentUser = null;
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Handle sign out redirect
     */
    handleSignOut() {
        if (window.location.pathname.includes('/admin/') && 
            !window.location.pathname.includes('/admin/index.html')) {
            window.location.href = '/admin/index.html';
        }
    }

    /**
     * Route guard - redirect to login if not authenticated
     */
    async requireAuth() {
        await this.init();

        if (!this.isAuthenticated()) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/admin/index.html?return=${returnUrl}`;
            return false;
        }

        return true;
    }

    /**
     * Redirect authenticated users away from login page
     */
    async redirectIfAuthenticated(defaultPage = '/admin/dashboard.html') {
        await this.init();

        // Only redirect if user is actually authenticated
        if (this.isAuthenticated()) {
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return');
            const targetUrl = returnUrl ? decodeURIComponent(returnUrl) : defaultPage;
            
            // Only redirect if not already on the target page
            if (window.location.pathname !== targetUrl) {
                window.location.href = targetUrl;
                return true;
            }
        }

        return false;
    }
}

// Export singleton instance
export const authManager = new AuthManager();
