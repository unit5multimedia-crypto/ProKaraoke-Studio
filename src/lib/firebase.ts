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
    // Note: In COOP restricted environments, signInWithPopup can throw policy errors or hang.
    // We attempt it, but catch the specific closure error to provide a better UX.
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
    console.error("Auth Error:", error);
    if (error.code === 'auth/popup-closed-by-user') {
       throw new Error("Login cancelled or blocked by browser. Please allow popups.");
    }
    if (error.message?.includes('Cross-Origin-Opener-Policy')) {
       throw new Error("Security Policy Error: Your browser is blocking the login window. Try opening the app in a new tab.");
    }
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
