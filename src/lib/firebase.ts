
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
import type { ProcessSummary as AppProcessSummary, DocumentAnalysis as AppDocumentAnalysis } from "@/types"; // Renamed to avoid conflict

// =====================================================================================
// GUIA DE SOLUÇÃO DE PROBLEMAS DE AUTENTICAÇÃO E CONFIGURAÇÃO DO FIREBASE
// =====================================================================================
//
// Erro Comum 1: "auth/requests-from-referer...-are-blocked"
// -----------------------------------------------------------
// Causa: O domínio de onde seu app está sendo servido NÃO está na lista de "Domínios autorizados"
//        nas configurações de Autenticação do Firebase.
// Solução no Firebase Console:
// 1. Vá para Firebase Console > Projeto (processai-145cd) > Authentication > Settings.
// 2. Em "Authorized domains", adicione o domínio EXATO (ex: NOME_DO_HOST.cloudworkstations.dev ou processai-145cd.firebaseapp.com).
//    NÃO inclua "https://" ou "/" no final.
//
// Erro Comum 2: "The requested action is invalid." (no popup de login do Google)
// ----------------------------------------------------------------------------
// Causa: Problema de configuração no Firebase Console ou Google Cloud Console.
// Solução:
// 1. Firebase Console > Authentication > Sign-in method:
//    - Provedor "Google" HABILITADO?
//    - "E-mail de suporte do projeto" selecionado para o provedor Google?
// 2. Google Cloud Console (Projeto: processai-145cd) > APIs & Serviços > Tela de consentimento OAuth:
//    - Tela de consentimento configurada? (Nome do app, E-mail de suporte, Domínios autorizados, Contato do desenvolvedor).
//    - Se "Status da Publicação" = "Em teste", seu e-mail de login é um "Usuário de teste"?
//
// Erro Comum 3: 403 Forbidden - "Requests from referer ... are blocked." (API_KEY_HTTP_REFERRER_BLOCKED)
// ----------------------------------------------------------------------------------------------------
// Causa: A Chave de API usada pelo Firebase SDK (valor de NEXT_PUBLIC_FIREBASE_API_KEY)
//        tem "Restrições de aplicativos" > "Referenciadores HTTP (websites)" ATIVADAS
//        no Google Cloud Console, e o domínio de origem da solicitação (ex: NOME_DO_HOST.cloudworkstations.dev
//        OU processai-145cd.firebaseapp.com) NÃO está na lista de permissões dessa Chave de API.
// Solução no Google Cloud Console:
// 1. Vá para Google Cloud Console > Projeto (processai-145cd) > APIs & Serviços > Credenciais.
// 2. Encontre a Chave de API correspondente a NEXT_PUBLIC_FIREBASE_API_KEY.
// 3. Clique no nome da chave para editar.
// 4. Em "Restrições de aplicativos":
//    - Se "Referenciadores HTTP (websites)" estiver selecionado, ADICIONE os domínios necessários:
//      - `6000-firebase-studio-1749115397750.cluster-etsqrqvqyvd4erxx7qq32imrjk.cloudworkstations.dev` (se usado para desenvolvimento)
//      - `processai-145cd.firebaseapp.com` (domínio de hospedagem padrão do Firebase)
//      - `localhost` (se usado para desenvolvimento local)
//      - Seu domínio personalizado (se aplicável).
//      Lembre-se: adicione apenas o nome do host, sem "https://" ou barras finais.
// 5. Salve as alterações e aguarde a propagação (alguns minutos).
//
// APIs Habilitadas no Google Cloud Console:
// - Certifique-se de que "Identity Toolkit API" (Firebase Authentication) e "Cloud Firestore API"
//   estão HABILITADAS no seu projeto Google Cloud.
//
// =====================================================================================

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
      console.info('Firebase sign-in user action:', errorCode, error.message);
    } else {
      console.error("Error signing in with Google (from firebase.ts):", error);
    }
    throw error;
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

export const saveSummary = async (processNumber: string, summaryText: string, summaryJson: any, userId: string): Promise<AppProcessSummary> => {
  try {
    const processData = {
      processNumber,
      summaryText,
      summaryJson,
      userId,
      createdAt: serverTimestamp(),
      status: 'summary_completed' as AppProcessSummary['status'],
    };
    const docRef = await addDoc(collection(db, "processes"), processData);
    return { 
      id: docRef.id, 
      ...processData,
      createdAt: new Date() 
    } as unknown as AppProcessSummary;
  } catch (error) {
    console.error("Error saving summary to Firestore:", error);
    throw error;
  }
};

export const saveDocumentAnalysis = async (processId: string, fileName: string, analysisPrompt: string, analysisResult: any): Promise<AppDocumentAnalysis> => {
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
    } as unknown as AppDocumentAnalysis;
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
  return timestamp && timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(); 
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

export { 
  app, 
  auth, 
  db, 
  googleProvider,
  Timestamp 
};
