import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration (add your project's config details as needed)
const firebaseConfig = {
  projectId: 'casamotel-96c86',
  // apiKey, authDomain, etc., can be added here if required
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
