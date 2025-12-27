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
    
    // Success modal OK button
    document.getElementById('successOkBtn').addEventListener('click', closeSuccessModal);

    // Close modals on backdrop click - optimize by using event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            const modal = e.target.parentElement;
            if (modal.id === 'confirmModal') closeConfirmModal();
            else if (modal.id === 'candidateModal') closeCandidateModal();
            else if (modal.id === 'electionModal') closeElectionModal();
            else if (modal.id === 'deleteElectionModal') hideModal(document.getElementById('deleteElectionModal'));
            else if (modal.id === 'successModal') closeSuccessModal();
        }
    });

    // Delete Election Button
    const deleteElectionBtn = document.getElementById('deleteElectionBtn');
    const deleteElectionModal = document.getElementById('deleteElectionModal');
    const deleteElectionForm = document.getElementById('deleteElectionForm');
    const deleteElectionName = document.getElementById('deleteElectionName');
    const deletePassword = document.getElementById('deletePassword');
    const deleteError = document.getElementById('deleteError');
    const deleteCancelBtn = document.getElementById('deleteCancelBtn');
    const deleteSubmitBtn = document.getElementById('deleteSubmitBtn');
    const deleteSubmitText = document.getElementById('deleteSubmitText');
    const deleteLoadingIndicator = document.getElementById('deleteLoadingIndicator');

    deleteElectionBtn.addEventListener('click', () => {
        if (!currentElection) return;
        
        deleteElectionName.value = currentElection.title;
        deletePassword.value = '';
        hideDeleteError();
        showModal(deleteElectionModal);
    });

    deleteCancelBtn.addEventListener('click', () => {
        hideModal(deleteElectionModal);
    });

    deleteElectionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideDeleteError();
        
        const password = deletePassword.value;
        if (!password) {
            showDeleteError('Please enter your password');
            return;
        }
        
        deleteSubmitBtn.disabled = true;
        
        try {
            const currentUser = authManager.getCurrentUser();
            const verifyResult = await authManager.signIn(currentUser.email, password);
            
            if (!verifyResult.success) {
                deleteSubmitBtn.disabled = false;
                showDeleteError('Incorrect password. Please try again.');
                return;
            }
            
            setDeleteLoading(true);
            const result = await adminAPI.deleteElection(currentElection.id);
            
            if (result.success) {
                // Deletion successful - refresh the page to reload everything
                window.location.reload();
            } else {
                setDeleteLoading(false);
                showDeleteError(result.error || 'Failed to delete election');
            }
        } catch (error) {
            console.error('Delete election error:', error);
            setDeleteLoading(false);
            showDeleteError('An unexpected error occurred. Please try again.');
        }
    });

    function showDeleteError(message) {
        deleteError.textContent = message;
        deleteError.classList.add('show');
    }

    function hideDeleteError() {
        deleteError.classList.remove('show');
    }

    function setDeleteLoading(isLoading) {
        deleteSubmitBtn.disabled = isLoading;
        if (isLoading) {
            deleteSubmitText.style.display = 'none';
            deleteLoadingIndicator.style.display = 'inline-flex';
        } else {
            deleteSubmitText.style.display = 'inline';
            deleteLoadingIndicator.style.display = 'none';
        }
    }

    // Clear error on password input
    deletePassword.addEventListener('input', hideDeleteError);
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
        
        // Return true to indicate elections were loaded
        return true;
    } else {
        // No elections exist - show empty state
        allElections = [];
        currentElection = null;
        isSessionOpen = false;
        
        document.getElementById('electionSelect').innerHTML = 
            '<option value="">No elections available</option>';
        document.getElementById('sessionBadge').textContent = 'No Election';
        document.getElementById('sessionBadge').className = 'session-badge closed';
        
        // Show empty state in panels
        showEmptyElectionState();
        updateElectionUI();
        
        // Return false to indicate no elections
        return false;
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
    const electionId = e ? e.target.value : null;
    
    if (!electionId) {
        // No election selected - could be triggered programmatically
        currentElection = null;
        isSessionOpen = false;
        showEmptyElectionState();
        updateElectionUI();
        return;
    }
    
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

async function toggleSession(open) {
    const result = await adminAPI.toggleElectionStatus(currentElection.id, open);
    
    if (result.success) {
        isSessionOpen = open;
        currentElection = result.data;
        updateElectionUI();
        await loadAllElections();
        await loadResults();
        closeConfirmModal();
        
        const action = open ? 'started' : 'ended';
        showSuccessModal(
            'Voting Session Updated',
            `Voting has been successfully ${action}. ${open ? 'Voters can now cast their votes.' : 'No more votes can be accepted.'}`
        );
    } else {
        closeConfirmModal();
        showErrorModal('Error', 'Failed to update session: ' + result.error);
    }
}

function updateElectionUI() {
    // Update session badge
    const badge = document.getElementById('sessionBadge');
    
    if (currentElection) {
        badge.textContent = isSessionOpen ? 'Voting Open' : 'Voting Closed';
        badge.className = `session-badge ${isSessionOpen ? 'open' : 'closed'}`;
    } else {
        badge.textContent = 'No Election';
        badge.className = 'session-badge closed';
    }

    // Update button states
    const hasElection = currentElection !== null;
    document.getElementById('deleteElectionBtn').disabled = !hasElection;
    document.getElementById('startVotingBtn').disabled = !hasElection || isSessionOpen;
    document.getElementById('endVotingBtn').disabled = !hasElection || !isSessionOpen;
    document.getElementById('addCandidateBtn').disabled = !hasElection || isSessionOpen;
    document.getElementById('exportResultsBtn').disabled = !hasElection;

    // Show/hide warning
    document.getElementById('sessionWarning').classList.toggle('hidden', !isSessionOpen);

    // Update candidate action buttons
    document.querySelectorAll('.btn-edit, .btn-delete').forEach(btn => {
        btn.disabled = isSessionOpen;
    });
}

function showEmptyElectionState() {
    // Show empty state in candidates panel
    document.getElementById('candidatesList').innerHTML = `
        <div class="empty-state-container" style="text-align: center; padding: 3rem 1rem;">
            <svg style="width: 80px; height: 80px; margin: 0 auto 1.5rem; opacity: 0.3;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h3 style="color: rgba(255, 255, 255, 0.9); font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">
                No Elections Created Yet
            </h3>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.95rem; margin-bottom: 1.5rem; max-width: 400px; margin-left: auto; margin-right: auto;">
                Get started by creating your first election. You'll be able to add candidates and manage voting once the election is created.
            </p>
            <button onclick="document.getElementById('createElectionBtn').click()" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: #DA291C; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Create Your First Election
            </button>
        </div>
    `;
    
    // Show empty state in results panel
    document.getElementById('resultsContainer').innerHTML = `
        <div class="empty-state-container" style="text-align: center; padding: 3rem 1rem;">
            <svg style="width: 80px; height: 80px; margin: 0 auto 1.5rem; opacity: 0.3;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
            <h3 style="color: rgba(255, 255, 255, 0.9); font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">
                No Results Available
            </h3>
            <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.95rem;">
                Create an election and start collecting votes to see results here.
            </p>
        </div>
    `;
    
    // Clear vote stats
    document.getElementById('voteStats').innerHTML = '';
}

// Election Management
function openElectionModal() {
    document.getElementById('electionTitle').value = '';
    document.getElementById('electionDescription').value = '';
    showModal(document.getElementById('electionModal'));
}

function closeElectionModal() {
    hideModal(document.getElementById('electionModal'));
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
        showErrorModal('Validation Error', 'Please enter an election title');
        return;
    }

    const result = await adminAPI.createElection(electionData);

    if (result.success) {
        closeElectionModal();
        await loadAllElections();
        
        const newElection = allElections.find(e => e.title === electionData.title);
        if (newElection) {
            currentElection = newElection;
            isSessionOpen = newElection.is_open;
            document.getElementById('electionSelect').value = newElection.id;
            updateElectionUI();
            await loadCandidates();
            await loadResults();
        }
        
        showSuccessModal('Election Created Successfully', 'You can now add candidates to this election.');
    } else {
        showErrorModal('Error', 'Failed to create election: ' + result.error);
    }
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
                closeConfirmModal();
                showSuccessModal('Candidate Deleted', `${candidate.name} has been successfully removed.`);
            } else {
                closeConfirmModal();
                showErrorModal('Error', 'Failed to delete candidate: ' + result.error);
            }
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
    hideModal(document.getElementById('candidateModal'));
    document.getElementById('candidateForm').reset();
    editingCandidateId = null;
}

async function handleCandidateSubmit(e) {
    e.preventDefault();
    
    if (!currentElection) {
        showErrorModal('Error', 'No election selected');
        return;
    }
    
    const candidateData = {
        name: document.getElementById('candidateName').value.trim(),
        position: document.getElementById('candidatePosition').value.trim(),
        description: document.getElementById('candidateDescription').value.trim()
    };

    // Validate
    if (!candidateData.name || !candidateData.position) {
        showErrorModal('Validation Error', 'Please fill in all required fields');
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
            
            const action = editingCandidateId ? 'updated' : 'created';
            showSuccessModal(
                'Success',
                `Candidate ${candidateData.name} has been successfully ${action}!`
            );
        } else {
            showErrorModal('Error', 'Failed to save candidate: ' + result.error);
        }
    } catch (error) {
        console.error('Error saving candidate:', error);
        showErrorModal('Error', 'An error occurred while saving the candidate');
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
        showErrorModal('Error', 'No election selected');
        return;
    }

    const result = await adminAPI.exportAndDownloadResults(
        currentElection.id,
        currentElection.title.toLowerCase().replace(/\s+/g, '_')
    );

    if (!result.success) {
        showErrorModal('Export Failed', 'Failed to export results: ' + result.error);
    } else {
        showSuccessModal(
            'Results Exported',
            'Election results have been downloaded successfully!'
        );
    }
}

// Modals - Update existing functions
function showModal(modalElement) {
    modalElement.classList.remove('hidden');
    requestAnimationFrame(() => {
        modalElement.style.opacity = '1';
    });
}

function hideModal(modalElement) {
    modalElement.style.opacity = '0';
    setTimeout(() => {
        modalElement.classList.add('hidden');
    }, 200);
}

function showSuccessModal(title, message) {
    document.getElementById('successTitle').textContent = title;
    document.getElementById('successMessage').textContent = message;
    showModal(document.getElementById('successModal'));
}

function closeSuccessModal() {
    hideModal(document.getElementById('successModal'));
}

function showErrorModal(title, message) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    
    confirmBtn.style.display = 'none';
    cancelBtn.textContent = 'OK';
    cancelBtn.className = 'btn-primary';
    
    const cleanup = () => {
        confirmBtn.style.display = '';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn-secondary';
        closeConfirmModal();
    };
    
    cancelBtn.onclick = cleanup;
    
    showModal(document.getElementById('confirmModal'));
}

function showConfirmModal(title, message, onConfirm, isDangerous = false) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    const confirmBtn = document.getElementById('confirmActionBtn');
    confirmBtn.onclick = onConfirm;
    confirmBtn.className = isDangerous ? 'btn-danger' : 'btn-primary';
    
    showModal(document.getElementById('confirmModal'));
}

function closeConfirmModal() {
    hideModal(document.getElementById('confirmModal'));
}

// Utilities
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup
window.addEventListener('beforeunload', () => {
    if (resultsRefreshInterval) clearInterval(resultsRefreshInterval);
    if (votesSubscription) adminAPI.unsubscribe(votesSubscription);
});

// Initialize
await authManager.requireAuth();
init();