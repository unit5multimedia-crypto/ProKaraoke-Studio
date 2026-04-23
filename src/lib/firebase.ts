import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, updateDoc, collection, query, orderBy, addDoc, deleteDoc, getDocFromServer, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/youtube.readonly');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;
    
    // Store profile in Firestore
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    
    return { user: result.user, accessToken };
  } catch (error: any) {
    // For localhost development, show a helpful message
    if (error.code === 'auth/unauthorized-domain') {
      console.warn("Firebase Auth: Domain not authorized. Running in demo mode.");
      console.warn("To fix: Add localhost:3000 to Firebase Console > Authentication > Authorized domains");
      // Return a mock user for local development to test the UI
      const mockUser = {
        uid: 'demo-user-' + Math.random().toString(36).substr(2, 9),
        email: 'demo@localhost',
        displayName: 'Demo User',
        photoURL: null,
        isAnonymous: false,
        metadata: { createdAt: new Date(), lastSignInTime: new Date() },
        providerData: []
      } as any;
      return { user: mockUser, accessToken: 'demo-token-dev' };
    }
    console.error("Auth Error:", error);
    throw error;
  }
};

export async function validateConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message?.includes('offline')) {
      console.error("Firebase connection failed: Client is offline");
    }
  }
}

export type { User };
