/**
 * Supabase API integration layer
 * Handles candidate fetching, voter registration, and vote submission
 */

import { SUPABASE_CONFIG } from './config.js';
import { supabase } from './supabase.js';

// Configuration
const SUPABASE_URL = SUPABASE_CONFIG.url || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey || 'your-anon-key';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Base delay in ms

// Mock mode toggle for development
let MOCK_MODE = !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey;

/**
 * Enable or disable mock mode
 * @param {boolean} enabled - Whether to enable mock mode
 */
export function setMockMode(enabled) {
    MOCK_MODE = enabled;
}

/**
 * Mock data for development
 */
const MOCK_DATA = {
    candidates: [
        { id: 1, name: 'Alice Johnson', description: 'Experienced leader', image_url: '' },
        { id: 2, name: 'Bob Smith', description: 'Innovation focused', image_url: '' },
        { id: 3, name: 'Carol Davis', description: 'Community advocate', image_url: '' }
    ],
    voters: new Set(),
    votes: []
};

/**
 * Custom error class for API errors
 */
class ApiError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP request with retry logic
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, retryCount = 0) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
                ...options.headers
            }
        });

        // Don't retry client errors (4xx except 429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            return response;
        }

        // Retry on server errors or rate limit
        if (!response.ok && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
            await sleep(delay);
            return fetchWithRetry(url, options, retryCount + 1);
        }

        return response;
    } catch (error) {
        // Retry on network errors
        if (retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * Math.pow(2, retryCount);
            await sleep(delay);
            return fetchWithRetry(url, options, retryCount + 1);
        }
        throw error;
    }
}

/**
 * Map HTTP status to user-friendly error
 * @param {number} status - HTTP status code
 * @param {Object} data - Response data
 * @returns {ApiError}
 */
function mapError(status, data) {
    switch (status) {
        case 409:
            return new ApiError('You have already voted', status, 'ALREADY_VOTED');
        case 422:
            return new ApiError('Invalid request data', status, 'INVALID_DATA');
        case 429:
            return new ApiError('Too many requests. Please try again later', status, 'RATE_LIMIT');
        case 500:
        case 502:
        case 503:
            return new ApiError('Server error. Please try again', status, 'SERVER_ERROR');
        default:
            return new ApiError(data?.message || 'An error occurred', status, 'UNKNOWN_ERROR');
    }
}

/**
 * Fetch all candidates from Supabase
 * @returns {Promise<Array>} Array of candidate objects
 */
export async function fetchCandidates() {
    if (MOCK_MODE) {
        await sleep(300); // Simulate network delay
        return [...MOCK_DATA.candidates];
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/candidates?select=*&order=id.asc`;
        const response = await fetchWithRetry(url, { method: 'GET' });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw mapError(response.status, data);
        }

        const candidates = await response.json();
        return candidates;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('Failed to fetch candidates', 0, 'NETWORK_ERROR');
    }
}

/**
 * Ensure voter exists in database (create if not exists)
 * @param {string} fingerprint - Hashed device fingerprint
 * @returns {Promise<Object>} Voter object
 */
export async function ensureVoter(fingerprint) {
    if (MOCK_MODE) {
        await sleep(200);
        if (MOCK_DATA.voters.has(fingerprint)) {
            return { id: fingerprint, fingerprint, created_at: new Date().toISOString() };
        }
        MOCK_DATA.voters.add(fingerprint);
        return { id: fingerprint, fingerprint, created_at: new Date().toISOString() };
    }

    try {
        // First, try to get existing voter
        const getUrl = `${SUPABASE_URL}/rest/v1/voters?fingerprint=eq.${fingerprint}&select=*`;
        const getResponse = await fetchWithRetry(getUrl, { method: 'GET' });

        if (getResponse.ok) {
            const voters = await getResponse.json();
            if (voters.length > 0) {
                return voters[0];
            }
        }

        // If not found, create new voter
        const createUrl = `${SUPABASE_URL}/rest/v1/voters`;
        const createResponse = await fetchWithRetry(createUrl, {
            method: 'POST',
            body: JSON.stringify({ fingerprint })
        });

        if (!createResponse.ok) {
            const data = await createResponse.json().catch(() => ({}));
            throw mapError(createResponse.status, data);
        }

        const newVoters = await createResponse.json();
        return newVoters[0];
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('Failed to register voter', 0, 'NETWORK_ERROR');
    }
}

/**
 * Submit vote for a candidate
 * @param {string} voterId - Voter ID
 * @param {number} candidateId - Candidate ID
 * @returns {Promise<Object>} Vote confirmation object
 */
export async function submitVote(voterId, candidateId) {
    if (MOCK_MODE) {
        await sleep(400);
        
        // Check if already voted
        const existingVote = MOCK_DATA.votes.find(v => v.voter_id === voterId);
        if (existingVote) {
            throw new ApiError('You have already voted', 409, 'ALREADY_VOTED');
        }

        // Validate candidate
        const candidate = MOCK_DATA.candidates.find(c => c.id === candidateId);
        if (!candidate) {
            throw new ApiError('Invalid candidate', 422, 'INVALID_DATA');
        }

        const vote = {
            id: Date.now(),
            voter_id: voterId,
            candidate_id: candidateId,
            created_at: new Date().toISOString()
        };
        MOCK_DATA.votes.push(vote);
        return vote;
    }

    try {
        const url = `${SUPABASE_URL}/rest/v1/votes`;
        const response = await fetchWithRetry(url, {
            method: 'POST',
            body: JSON.stringify({
                voter_id: voterId,
                candidate_id: candidateId
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw mapError(response.status, data);
        }

        const votes = await response.json();
        return votes[0];
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('Failed to submit vote', 0, 'NETWORK_ERROR');
    }
}

/**
 * Check if voting is currently open
 */
async function isVotingOpen() {
    try {
        const { data, error } = await supabase
            .from('elections')
            .select('is_open')
            .eq('is_open', true)
            .single();

        if (error) {
            // If no open election found, voting is closed
            if (error.code === 'PGRST116') {
                return { success: true, isOpen: false };
            }
            throw error;
        }

        return { success: true, isOpen: data?.is_open || false };
    } catch (error) {
        console.error('Error checking voting status:', error);
        return { success: false, error: error.message, isOpen: false };
    }
}

/**
 * Get current open election
 */
async function getCurrentElection() {
    try {
        const { data, error } = await supabase
            .from('elections')
            .select('*')
            .eq('is_open', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: true, data: null }; // No open election
            }
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error fetching current election:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check if mock mode is enabled
 * @returns {boolean}
 */
export function isMockMode() {
    return MOCK_MODE;
}

/**
 * Exported functions
 */
export { 
    fetchCandidates,
    ensureVoter,
    submitVote,
    isMockMode,
    setMockMode,
    isVotingOpen,
    getCurrentElection
};
