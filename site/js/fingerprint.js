/**
 * Device fingerprinting module using Web Crypto API
 * Collects browser signals and generates SHA-256 hash
 */

/**
 * Collect canvas fingerprint
 * @returns {string} Canvas data URL or empty string
 */
function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return '';
        
        canvas.width = 200;
        canvas.height = 50;
        
        // Draw text with specific styling
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('Fingerprint', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint', 4, 17);
        
        return canvas.toDataURL();
    } catch (e) {
        return '';
    }
}

/**
 * Collect browser and device signals
 * @returns {Object} Object containing all fingerprint signals
 */
function collectSignals() {
    const signals = {
        userAgent: navigator.userAgent || '',
        language: navigator.language || '',
        languages: navigator.languages ? navigator.languages.join(',') : '',
        platform: navigator.platform || '',
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        screenWidth: screen.width || 0,
        screenHeight: screen.height || 0,
        screenColorDepth: screen.colorDepth || 0,
        screenPixelDepth: screen.pixelDepth || 0,
        availWidth: screen.availWidth || 0,
        availHeight: screen.availHeight || 0,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        timezoneOffset: new Date().getTimezoneOffset(),
        canvas: getCanvasFingerprint(),
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || '',
        plugins: Array.from(navigator.plugins || []).map(p => p.name).join(','),
        webgl: getWebGLFingerprint()
    };
    
    return signals;
}

/**
 * Get WebGL fingerprint
 * @returns {string} WebGL renderer info or empty string
 */
function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return '';
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return '';
        
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        return `${vendor}~${renderer}`;
    } catch (e) {
        return '';
    }
}

/**
 * Generate SHA-256 hash from string
 * @param {string} message - String to hash
 * @returns {Promise<string>} Hex string of hash
 */
async function sha256Hash(message) {
    try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (e) {
        console.error('SHA-256 hashing failed:', e);
        // Fallback: simple string hash
        return fallbackHash(message);
    }
}

/**
 * Fallback hash function for browsers without crypto.subtle
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function fallbackHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Generate hashed fingerprint from browser signals
 * @returns {Promise<string>} SHA-256 hash of fingerprint
 */
export async function generateHashedFingerprint() {
    try {
        // Collect all signals
        const signals = collectSignals();
        
        // Create deterministic string from signals
        const fingerprintString = JSON.stringify(signals, Object.keys(signals).sort());
        
        // Generate SHA-256 hash
        const hashedFingerprint = await sha256Hash(fingerprintString);
        
        return hashedFingerprint;
    } catch (error) {
        console.error('Fingerprint generation failed:', error);
        
        // Fallback: use minimal signals
        const minimalSignals = {
            userAgent: navigator.userAgent || '',
            language: navigator.language || '',
            platform: navigator.platform || '',
            screenWidth: screen.width || 0,
            screenHeight: screen.height || 0,
            timezone: new Date().getTimezoneOffset()
        };
        
        const fallbackString = JSON.stringify(minimalSignals);
        return fallbackHash(fallbackString);
    }
}

/**
 * Check if fingerprinting is supported
 * @returns {boolean} True if crypto.subtle is available
 */
export function isFingerprintingSupported() {
    return !!(window.crypto && window.crypto.subtle);
}
