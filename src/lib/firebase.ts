

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

// =====================================================================================
// GUIA DE SOLUÇÃO DE PROBLEMAS DE AUTENTICAÇÃO E CONFIGURAÇÃO DO FIREBASE (Projeto: processai-v9qza)
// =====================================================================================
//
// Erro Comum 1: "auth/requests-from-referer...-are-blocked" (Firebase Auth)
// -------------------------------------------------------------------------
// Causa: O domínio de onde seu app está sendo servido (ex: SEU_DOMINIO.cloudworkstations.dev,
//        SEU_DOMINIO.web.app, localhost) NÃO está na lista de "Domínios autorizados"
//        nas configurações de Autenticação do Firebase para o projeto `processai-v9qza`.
// Solução no Firebase Console (para o projeto `processai-v9qza`):
// 1. Vá para Firebase Console > Projeto `processai-v9qza` > Authentication > Settings.
// 2. Em "Authorized domains", clique em "Add domain".
// 3. Adicione o domínio EXATO que aparece na mensagem de erro (sem https:// ou porta).
//    Exemplos:
//    - `6000-nome-do-cluster.cloudworkstations.dev` (para Cloud Workstations, remova a porta :6000)
//    - `studio--processai-v9qza.us-central1.hosted.app` (para Firebase Hosting Preview)
//    - `processai-v9qza.web.app` (para Firebase Hosting)
//    - `localhost` (para desenvolvimento local)
//
// Erro Comum 2: "The requested action is invalid." (no popup de login do Google)
// ----------------------------------------------------------------------------
// Causa: Problema de configuração no Firebase Console ou Google Cloud Console para `processai-v9qza`.
// Solução:
// 1. Firebase Console (`processai-v9qza`) > Authentication > Sign-in method:
//    - Provedor "Google" HABILITADO?
//    - "E-mail de suporte do projeto" selecionado para o provedor Google?
// 2. Google Cloud Console (Projeto: `processai-v9qza`) > APIs & Serviços > Tela de consentimento OAuth:
//    - Tela de consentimento configurada? (Nome do app, E-mail de suporte, Domínios autorizados, Contato do desenvolvedor).
//    - Se "Status da Publicação" = "Em teste", seu e-mail de login é um "Usuário de teste"?
//
// Erro Comum 3: 403 Forbidden - "Requests from referer ... are blocked." (API_KEY_HTTP_REFERRER_BLOCKED)
// ----------------------------------------------------------------------------------------------------
// Causa: A Chave de API usada pelo Firebase SDK (valor de NEXT_PUBLIC_FIREBASE_API_KEY para `processai-v9qza`)
//        tem "Restrições de aplicativos" > "Referenciadores HTTP (websites)" ATIVADAS
//        no Google Cloud Console, e o domínio de origem da solicitação NÃO está na lista de permissões.
// Solução no Google Cloud Console (Projeto: `processai-v9qza`):
// 1. Vá para Google Cloud Console > Projeto `processai-v9qza` > APIs & Serviços > Credenciais.
// 2. Encontre a Chave de API correspondente a NEXT_PUBLIC_FIREBASE_API_KEY.
// 3. Clique no nome da chave para editar.
// 4. Em "Restrições de aplicativos":
//    - Se "Referenciadores HTTP (websites)" estiver selecionado, ADICIONE os domínios necessários:
//      - Domínio do Cloud Workstations (ex: NOME_DO_CLUSTER.cloudworkstations.dev, sem a porta)
//      - `processai-v9qza.firebaseapp.com`
//      - `processai-v9qza.web.app`
//      - `studio--processai-v9qza.us-central1.hosted.app`
//      - `localhost` (se usado para desenvolvimento local)
// 5. Salve as alterações e aguarde a propagação (alguns minutos).
//
// Erro Comum 4: "FirebaseError: Missing or insufficient permissions." (Firestore)
// -----------------------------------------------------------------------------
// Causa: As Regras de Segurança do Firestore para `processai-v9qza` estão bloqueando a operação.
// Solução no Firebase Console (Projeto: `processai-v9qza`) > Firestore Database > Aba "Regras".
//
// Erro Comum 5: "FirebaseError: The query requires an index." (Firestore)
// ------------------------------------------------------------------------
// Causa: Uma consulta composta requer um índice composto que não existe em `processai-v9qza`.
// Solução no Firebase Console (Projeto: `processai-v9qza`) > Firestore Database > Aba "Índices".
//
// APIs Habilitadas no Google Cloud Console (para `processai-v9qza`):
// - "Identity Toolkit API" (Firebase Authentication)
// - "Cloud Firestore API"
// - "Cloud Storage"
// - "Document AI API"
// - "Vertex AI API"
//
// =====================================================================================

// Ajuste para evitar conflito de nomenclatura com os tipos Firebase, se necessário.
import type { Process as AppProcessSummary, DocumentRecord as AppDocumentAnalysis, ProcessSummaryData } from "@/types";
import type { ExtractSummaryFromPdfOutput } from "@/ai/flows/extract-summary-from-pdf";


const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Deve ser 'processai-v9qza' via .env
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
  return timestamp && typeof timestamp.seconds === 'number' ? new Date(timestamp.seconds * 1000) : new Date(); 
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

