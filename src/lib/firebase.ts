
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  Timestamp,
  orderBy,
  deleteDoc,
  writeBatch
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} else {
  // Handle server-side or environment without window (e.g., for testing if needed)
  // This might require a different initialization strategy if used outside client components
  // For now, we assume client-side usage where `window` is available.
  if (!getApps().length) {
     app = initializeApp(firebaseConfig);
  } else {
     app = getApp();
  }
}


const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();


// Export Firebase User type
export type { FirebaseUser };

// Interfaces for our data structures
export interface MockUser { // Renaming to avoid conflict with FirebaseUser
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface ProcessSummary {
  id: string; // Firestore document ID
  processNumber: string;
  summaryText: string;
  summaryJson: any;
  createdAt: Date; // Stored as Timestamp, converted to Date on retrieval
  userId: string;
  status?: 'summary_pending' | 'summary_completed' | 'documents_pending' | 'documents_completed' | 'chat_ready' | 'archived';
}

export interface DocumentAnalysis {
  id: string; // Firestore document ID
  fileName: string;
  analysisPrompt: string;
  analysisResult: any;
  uploadedAt: Date; // Stored as Timestamp, converted to Date on retrieval
  processId: string; // ID of the parent process document
}

// Actual Firebase Authentication Functions
export const signInWithGoogle = async (): Promise<{ user: MockUser } | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    if (firebaseUser) {
      const user: MockUser = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      };
      // Optionally, save/update user profile in Firestore here
      // await setDoc(doc(db, "users", firebaseUser.uid), {
      //   displayName: firebaseUser.displayName,
      //   email: firebaseUser.email,
      //   photoURL: firebaseUser.photoURL,
      //   lastLogin: serverTimestamp(),
      // }, { merge: true });
      return { user };
    }
    return null;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const getCurrentUser = (): MockUser | null => {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    return {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
    };
  }
  return null;
};

// Actual Firebase Firestore Functions

export const saveSummary = async (processNumber: string, summaryText: string, summaryJson: any, userId: string): Promise<ProcessSummary> => {
  try {
    const processData = {
      processNumber,
      summaryText,
      summaryJson,
      userId,
      createdAt: serverTimestamp(),
      status: 'summary_completed' as ProcessSummary['status'],
    };
    const docRef = await addDoc(collection(db, "processes"), processData);
    return { 
      id: docRef.id, 
      ...processData,
      createdAt: new Date() // Approximate, real value is server timestamp
    } as ProcessSummary; // Cast needed because createdAt is serverTimestamp() initially
  } catch (error) {
    console.error("Error saving summary to Firestore:", error);
    throw error;
  }
};

export const saveDocumentAnalysis = async (processId: string, fileName: string, analysisPrompt: string, analysisResult: any): Promise<DocumentAnalysis> => {
  try {
    const analysisData = {
      fileName,
      analysisPrompt,
      analysisResult,
      uploadedAt: serverTimestamp(),
      processId, // Parent process ID
    };
    const docRef = await addDoc(collection(db, "processes", processId, "documentAnalyses"), analysisData);
    
    // Update process status
    await setDoc(doc(db, "processes", processId), { status: 'documents_completed' }, { merge: true });

    return { 
      id: docRef.id, 
      ...analysisData,
      uploadedAt: new Date() // Approximate
    } as DocumentAnalysis;
  } catch (error) {
    console.error("Error saving document analysis to Firestore:", error);
    throw error;
  }
};

export const getDocumentAnalyses = async (processId: string): Promise<DocumentAnalysis[]> => {
  try {
    const analysesCol = collection(db, "processes", processId, "documentAnalyses");
    const q = query(analysesCol, orderBy("uploadedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        uploadedAt: (data.uploadedAt as Timestamp)?.toDate() || new Date(),
      } as DocumentAnalysis;
    });
  } catch (error) {
    console.error("Error fetching document analyses from Firestore:", error);
    throw error;
  }
};

export const getProcesses = async (userId: string): Promise<ProcessSummary[]> => {
  try {
    const processesCol = collection(db, "processes");
    const q = query(processesCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      } as ProcessSummary;
    });
  } catch (error) {
    console.error("Error fetching processes from Firestore:", error);
    throw error;
  }
};

export const getProcessSummary = async (processId: string): Promise<ProcessSummary | null> => {
  try {
    const docRef = doc(db, "processes", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
      } as ProcessSummary;
    } else {
      console.log("No such process summary!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching process summary from Firestore:", error);
    throw error;
  }
};

export { 
  app, 
  auth, 
  db, 
  googleProvider, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  Timestamp
};

// Mock functions are no longer needed and are removed.
// Make sure to replace mockGetCurrentUser, mockSignInWithGoogle, mockSignOut, 
// mockSaveSummary, mockSaveDocumentAnalysis, mockGetDocumentAnalyses, 
// mockGetProcesses, mockGetProcessSummary calls in your components with the new functions.
// The hook use-auth.tsx will handle getCurrentUser, signInWithGoogle, signOut.
// Other pages will need to import the new Firestore functions directly.
