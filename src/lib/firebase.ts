
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as signOutFirebaseAuth, type User as FirebaseUserType } from "firebase/auth";
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
  // deleteDoc, // Not currently used, can be removed if not planned
  // writeBatch // Not currently used, can be removed if not planned
} from "firebase/firestore";
import { 
  getStorage, 
  ref as storageRef, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  SettableMetadata 
} from "firebase/storage";


// Ajuste para evitar conflito de nomenclatura com os tipos Firebase, se necessário.
import type { Process as AppProcessSummary, DocumentRecord as AppDocumentAnalysis, ProcessSummaryData } from "@/types";
import type { ExtractSummaryFromPdfOutput } from "@/ai/flows/extract-summary-from-pdf";


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initialize Firebase Storage
const googleProvider = new GoogleAuthProvider();

export type { FirebaseUserType as FirebaseUser };

export const signInWithGoogle = async (): Promise<FirebaseUserType> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const errorCode = error?.code;
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/popup-blocked'
    ) {
      console.info('Firebase sign-in user/browser action:', errorCode, error.message);
    } else {
      console.error("Error signing in with Google (from firebase.ts):", error);
    }
    throw error;
  }
};

export { signOutFirebaseAuth }; 

export const saveSummary = async (processNumber: string, summaryJsonData: ExtractSummaryFromPdfOutput, userId: string): Promise<AppProcessSummary> => {
  try {
    // summaryJsonData é o objeto completo retornado pela flow, contendo processNumber e documentTable
    const processData: Omit<AppProcessSummary, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, status: string } = {
      processNumber,
      summaryJson: summaryJsonData, // Salva o objeto { processNumber, documentTable }
      userId,
      createdAt: serverTimestamp(),
      status: 'summary_completed', 
    };
    const docRef = await addDoc(collection(db, "processes"), processData);
    return { 
      id: docRef.id, 
      ...processData,
      createdAt: new Date(), 
    } as AppProcessSummary;
  } catch (error) {
    console.error("Error saving summary to Firestore:", error);
    throw error;
  }
};

export const saveDocumentAnalysis = async (processId: string, fileName: string, analysisPrompt: string, analysisResult: any): Promise<AppDocumentAnalysis> => {
  try {
    const analysisData: Omit<AppDocumentAnalysis, 'id' | 'uploadedAt'> & { uploadedAt: any } = { 
      processId,
      fileName,
      analysisPromptUsed: analysisPrompt, 
      analysisResultJson: analysisResult, 
      status: 'completed', 
      uploadedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, "processes", processId, "documentAnalyses"), analysisData);
    
    await setDoc(doc(db, "processes", processId), { status: 'documents_completed', updatedAt: serverTimestamp() }, { merge: true });

    return { 
      id: docRef.id, 
      ...analysisData,
      uploadedAt: new Date(), 
    } as AppDocumentAnalysis;
  } catch (error) {
    console.error("Error saving document analysis to Firestore:", error);
    throw error;
  }
};


export const uploadFileForProcessAnalysis = (
  file: File, 
  processId: string, 
  analysisPrompt: string, 
  userId: string, 
  onProgress: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uniqueFileName = `${Date.now()}-${file.name}`;
    const filePath = `pendingAnalysis/${userId}/${processId}/${uniqueFileName}`;
    const fileRef = storageRef(storage, filePath);

    const metadata: SettableMetadata = {
      customMetadata: {
        processId: processId,
        analysisPromptUsed: analysisPrompt,
        userId: userId,
        originalFileName: file.name 
      }
    };

    const uploadTask = uploadBytesResumable(fileRef, file, metadata);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress(progress);
      },
      (error) => {
        console.error("Error uploading file to Firebase Storage:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL); 
        } catch (error) {
           console.error("Error getting download URL after upload:", error);
           reject(error); 
        }
      }
    );
  });
};


const convertTimestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // Fallback for serialized Timestamp-like objects
  if (timestamp && typeof timestamp.seconds === 'number' && typeof timestamp.nanoseconds === 'number') {
    return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
  }
  // If it's already a string that can be parsed into a date (less ideal but common from some APIs)
  if (typeof timestamp === 'string' && !isNaN(new Date(timestamp).getTime())) {
    return new Date(timestamp);
  }
  // Default or error case
  return new Date(); 
};


export const getDocumentAnalyses = async (processId: string): Promise<AppDocumentAnalysis[]> => {
  try {
    const analysesCol = collection(db, "processes", processId, "documentAnalyses");
    const q = query(analysesCol, orderBy("uploadedAt", "desc")); 
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        uploadedAt: convertTimestampToDate(data.uploadedAt),
        analyzedAt: data.analyzedAt ? convertTimestampToDate(data.analyzedAt) : undefined,
      } as AppDocumentAnalysis; 
    });
  } catch (error) {
    console.error("Error fetching document analyses from Firestore:", error);
    throw error;
  }
};

export const getProcesses = async (userId: string): Promise<AppProcessSummary[]> => {
  try {
    const processesCol = collection(db, "processes");
    const q = query(processesCol, where("userId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined,
      } as AppProcessSummary; 
    });
  } catch (error) {
    console.error("Error fetching processes from Firestore:", error);
    throw error;
  }
};

export const getProcessSummary = async (processId: string): Promise<AppProcessSummary | null> => {
  try {
    const docRef = doc(db, "processes", processId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined,
      } as AppProcessSummary; 
    } else {
      console.warn(`No such process summary found for ID: ${processId}`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching process summary from Firestore:", error);
    throw error;
  }
};

export const deleteFileFromStorage = async (filePath: string): Promise<void> => {
  const fileRef = storageRef(storage, filePath);
  try {
    await deleteObject(fileRef);
    console.log(`File deleted successfully: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting file ${filePath} from Storage:`, error);
    throw error;
  }
};


export { 
  app, 
  auth, 
  db, 
  storage, 
  googleProvider,
  Timestamp 
};
