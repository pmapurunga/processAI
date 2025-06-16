
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  addDoc,
  serverTimestamp,
  FieldValue
} from "firebase/firestore";

// This type will need to be defined or imported from a shared types directory
// For now, I'll define it here.
export interface DocumentRecord {
  id: string;
  processId: string;
  fileName: string;
  analysisPromptUsed: string;
  analysisResultJson: Record<string, unknown>;
  status: 'completed' | 'pending' | 'error';
  uploadedAt: Date;
  analyzedAt?: Date;
}


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

const db = getFirestore(app);

export const saveDocumentAnalysis = async (processId: string, fileName:string, analysisPrompt: string, analysisResult: Record<string, unknown>): Promise<DocumentRecord> => {
  try {
    const analysisData: Omit<DocumentRecord, 'id' | 'uploadedAt'> & { uploadedAt: FieldValue } = { 
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
    } as DocumentRecord;
  } catch (error) {
    console.error("Error saving document analysis to Firestore:", error);
    throw error;
  }
};
