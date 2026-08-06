import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Expect a service account JSON in the environment variable FIREBASE_SERVICE_ACCOUNT
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!serviceAccount) {
  console.warn('FIREBASE_SERVICE_ACCOUNT env var not set; Firebase Admin will not be initialized.');
}

if (!getApps().length && serviceAccount) {
  initializeApp({ credential: cert(serviceAccount) });
}

export const adminFirestore = getFirestore();
