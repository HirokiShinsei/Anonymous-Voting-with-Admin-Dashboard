import { adminAPI } from './api.js';

// Create candidate
const result = await adminAPI.createCandidate({
    name: 'John Doe',
    position: 'President',
    bio: 'Experienced leader...',
    image_url: '/images/john.jpg'
});

// Update candidate
await adminAPI.updateCandidate(candidateId, {
    name: 'Jane Doe',
    bio: 'Updated bio...'
});

// Delete candidate
await adminAPI.deleteCandidate(candidateId);
