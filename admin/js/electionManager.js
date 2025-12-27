import { getDatabase, ref, push, set, get, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

class ElectionManager {
    constructor() {
        this.db = getDatabase();
    }

    async createElection(title, description = '') {
        try {
            const electionsRef = ref(this.db, 'elections');
            const newElectionRef = push(electionsRef);
            
            const electionData = {
                id: newElectionRef.key,
                title,
                description,
                status: 'draft',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            await set(newElectionRef, electionData);
            return { success: true, election: electionData };
        } catch (error) {
            console.error('Error creating election:', error);
            return { success: false, error: 'Failed to create election' };
        }
    }

    async getElections() {
        try {
            const electionsRef = ref(this.db, 'elections');
            const snapshot = await get(electionsRef);
            
            if (!snapshot.exists()) {
                return { success: true, elections: [] };
            }

            const elections = [];
            snapshot.forEach((child) => {
                elections.push(child.val());
            });

            elections.sort((a, b) => b.createdAt - a.createdAt);

            return { success: true, elections };
        } catch (error) {
            console.error('Error getting elections:', error);
            return { success: false, error: 'Failed to load elections' };
        }
    }

    async getElection(electionId) {
        try {
            const electionRef = ref(this.db, `elections/${electionId}`);
            const snapshot = await get(electionRef);
            
            if (!snapshot.exists()) {
                return { success: false, error: 'Election not found' };
            }

            return { success: true, election: snapshot.val() };
        } catch (error) {
            console.error('Error getting election:', error);
            return { success: false, error: 'Failed to load election' };
        }
    }

    async updateElectionStatus(electionId, status) {
        try {
            const electionRef = ref(this.db, `elections/${electionId}`);
            await update(electionRef, {
                status,
                updatedAt: Date.now()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating election status:', error);
            return { success: false, error: 'Failed to update election status' };
        }
    }

    async deleteElection(electionId) {
        try {
            const electionRef = ref(this.db, `elections/${electionId}`);
            await remove(electionRef);
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting election:', error);
            return { 
                success: false, 
                error: 'Failed to delete election. Please try again.' 
            };
        }
    }

    subscribeToElection(electionId, callback) {
        const electionRef = ref(this.db, `elections/${electionId}`);
        return onValue(electionRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        });
    }
}

export const electionManager = new ElectionManager();