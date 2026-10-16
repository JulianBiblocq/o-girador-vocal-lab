/**
 * config.ts
 * Initialisation Firebase pour O Girador Vocal Lab (partagé avec organizador / sequenciador).
 * Strictement < 50 lignes.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCTvRPj2p3zdIfEjftXoSvRJ43Uy0EfPMY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'o-girador-7828c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'o-girador-7828c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'o-girador-7828c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '488703864701',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:488703864701:web:50b8cbcd1ca4038e15e614',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
