
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
import type { ProcessSummary, DocumentAnalysis } from "@/types"; // Updated import for ProcessSummary and DocumentAnalysis

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
  // Fallback for server-side or non-browser environments if needed in the future
  // For now, primarily client-side initialization
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

// Interface for user data, mapping from FirebaseUser
export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
} | null;


// Actual Firebase Authentication Functions
export const signInWithGoogle = async (): Promise<{ user: AuthUser } | null> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    if (firebaseUser) {
      const user: AuthUser = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      };
      // Optional: Save/update user profile in Firestore (example, can be expanded)
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

// Actual Firebase Firestore Functions

export const saveSummary = async (processNumber: string, summaryText: string, summaryJson: any, userId: string): Promise<ProcessSummary> => {
  try {
    const processData = {
      processNumber,
      summaryText,
      summaryJson,
      userId,
      createdAt: serverTimestamp(), // Use serverTimestamp for consistency
      status: 'summary_completed' as ProcessSummary['status'],
    };
    const docRef = await addDoc(collection(db, "processes"), processData);
    // For the return, we create a client-side version with an approximated Date
    // The actual Firestore document will have a server-side Timestamp
    return { 
      id: docRef.id, 
      ...processData,
      createdAt: new Date() // Client-side approximation
    } as ProcessSummary;
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
      processId, 
    };
    const docRef = await addDoc(collection(db, "processes", processId, "documentAnalyses"), analysisData);
    
    await setDoc(doc(db, "processes", processId), { status: 'documents_completed', updatedAt: serverTimestamp() }, { merge: true });

    return { 
      id: docRef.id, 
      ...analysisData,
      uploadedAt: new Date() // Client-side approximation
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
        // Convert Firestore Timestamp to JS Date
        uploadedAt: (data.uploadedAt as Timestamp)?.toDate ? (data.uploadedAt as Timestamp).toDate() : new Date(data.uploadedAt),
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
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(data.createdAt),
        updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined,
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
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(data.createdAt),
        updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate() : data.updatedAt ? new Date(data.updatedAt) : undefined,
      } as ProcessSummary;
    } else {
      console.warn(`No such process summary found for ID: ${processId}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching process summary from Firestore:", error);
    throw error;
  }
};

// Export core Firebase services and utilities if needed elsewhere (though most interaction should be via these functions)
export { 
  app, 
  auth, 
  db, 
  googleProvider,
  doc, // Re-exporting for potential direct use, though wrapped functions are preferred
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  serverTimestamp
};
