import { authManager } from './auth.js';
import { adminAPI } from './api.js';

// State
let currentElection = null;
let allElections = [];
let isSessionOpen = false;
let candidates = [];
let resultsRefreshInterval = null;
let votesSubscription = null;
let editingCandidateId = null;

// Initialize dashboard
async function init() {
    // Set user email
    const user = authManager.getCurrentUser();
    if (user) {
        document.getElementById('userEmail').textContent = user.email;
    }

    // Setup event listeners first
    setupEventListeners();

    // Load all elections and populate dropdown
    await loadAllElections();

    // Load data for selected election
    if (currentElection) {
        await loadCandidates();
        await loadResults();
        startResultsAutoRefresh();
        subscribeToLiveVotes();
    }
}

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await authManager.signOut();
    });

    // Election selector
    document.getElementById('electionSelect').addEventListener('change', handleElectionChange);

    // Election creation
    document.getElementById('createElectionBtn').addEventListener('click', openElectionModal);
    document.getElementById('electionForm').addEventListener('submit', handleElectionSubmit);
    document.getElementById('electionCancelBtn').addEventListener('click', closeElectionModal);

    // Session controls
    document.getElementById('startVotingBtn').addEventListener('click', () => {
        showConfirmModal(
            'Start Voting Session',
            'Are you sure you want to start voting? Candidate management will be disabled during the session. Voters will be able to vote for ALL positions in one go.',
            () => toggleSession(true)
        );
    });

    document.getElementById('endVotingBtn').addEventListener('click', () => {
        showConfirmModal(
            'End Voting Session',
            '⚠️ WARNING: This action is irreversible. Are you absolutely sure you want to end voting? No more votes can be cast after this.',
            () => toggleSession(false),
            true
        );
    });

    document.getElementById('exportResultsBtn').addEventListener('click', exportResults);

    // Candidate management
    document.getElementById('addCandidateBtn').addEventListener('click', () => {
        openCandidateModal();
    });

    document.getElementById('candidateForm').addEventListener('submit', handleCandidateSubmit);
    document.getElementById('candidateCancelBtn').addEventListener('click', closeCandidateModal);

    // Modals
    document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
    
    // Close modals on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeConfirmModal();
                closeCandidateModal();
            }
        });
    });
}

// Election Management
async function loadAllElections() {
    const result = await adminAPI.getAllElections();
    
    if (result.success && result.data && result.data.length > 0) {
        allElections = result.data;
        populateElectionDropdown();
        
        // Select the most recent election by default
        currentElection = allElections[0];
        isSessionOpen = currentElection.is_open;
        updateElectionUI();
    } else {
        document.getElementById('electionSelect').innerHTML = 
            '<option value="">No elections found</option>';
        document.getElementById('sessionBadge').textContent = 'No Election';
        document.getElementById('sessionBadge').className = 'session-badge closed';
    }
}

function populateElectionDropdown() {
    const dropdown = document.getElementById('electionSelect');
    
    dropdown.innerHTML = allElections.map(election => {
        const status = election.is_open ? '🟢 LIVE' : '🔴 CLOSED';
        const date = new Date(election.created_at).toLocaleDateString();
        return `<option value="${election.id}">${election.title} - ${status} (${date})</option>`;
    }).join('');
    
    // Set selected value to current election
    if (currentElection) {
        dropdown.value = currentElection.id;
    }
}

async function handleElectionChange(e) {
    const electionId = e.target.value;
    
    if (!electionId) return;
    
    // Cleanup previous subscriptions
    if (resultsRefreshInterval) {
        clearInterval(resultsRefreshInterval);
        resultsRefreshInterval = null;
    }
    if (votesSubscription) {
        adminAPI.unsubscribe(votesSubscription);
        votesSubscription = null;
    }
    
    // Load new election
    const election = allElections.find(e => e.id === electionId);
    if (election) {
        currentElection = election;
        isSessionOpen = currentElection.is_open;
        updateElectionUI();
        
        // Reload data for selected election
        await loadCandidates();
        await loadResults();
        
        // Always restart auto-refresh and subscriptions for admin
        startResultsAutoRefresh();
        subscribeToLiveVotes();
    }
}

function updateElectionUI() {
    // Update session badge
    const badge = document.getElementById('sessionBadge');
    badge.textContent = isSessionOpen ? 'Voting Open' : 'Voting Closed';
    badge.className = `session-badge ${isSessionOpen ? 'open' : 'closed'}`;

    // Update button states
    document.getElementById('startVotingBtn').disabled = isSessionOpen;
    document.getElementById('endVotingBtn').disabled = !isSessionOpen;
    document.getElementById('addCandidateBtn').disabled = isSessionOpen;

    // Show/hide warning
    document.getElementById('sessionWarning').classList.toggle('hidden', !isSessionOpen);

    // Update candidate action buttons
    document.querySelectorAll('.btn-edit, .btn-delete').forEach(btn => {
        btn.disabled = isSessionOpen;
    });
}

async function toggleSession(open) {
    const result = await adminAPI.toggleElectionStatus(currentElection.id, open);
    
    if (result.success) {
        isSessionOpen = open;
        currentElection = result.data;
        updateElectionUI();
        
        // Refresh the dropdown to show updated status
        await loadAllElections();
        
        // Refresh results immediately when session changes
        await loadResults();
    } else {
        alert('Failed to update session: ' + result.error);
    }
    
    closeConfirmModal();
}

// Candidate Management
async function loadCandidates() {
    if (!currentElection) {
        document.getElementById('candidatesList').innerHTML = 
            '<div class="loading-state">No election selected</div>';
        return;
    }

    const result = await adminAPI.getCandidatesByPosition(currentElection.id);
    
    if (result.success) {
        candidates = Object.values(result.data).flat();
        renderCandidatesByPosition(result.data);
    } else {
        document.getElementById('candidatesList').innerHTML = 
            '<div class="loading-state">Failed to load candidates</div>';
    }
}

function renderCandidatesByPosition(groupedCandidates) {
    const container = document.getElementById('candidatesList');
    
    if (Object.keys(groupedCandidates).length === 0) {
        container.innerHTML = '<div class="loading-state">No candidates yet. Add your first candidate!</div>';
        return;
    }

    container.innerHTML = Object.entries(groupedCandidates).map(([position, candidateList]) => `
        <div class="position-group" style="margin-bottom: 1.5rem;">
            <h3 style="color: white; font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; padding-left: 0.5rem; border-left: 3px solid #DA291C;">
                ${escapeHtml(position)}
            </h3>
            ${candidateList.map(candidate => `
                <div class="candidate-card">
                    <div class="candidate-info">
                        <h4>${escapeHtml(candidate.name)}</h4>
                        <p>${escapeHtml(candidate.description || 'No description')}</p>
                    </div>
                    <div class="candidate-actions">
                        <button class="btn-edit" onclick="window.editCandidate('${candidate.id}')" ${isSessionOpen ? 'disabled' : ''}>
                            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                        </button>
                        <button class="btn-delete" onclick="window.deleteCandidate('${candidate.id}')" ${isSessionOpen ? 'disabled' : ''}>
                            <svg class="btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

window.editCandidate = function(id) {
    const candidate = candidates.find(c => c.id === id);
    if (candidate) {
        editingCandidateId = id;
        openCandidateModal(candidate);
    }
};

window.deleteCandidate = function(id) {
    const candidate = candidates.find(c => c.id === id);
    showConfirmModal(
        'Delete Candidate',
        `Are you sure you want to delete ${candidate.name}? This action cannot be undone.`,
        async () => {
            const result = await adminAPI.deleteCandidate(id);
            if (result.success) {
                await loadCandidates();
                await loadResults();
            } else {
                alert('Failed to delete candidate: ' + result.error);
            }
            closeConfirmModal();
        }
    );
};

function openCandidateModal(candidate = null) {
    editingCandidateId = candidate?.id || null;
    
    document.getElementById('candidateModalTitle').textContent = 
        candidate ? 'Edit Candidate' : 'Add Candidate';
    
    document.getElementById('candidateName').value = candidate?.name || '';
    document.getElementById('candidatePosition').value = candidate?.position || '';
    document.getElementById('candidateDescription').value = candidate?.description || '';
    
    document.getElementById('candidateModal').classList.remove('hidden');
}

function closeCandidateModal() {
    document.getElementById('candidateModal').classList.add('hidden');
    document.getElementById('candidateForm').reset();
    editingCandidateId = null;
}

async function handleCandidateSubmit(e) {
    e.preventDefault();
    
    if (!currentElection) {
        alert('No election selected');
        return;
    }
    
    const candidateData = {
        name: document.getElementById('candidateName').value.trim(),
        position: document.getElementById('candidatePosition').value.trim(),
        description: document.getElementById('candidateDescription').value.trim()
    };

    // Validate
    if (!candidateData.name || !candidateData.position) {
        alert('Please fill in all required fields');
        return;
    }

    let result;
    try {
        if (editingCandidateId) {
            result = await adminAPI.updateCandidate(editingCandidateId, candidateData);
        } else {
            result = await adminAPI.createCandidate(currentElection.id, candidateData);
        }

        if (result.success) {
            closeCandidateModal();
            await loadCandidates();
            await loadResults();
        } else {
            alert('Failed to save candidate: ' + result.error);
        }
    } catch (error) {
        console.error('Error saving candidate:', error);
        alert('An error occurred while saving the candidate');
    }
}

// Results Management
async function loadResults() {
    if (!currentElection) {
        document.getElementById('resultsContainer').innerHTML = 
            '<div class="loading-state">No election selected</div>';
        return;
    }

    const statsResult = await adminAPI.getVoteStatistics(currentElection.id);
    const resultsResult = await adminAPI.getResultsByPosition(currentElection.id);

    if (statsResult.success) {
        renderVoteStats(statsResult.data);
    }

    if (resultsResult.success) {
        renderResults(resultsResult.data);
    }

    updateLastUpdatedTime();
}

function renderVoteStats(stats) {
    document.getElementById('voteStats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.totalVotes || 0}</div>
            <div class="stat-label">Total Votes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.uniqueVoters || 0}</div>
            <div class="stat-label">Unique Voters</div>
        </div>
    `;
}

function renderResults(groupedResults) {
    const container = document.getElementById('resultsContainer');
    
    if (Object.keys(groupedResults).length === 0) {
        container.innerHTML = '<div class="loading-state">No votes cast yet</div>';
        return;
    }

    container.innerHTML = Object.entries(groupedResults).map(([position, results]) => `
        <div class="position-group">
            <h3>${escapeHtml(position)}</h3>
            ${results.map(result => `
                <div class="result-item">
                    <div class="result-header">
                        <span class="result-name">${escapeHtml(result.candidate_name)}</span>
                        <span class="result-count">${result.total_votes || 0} votes (${result.vote_percentage || 0}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${result.vote_percentage || 0}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

function startResultsAutoRefresh() {
    // Clear existing interval
    if (resultsRefreshInterval) {
        clearInterval(resultsRefreshInterval);
    }
    
    // Auto-refresh every 5 seconds regardless of session status
    // Admin should always see live results
    resultsRefreshInterval = setInterval(async () => {
        await loadResults();
    }, 5000);
}

function subscribeToLiveVotes() {
    // Unsubscribe from previous subscription
    if (votesSubscription) {
        adminAPI.unsubscribe(votesSubscription);
    }
    
    if (!currentElection) return;
    
    // Subscribe to current election's votes for real-time updates
    votesSubscription = adminAPI.subscribeToVotes(currentElection.id, async (payload) => {
        console.log('New vote received:', payload);
        // Immediately refresh results when new vote comes in
        await loadResults();
    });
}

function updateLastUpdatedTime() {
    const now = new Date().toLocaleTimeString();
    document.getElementById('lastUpdated').textContent = `Updated: ${now}`;
}

// Export Results
async function exportResults() {
    if (!currentElection) {
        alert('No election selected');
        return;
    }

    const result = await adminAPI.exportAndDownloadResults(
        currentElection.id,
        currentElection.title.toLowerCase().replace(/\s+/g, '_')
    );

    if (!result.success) {
        alert('Failed to export results: ' + result.error);
    }
}

// Modals
function showConfirmModal(title, message, onConfirm, isDangerous = false) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    confirmBtn.onclick = onConfirm;
    confirmBtn.className = isDangerous ? 'btn-danger' : 'btn-primary';
    
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

// Election Modal Management
function openElectionModal() {
    document.getElementById('electionTitle').value = '';
    document.getElementById('electionDescription').value = '';
    document.getElementById('electionModal').classList.remove('hidden');
}

function closeElectionModal() {
    document.getElementById('electionModal').classList.add('hidden');
    document.getElementById('electionForm').reset();
}

async function handleElectionSubmit(e) {
    e.preventDefault();
    
    const electionData = {
        title: document.getElementById('electionTitle').value.trim(),
        description: document.getElementById('electionDescription').value.trim()
    };

    // Validate
    if (!electionData.title) {
        alert('Please enter an election title');
        return;
    }

    const result = await adminAPI.createElection(electionData);

    if (result.success) {
        closeElectionModal();
        
        // Reload elections and select the new one
        await loadAllElections();
        
        // Find and select the newly created election
        const newElection = allElections.find(e => e.title === electionData.title);
        if (newElection) {
            currentElection = newElection;
            isSessionOpen = newElection.is_open;
            document.getElementById('electionSelect').value = newElection.id;
            updateElectionUI();
            await loadCandidates();
            await loadResults();
        }
        
        alert('Election created successfully! You can now add candidates.');
    } else {
        alert('Failed to create election: ' + result.error);
    }
}

// Utilities
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (resultsRefreshInterval) {
        clearInterval(resultsRefreshInterval);
    }
    if (votesSubscription) {
        adminAPI.unsubscribe(votesSubscription);
    }
});

// Close election modal on backdrop click
document.querySelector('#electionModal .modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeElectionModal();
    }
});

// Protect the page and initialize
await authManager.requireAuth();
init();
