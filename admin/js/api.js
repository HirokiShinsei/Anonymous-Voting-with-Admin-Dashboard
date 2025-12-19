import { supabase } from '../../js/supabase.js';

class AdminAPI {
    /**
     * CANDIDATE MANAGEMENT
     */

    // Create a new candidate
    async createCandidate(electionId, candidateData) {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .insert([{
                    election_id: electionId,
                    name: candidateData.name,
                    position: candidateData.position,
                    description: candidateData.description || null,
                    image_url: candidateData.image_url || null
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating candidate:', error);
            return { success: false, error: error.message };
        }
    }

    // Update existing candidate
    async updateCandidate(candidateId, updates) {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .update(updates)
                .eq('id', candidateId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error updating candidate:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete candidate
    async deleteCandidate(candidateId) {
        try {
            const { error } = await supabase
                .from('candidates')
                .delete()
                .eq('id', candidateId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deleting candidate:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all candidates for an election
    async getCandidatesByElection(electionId) {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('*')
                .eq('election_id', electionId)
                .order('position', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching candidates:', error);
            return { success: false, error: error.message };
        }
    }

    // Get candidates grouped by position
    async getCandidatesByPosition(electionId) {
        try {
            const { data, error } = await supabase
                .from('candidates')
                .select('*')
                .eq('election_id', electionId)
                .order('position', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            // Group by position
            const grouped = data.reduce((acc, candidate) => {
                if (!acc[candidate.position]) {
                    acc[candidate.position] = [];
                }
                acc[candidate.position].push(candidate);
                return acc;
            }, {});

            return { success: true, data: grouped };
        } catch (error) {
            console.error('Error fetching candidates by position:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * ELECTION MANAGEMENT
     */

    // Toggle election open/closed status
    async toggleElectionStatus(electionId, isOpen) {
        try {
            const { data, error } = await supabase
                .from('elections')
                .update({ is_open: isOpen })
                .eq('id', electionId)
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error toggling election status:', error);
            return { success: false, error: error.message };
        }
    }

    // Get current election status
    async getElectionStatus(electionId) {
        try {
            const { data, error } = await supabase
                .from('elections')
                .select('*')
                .eq('id', electionId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error fetching election status:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all elections
    async getAllElections() {
        try {
            const { data, error } = await supabase
                .from('elections')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error fetching elections:', error);
            return { success: false, error: error.message, data: [] };
        }
    }

    // Create new election
    async createElection(electionData) {
        try {
            const { data, error } = await supabase
                .from('elections')
                .insert([{
                    title: electionData.title,
                    description: electionData.description || null,
                    is_open: false
                }])
                .select()
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error creating election:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * RESULTS & ANALYTICS
     */

    // Get aggregated results from election_results view
    async getElectionResults(electionId) {
        try {
            const { data, error } = await supabase
                .from('election_results')
                .select('*')
                .eq('election_id', electionId)
                .order('position', { ascending: true })
                .order('total_votes', { ascending: false });

            if (error) throw error;
            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error fetching election results:', error);
            return { success: false, error: error.message, data: [] };
        }
    }

    // Get results grouped by position
    async getResultsByPosition(electionId) {
        try {
            const { data, error } = await supabase
                .from('election_results')
                .select('*')
                .eq('election_id', electionId)
                .order('position', { ascending: true })
                .order('total_votes', { ascending: false });

            if (error) throw error;

            // Group by position
            const grouped = (data || []).reduce((acc, result) => {
                if (!acc[result.position]) {
                    acc[result.position] = [];
                }
                acc[result.position].push(result);
                return acc;
            }, {});

            return { success: true, data: grouped };
        } catch (error) {
            console.error('Error fetching results by position:', error);
            return { success: false, error: error.message, data: {} };
        }
    }

    // Get vote count statistics
    async getVoteStatistics(electionId) {
        try {
            // Get unique voters count
            const { count: votersCount, error: votersError } = await supabase
                .from('voters')
                .select('*', { count: 'exact', head: true })
                .eq('election_id', electionId);

            if (votersError) throw votersError;

            // Get total votes via results view
            const { data: resultsData, error: resultsError } = await supabase
                .from('election_results')
                .select('total_votes')
                .eq('election_id', electionId);

            if (resultsError) throw resultsError;

            const totalVotes = (resultsData || []).reduce((sum, r) => sum + (r.total_votes || 0), 0);

            return {
                success: true,
                data: {
                    totalVotes: totalVotes,
                    uniqueVoters: votersCount || 0
                }
            };
        } catch (error) {
            console.error('Error fetching vote statistics:', error);
            return { 
                success: false, 
                error: error.message,
                data: { totalVotes: 0, uniqueVoters: 0 }
            };
        }
    }

    /**
     * CSV EXPORT
     */

    // Generate CSV export of election results
    async exportResultsToCSV(electionId) {
        try {
            const resultsResponse = await this.getElectionResults(electionId);
            
            if (!resultsResponse.success) {
                throw new Error(resultsResponse.error);
            }

            const results = resultsResponse.data;

            // CSV headers
            const headers = ['Position', 'Candidate Name', 'Total Votes', 'Percentage'];
            
            // CSV rows
            const rows = results.map(result => [
                result.position,
                result.candidate_name,
                result.total_votes,
                `${result.vote_percentage || 0}%`
            ]);

            // Combine headers and rows
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            return { success: true, data: csvContent };
        } catch (error) {
            console.error('Error generating CSV:', error);
            return { success: false, error: error.message };
        }
    }

    // Download CSV file
    downloadCSV(csvContent, filename = 'election_results.csv') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Export and download results
    async exportAndDownloadResults(electionId, electionTitle = 'election') {
        try {
            const result = await this.exportResultsToCSV(electionId);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `${electionTitle}_results_${timestamp}.csv`;
            
            this.downloadCSV(result.data, filename);
            
            return { success: true };
        } catch (error) {
            console.error('Error exporting results:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * REAL-TIME SUBSCRIPTIONS
     */

    // Subscribe to live vote updates
    subscribeToVotes(electionId, callback) {
        return supabase
            .channel(`votes:${electionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'votes',
                    filter: `election_id=eq.${electionId}`
                },
                callback
            )
            .subscribe();
    }

    // Unsubscribe from channel
    unsubscribe(subscription) {
        if (subscription) {
            supabase.removeChannel(subscription);
        }
    }
}

// Export singleton instance
export const adminAPI = new AdminAPI();
