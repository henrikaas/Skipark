import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBcRdxX7fx3GvOnZJ6pjnBNo9c4ppgNHG0',
  authDomain: 'skipark-5f8bf.firebaseapp.com',
  projectId: 'skipark-5f8bf',
  storageBucket: 'skipark-5f8bf.firebasestorage.app',
  messagingSenderId: '806616430142',
  appId: '1:806616430142:web:a43f6422dc7ba68cdec36f',
  measurementId: 'G-GWCCL608CQ',
}

export const app = initializeApp(firebaseConfig)
export const analytics = getAnalytics(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export const db = getFirestore(app)

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}

export * from './firestore'
