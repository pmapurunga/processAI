
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOutFirebase, type User as FirebaseUserType } from "firebase/auth";
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
import type { ProcessSummary, DocumentAnalysis } from "@/types";

// ATENÇÃO: Erro "auth/requests-from-referer...-are-blocked"
// Este erro indica que o domínio de onde seu app está sendo servido NÃO está autorizado.
// 1. Firebase Console:
//    - Vá para Authentication > Settings > Authorized domains.
//    - Adicione o domínio EXATO (ex: my-app.cloudworkstations.dev, SEM https:// e SEM / no final).
// 2. Google Cloud Console (SE o passo 1 não resolver APÓS tempo de propagação):
//    - Vá para APIs & Services > Credentials.
//    - Encontre a API Key usada pelo seu app (geralmente o valor de NEXT_PUBLIC_FIREBASE_API_KEY).
//    - Clique na chave e verifique "Application restrictions".
//    - Se "HTTP referrers (web sites)" estiver selecionado, adicione o mesmo domínio lá.
//    - Salve e aguarde a propagação (pode levar alguns minutos).
// 3. Verifique se não há erros de digitação e se o projeto correto está selecionado em ambos os consoles.
// 4. Limpe o cache do navegador ou teste em modo anônimo.


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
const googleProvider = new GoogleAuthProvider();

export type { FirebaseUserType as FirebaseUser };

export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
} | null;

export const signInWithGoogle = async (): Promise<AuthUser> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    if (firebaseUser) {
      const userToSave: AuthUser = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      };
      return userToSave;
    }
    throw new Error("Firebase user not found after successful sign-in popup.");
  } catch (error: any) {
    const errorCode = error?.code;
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/popup-blocked'
    ) {
      // These are user actions or browser issues, not unexpected server errors.
      // Let the calling function (useAuth) handle specific logging or user feedback.
    } else {
      console.error("Error signing in with Google (from firebase.ts):", error);
    }
    throw error; // Re-throw all errors so the caller can handle them appropriately.
  }
};

export const signOutFirebase = async (): Promise<void> => {
  try {
    await firebaseSignOutFirebase(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

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
      createdAt: new Date() 
    } as unknown as ProcessSummary; // Cast to avoid timestamp/date type mismatch for immediate return
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
      uploadedAt: new Date() 
    } as unknown as DocumentAnalysis; // Cast for immediate return
  } catch (error) {
    console.error("Error saving document analysis to Firestore:", error);
    throw error;
  }
};

const convertTimestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return timestamp ? new Date(timestamp) : new Date(); 
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
        uploadedAt: convertTimestampToDate(data.uploadedAt),
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
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined,
      } as ProcessSummary;
    });
  } catch (error)
{
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
        createdAt: convertTimestampToDate(data.createdAt),
        updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined,
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

export { 
  app, 
  auth, 
  db, 
  googleProvider,
  Timestamp
};
