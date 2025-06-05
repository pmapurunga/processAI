

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
// =====================================================================================
// GUIA DE SOLUÇÃO DE PROBLEMAS DE AUTENTICAÇÃO E CONFIGURAÇÃO DO FIREBASE
// =====================================================================================
//
// Erro Comum 1: "auth/requests-from-referer...-are-blocked" (Firebase Auth)
// -------------------------------------------------------------------------
// Causa: O domínio de onde seu app está sendo servido (ex: NOME_DO_HOST.cloudworkstations.dev)
//        NÃO está na lista de "Domínios autorizados" nas configurações de Autenticação do Firebase.
// Solução no Firebase Console:
// 1. Vá para Firebase Console > Projeto (processai-145cd) > Authentication > Settings.
// 2. Em "Authorized domains", adicione o domínio EXATO.
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
//      - Domínio do Cloud Workstations (ex: XXXXX.cloudworkstations.dev)
//      - `processai-145cd.firebaseapp.com` (domínio de hospedagem padrão do Firebase)
//      - `processai-145cd.web.app` (outro domínio de hospedagem padrão do Firebase)
//      - `localhost` (se usado para desenvolvimento local)
//      Lembre-se: adicione apenas o nome do host, sem "https://" ou barras finais.
// 5. Salve as alterações e aguarde a propagação (alguns minutos).
//
// Erro Comum 4: "FirebaseError: Missing or insufficient permissions." (Firestore)
// -----------------------------------------------------------------------------
// Causa: As Regras de Segurança do Firestore estão bloqueando a operação de leitura ou escrita.
// Solução no Firebase Console:
// 1. Vá para Firebase Console > Projeto (processai-145cd) > Firestore Database > Aba "Regras".
// 2. Verifique suas regras. Para desenvolvimento, você pode usar temporariamente (NÃO PARA PRODUÇÃO):
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /{document=**} {
//          allow read, write: if request.auth != null; // Permite se autenticado
//        }
//      }
//    }
// 3. Para produção, use regras granulares. Exemplo para sua estrutura:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /processes/{processId} {
//          allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
//          allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
//
//          match /documentAnalyses/{analysisId} {
//            allow create: if request.auth != null && get(/databases/$(database)/documents/processes/$(processId)).data.userId == request.auth.uid;
//            allow read, update, delete: if request.auth != null && get(/databases/$(database)/documents/processes/$(processId)).data.userId == request.auth.uid;
//          }
//        }
//      }
//    }
//    Certifique-se de que você está salvando um campo 'userId' em cada documento da coleção 'processes'.
//    Publique as regras após editá-las.
//
// APIs Habilitadas no Google Cloud Console:
// - Certifique-se de que "Identity Toolkit API" (Firebase Authentication) e "Cloud Firestore API"
//   estão HABILITADAS no seu projeto Google Cloud.
//
// =====================================================================================

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
      // summaryText não é mais fornecido diretamente pela flow de extração de sumário
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
