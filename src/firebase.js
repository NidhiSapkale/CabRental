import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA_nX3iImmaudYHZIDkWKYU3pwPRZVhZ7k",
  authDomain: "cabrental-b11d9.firebaseapp.com",
  projectId: "cabrental-b11d9",
  storageBucket: "cabrental-b11d9.firebasestorage.app",
  messagingSenderId: "975775551937",
  appId: "1:975775551937:web:ceae383aae60c17437df40"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
