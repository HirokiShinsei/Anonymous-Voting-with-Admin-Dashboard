import { supabase } from './supabase.js';

// State
let currentElection = null;
let candidates = [];
let voterFingerprint = null;
let voterId = null;
let selectedVotes = {};

// Initialize
async function init() {
    // Generate voter fingerprint
    voterFingerprint = await generateFingerprint();
    
    // Load election and check voter status
    await loadElection();
}

// Generate browser fingerprint
async function generateFingerprint() {
    const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cpuCores: navigator.hardwareConcurrency || 'unknown',
    };
    
    const fingerprintString = JSON.stringify(components);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Load current election
async function loadElection() {
    try {
        // Get open election
        const { data: election, error } = await supabase
            .from('elections')
            .select('*')
            .eq('is_open', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                showClosedState();
                return;
            }
            throw error;
        }

        currentElection = election;
        
        // Update header status
        updateElectionStatus(true);
        
        // Check if voter has already voted
        const hasVoted = await checkIfVoted();
        
        if (hasVoted) {
            showVotedState();
        } else {
            // Load candidates and show voting form
            await loadCandidates();
            showVotingForm();
        }
        
    } catch (error) {
        console.error('Error loading election:', error);
        showClosedState();
    }
}

// Check if voter has already voted
async function checkIfVoted() {
    try {
        const { data, error } = await supabase
            .from('voters')
            .select('id')
            .eq('election_id', currentElection.id)
            .eq('fingerprint_hash', voterFingerprint)
            .single();

        if (data) {
            voterId = data.id;
            return true;
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

// Load candidates
async function loadCandidates() {
    try {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('election_id', currentElection.id)
            .order('position', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        candidates = data || [];
        renderVotingForm();
        
    } catch (error) {
        console.error('Error loading candidates:', error);
        alert('Failed to load candidates. Please refresh the page.');
    }
}

// Update election status badge
function updateElectionStatus(isOpen) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (isOpen) {
        statusDot.classList.add('open');
        statusText.textContent = 'Voting Open';
    } else {
        statusDot.classList.add('closed');
        statusText.textContent = 'Voting Closed';
    }
}

// Show different states
function showClosedState() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('closedState').classList.remove('hidden');
    updateElectionStatus(false);
}

function showVotedState() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('votedState').classList.remove('hidden');
    
    // Only show view results button if election is closed
    const viewResultsBtn = document.getElementById('viewResultsBtn');
    if (currentElection && !currentElection.is_open) {
        viewResultsBtn.style.display = 'inline-block';
    } else {
        viewResultsBtn.style.display = 'none';
    }
}

function showVotingForm() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('votingForm').classList.remove('hidden');
}

// Render voting form
function renderVotingForm() {
    document.getElementById('electionTitle').textContent = currentElection.title;
    document.getElementById('electionDescription').textContent = currentElection.description || '';
    
    // Group candidates by position
    const grouped = candidates.reduce((acc, candidate) => {
        if (!acc[candidate.position]) {
            acc[candidate.position] = [];
        }
        acc[candidate.position].push(candidate);
        return acc;
    }, {});

    const container = document.getElementById('positionsContainer');
    container.innerHTML = Object.entries(grouped).map(([position, candidateList]) => `
        <div class="position-section">
            <h3 class="position-title">${escapeHtml(position)}</h3>
            <div class="candidates-grid">
                ${candidateList.map(candidate => `
                    <label class="candidate-option" data-position="${escapeHtml(position)}">
                        <input 
                            type="radio" 
                            name="position_${escapeHtml(position)}" 
                            value="${candidate.id}"
                            data-candidate-name="${escapeHtml(candidate.name)}"
                            data-position="${escapeHtml(position)}"
                        >
                        <div class="candidate-info">
                            <h4>${escapeHtml(candidate.name)}</h4>
                            ${candidate.description ? `<p>${escapeHtml(candidate.description)}</p>` : ''}
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Add event listeners for radio buttons
    document.querySelectorAll('.candidate-option input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', handleCandidateSelection);
    });
}

// Handle candidate selection
function handleCandidateSelection(e) {
    const radio = e.target;
    const position = radio.dataset.position;
    const candidateId = radio.value;
    const candidateName = radio.dataset.candidateName;
    
    // Update selected votes
    selectedVotes[position] = {
        candidateId,
        candidateName
    };
    
    // Update UI - highlight selected option
    document.querySelectorAll(`[data-position="${position}"]`).forEach(label => {
        label.classList.remove('selected');
    });
    radio.closest('.candidate-option').classList.add('selected');
}

// Handle form submission
document.getElementById('ballotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate all positions have selections
    const positions = Object.keys(candidates.reduce((acc, c) => ({ ...acc, [c.position]: true }), {}));
    const selectedPositions = Object.keys(selectedVotes);
    
    if (selectedPositions.length === 0) {
        alert('Please select at least one candidate to vote for.');
        return;
    }
    
    // Show confirmation modal
    showConfirmationModal();
});

// Show confirmation modal
function showConfirmationModal() {
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmContent');
    
    content.innerHTML = `
        <div class="vote-summary">
            ${Object.entries(selectedVotes).map(([position, vote]) => `
                <div class="vote-summary-item">
                    <span class="vote-summary-position">${escapeHtml(position)}:</span>
                    <span class="vote-summary-candidate">${escapeHtml(vote.candidateName)}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Confirm modal buttons
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.add('hidden');
});

document.getElementById('confirmSubmitBtn').addEventListener('click', async () => {
    await submitVotes();
});

// Submit votes
async function submitVotes() {
    try {
        // Disable submit button
        const submitBtn = document.getElementById('confirmSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        // Register voter
        const { data: voter, error: voterError } = await supabase
            .from('voters')
            .insert([{
                election_id: currentElection.id,
                fingerprint_hash: voterFingerprint,
                ip_address: null // Could be added if needed
            }])
            .select()
            .single();

        if (voterError) throw voterError;
        
        voterId = voter.id;
        
        // Submit votes
        const votes = Object.entries(selectedVotes).map(([position, vote]) => ({
            voter_id: voterId,
            candidate_id: vote.candidateId,
            election_id: currentElection.id,
            position: position
        }));
        
        const { error: votesError } = await supabase
            .from('votes')
            .insert(votes);

        if (votesError) throw votesError;
        
        // Close modal and show success
        document.getElementById('confirmModal').classList.add('hidden');
        document.getElementById('votingForm').classList.add('hidden');
        showVotedState();
        
    } catch (error) {
        console.error('Error submitting votes:', error);
        alert('Failed to submit votes. Please try again.');
        
        // Re-enable button
        const submitBtn = document.getElementById('confirmSubmitBtn');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm & Submit';
    }
}

// View results - only available when election is closed
document.getElementById('viewResultsBtn').addEventListener('click', async () => {
    if (!currentElection || currentElection.is_open) {
        alert('Results will be available after the voting period ends.');
        return;
    }
    
    await loadResults();
    document.getElementById('votedState').classList.add('hidden');
    document.getElementById('resultsView').classList.remove('hidden');
});

// Load results
async function loadResults() {
    try {
        const { data, error } = await supabase
            .from('election_results')
            .select('*')
            .eq('election_id', currentElection.id)
            .order('position', { ascending: true })
            .order('total_votes', { ascending: false });

        if (error) throw error;

        renderResults(data || []);
        
    } catch (error) {
        console.error('Error loading results:', error);
        alert('Failed to load results.');
    }
}

// Render results
function renderResults(results) {
    // Group by position
    const grouped = results.reduce((acc, result) => {
        if (!acc[result.position]) {
            acc[result.position] = [];
        }
        acc[result.position].push(result);
        return acc;
    }, {});

    const container = document.getElementById('resultsContent');
    container.innerHTML = Object.entries(grouped).map(([position, positionResults]) => `
        <div class="result-position">
            <h3>${escapeHtml(position)}</h3>
            ${positionResults.map(result => `
                <div class="result-item">
                    <div class="result-header-row">
                        <span class="result-name">${escapeHtml(result.candidate_name)}</span>
                        <span class="result-votes">${result.total_votes || 0} votes (${result.vote_percentage || 0}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${result.vote_percentage || 0}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}

// Utility
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close modal on backdrop click
document.querySelector('#confirmModal .modal-backdrop').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.add('hidden');
});

// Initialize on load
init();
