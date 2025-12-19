/**
 * Main application UI logic
 * Handles rendering, user interactions, and state management
 */

import { generateHashedFingerprint } from './fingerprint.js';
import { fetchCandidates, ensureVoter, submitVote, isMockMode } from './api.js';

// Application state
const state = {
    candidates: [],
    selectedCandidateId: null,
    voterId: null,
    fingerprint: null,
    isLoading: false,
    hasVoted: false,
    error: null
};

/**
 * Initialize the application
 */
export async function init() {
    showSkeletonLoader();
    
    try {
        // Generate fingerprint
        state.fingerprint = await generateHashedFingerprint();
        
        // Ensure voter exists
        const voter = await ensureVoter(state.fingerprint);
        state.voterId = voter.id;
        
        // Fetch candidates
        state.candidates = await fetchCandidates();
        
        // Render UI
        renderCandidates();
        setupEventListeners();
        
        // Show mock mode indicator if enabled
        if (isMockMode()) {
            showMockModeIndicator();
        }
    } catch (error) {
        showError(error.message || 'Failed to load voting page');
    }
}

/**
 * Show skeleton loader
 */
function showSkeletonLoader() {
    const container = document.querySelector('.app-container');
    container.innerHTML = `
        <div class="loading-container">
            <div class="skeleton-header"></div>
            <div class="candidates-grid">
                ${Array(3).fill(0).map(() => `
                    <div class="skeleton-card">
                        <div class="skeleton-image"></div>
                        <div class="skeleton-title"></div>
                        <div class="skeleton-description"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Show mock mode indicator
 */
function showMockModeIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'mock-indicator';
    indicator.textContent = '🧪 Mock Mode';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    document.body.appendChild(indicator);
}

/**
 * Render candidates to the DOM
 */
function renderCandidates() {
    const container = document.querySelector('.app-container');
    
    container.innerHTML = `
        <header class="app-header">
            <h1>Cast Your Vote</h1>
            <p class="subtitle">Select a candidate to vote for</p>
        </header>
        
        <main class="main-content">
            <div class="candidates-grid" role="radiogroup" aria-label="Select a candidate">
                ${state.candidates.map((candidate, index) => `
                    <article 
                        class="candidate-card" 
                        data-candidate-id="${candidate.id}"
                        role="radio"
                        aria-checked="false"
                        tabindex="${index === 0 ? '0' : '-1'}"
                        aria-labelledby="candidate-name-${candidate.id}"
                        aria-describedby="candidate-desc-${candidate.id}"
                    >
                        <div class="card-inner">
                            ${candidate.image_url ? `
                                <img 
                                    src="${candidate.image_url}" 
                                    alt="${candidate.name}"
                                    class="candidate-image"
                                />
                            ` : `
                                <div class="candidate-placeholder" aria-hidden="true">
                                    ${getInitials(candidate.name)}
                                </div>
                            `}
                            <h2 class="candidate-name" id="candidate-name-${candidate.id}">
                                ${candidate.name}
                            </h2>
                            <p class="candidate-description" id="candidate-desc-${candidate.id}">
                                ${candidate.description || 'No description available'}
                            </p>
                            <div class="selection-indicator" aria-hidden="true">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                    <circle cx="12" cy="12" r="5" fill="currentColor" class="inner-circle"/>
                                </svg>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
            
            <div class="error-container" role="alert" aria-live="assertive" style="display: none;"></div>
        </main>
        
        <footer class="sticky-footer">
            <button 
                class="submit-button" 
                disabled
                aria-label="Submit your vote"
            >
                Submit Vote
            </button>
        </footer>
    `;
}

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials
 */
function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    const cards = document.querySelectorAll('.candidate-card');
    const submitButton = document.querySelector('.submit-button');
    
    // Card click handlers
    cards.forEach(card => {
        card.addEventListener('click', () => selectCandidate(card));
        card.addEventListener('keydown', handleKeyboardNavigation);
    });
    
    // Submit button handler
    submitButton.addEventListener('click', handleSubmit);
}

/**
 * Handle keyboard navigation
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyboardNavigation(event) {
    const cards = Array.from(document.querySelectorAll('.candidate-card'));
    const currentIndex = cards.indexOf(event.currentTarget);
    
    let nextIndex = currentIndex;
    
    switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
            event.preventDefault();
            nextIndex = (currentIndex + 1) % cards.length;
            break;
        case 'ArrowUp':
        case 'ArrowLeft':
            event.preventDefault();
            nextIndex = (currentIndex - 1 + cards.length) % cards.length;
            break;
        case 'Enter':
        case ' ':
            event.preventDefault();
            selectCandidate(event.currentTarget);
            return;
        case 'Home':
            event.preventDefault();
            nextIndex = 0;
            break;
        case 'End':
            event.preventDefault();
            nextIndex = cards.length - 1;
            break;
        default:
            return;
    }
    
    // Update focus
    cards[currentIndex].tabIndex = -1;
    cards[nextIndex].tabIndex = 0;
    cards[nextIndex].focus();
}

/**
 * Select a candidate card (radio behavior)
 * @param {HTMLElement} card - Candidate card element
 */
function selectCandidate(card) {
    const candidateId = parseInt(card.dataset.candidateId);
    
    // Deselect all cards
    document.querySelectorAll('.candidate-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
    });
    
    // Select clicked card
    card.classList.add('selected');
    card.setAttribute('aria-checked', 'true');
    
    state.selectedCandidateId = candidateId;
    
    // Enable submit button
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = false;
}

/**
 * Handle vote submission
 */
async function handleSubmit() {
    if (!state.selectedCandidateId || state.isLoading) return;
    
    const submitButton = document.querySelector('.submit-button');
    const originalText = submitButton.textContent;
    
    state.isLoading = true;
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span class="spinner" aria-hidden="true"></span>
        Submitting...
    `;
    
    try {
        await submitVote(state.voterId, state.selectedCandidateId);
        state.hasVoted = true;
        showConfirmationScreen();
    } catch (error) {
        state.isLoading = false;
        submitButton.disabled = false;
        submitButton.textContent = originalText;
        
        if (error.code === 'ALREADY_VOTED') {
            showConfirmationScreen(true);
        } else {
            showError(error.message || 'Failed to submit vote');
        }
    }
}

/**
 * Show confirmation screen
 * @param {boolean} alreadyVoted - Whether user already voted
 */
function showConfirmationScreen(alreadyVoted = false) {
    const selectedCandidate = state.candidates.find(c => c.id === state.selectedCandidateId);
    const container = document.querySelector('.app-container');
    
    container.innerHTML = `
        <div class="confirmation-screen">
            <div class="confirmation-content">
                <div class="success-icon" aria-hidden="true">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <circle cx="40" cy="40" r="38" stroke="currentColor" stroke-width="4"/>
                        <path d="M25 40L35 50L55 30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                
                <h1>${alreadyVoted ? 'Already Voted' : 'Vote Submitted!'}</h1>
                
                <p class="confirmation-message">
                    ${alreadyVoted 
                        ? 'Your vote has already been recorded. Thank you for participating!' 
                        : `Thank you for voting${selectedCandidate ? ' for ' + selectedCandidate.name : ''}!`
                    }
                </p>
                
                <p class="privacy-note">
                    Your vote is anonymous and secure. Results will not be displayed to protect voter privacy.
                </p>
            </div>
        </div>
    `;
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorContainer = document.querySelector('.error-container');
    if (!errorContainer) return;
    
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorContainer.style.display = 'none';
    }, 5000);
}
