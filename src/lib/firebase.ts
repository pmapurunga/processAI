
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
import type { ProcessSummary, DocumentAnalysis } from "@/types"; // Updated import from @/types

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

// ATENÇÃO: Erro "The requested action is invalid." no popup do Google Sign-In
// Este erro geralmente indica um problema de configuração no Firebase Console ou Google Cloud Console:
// 1. Firebase Console > Authentication > Sign-in method:
//    - Certifique-se de que o provedor "Google" está HABILITADO.
//    - Verifique se um "E-mail de suporte do projeto" está selecionado para o provedor Google.
// 2. Google Cloud Console (Projeto: processai-145cd) > APIs & Serviços > Tela de consentimento OAuth:
//    - Verifique se a tela de consentimento está configurada corretamente.
//    - Nome do Aplicativo: Defina um nome para seu app.
//    - E-mail para Suporte ao Usuário: Selecione seu e-mail.
//    - Domínios Autorizados: Adicione '6000-firebase-studio-1749115397750.cluster-etsqrqvqyvd4erxx7qq32imrjk.cloudworkstations.dev' (e seu domínio de produção).
//    - Informações de Contato do Desenvolvedor: Preencha seu e-mail.
//    - Status da Publicação: Se "Em teste", adicione seu e-mail de login como "Usuário de teste". Considere publicar o app se estiver pronto.
// 3. Google Cloud Console (Projeto: processai-145cd) > APIs & Serviços > Credenciais:
//    - Encontre a Chave de API usada pelo seu app (geralmente o valor de NEXT_PUBLIC_FIREBASE_API_KEY).
//    - Clique no nome da chave para editar.
//    - Em "Restrições de aplicativos":
//        - Se "Referenciadores HTTP (websites)" estiver selecionado, certifique-se de que
//          '6000-firebase-studio-1749115397750.cluster-etsqrqvqyvd4erxx7qq32imrjk.cloudworkstations.dev' (e outros domínios necessários) está na lista.
//          Adicione o domínio sem 'https://' ou barras finais.
//    - Em "Restrições de API":
//        - Certifique-se de que "Identity Toolkit API" (usada pelo Firebase Auth) e "Cloud Firestore API" estão permitidas se você estiver restringindo APIs.
//          Geralmente, é mais seguro não restringir por API, a menos que necessário.
// 4. APIs Habilitadas no Google Cloud Console:
//    - Verifique se "Identity Toolkit API" (Firebase Authentication) e "Cloud Firestore API" estão habilitadas no seu projeto Google Cloud.
//      O Firebase geralmente as habilita automaticamente, mas vale a pena conferir.
// Lembre-se que após qualquer alteração no console, pode haver um tempo de propagação.


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

// This type is now defined directly in use-auth.tsx and firebase.ts uses it from there or implicitly
// export type AuthUser = {
//   uid: string;
//   displayName: string | null;
//   email: string | null;
//   photoURL: string | null;
// } | null;

export const signInWithGoogle = async (): Promise<FirebaseUserType> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // The user object from signInWithPopup is already a FirebaseUser type
    return result.user;
  } catch (error: any) {
    const errorCode = error?.code;
    // Log less critical errors as warnings or info, or handle them silently if preferred
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/popup-blocked'
    ) {
      console.info('Firebase sign-in user action:', errorCode);
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
      summaryJson, // Save the full JSON output
      userId,
      createdAt: serverTimestamp(), // Use serverTimestamp for consistency
      status: 'summary_completed' as ProcessSummary['status'], // Set initial status
    };
    const docRef = await addDoc(collection(db, "processes"), processData);
    // For immediate use, we construct the ProcessSummary object with a client-side date.
    // Firestore will store a Timestamp, which will be converted back to Date on retrieval.
    return { 
      id: docRef.id, 
      ...processData,
      createdAt: new Date() // For optimistic update, actual value is server timestamp
    } as unknown as ProcessSummary; // Cast because serverTimestamp() isn't Date immediately
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
      analysisResult, // Store the JSON object directly
      uploadedAt: serverTimestamp(),
      processId, // Link back to the parent process
    };
    const docRef = await addDoc(collection(db, "processes", processId, "documentAnalyses"), analysisData);
    
    // Update the parent process status
    await setDoc(doc(db, "processes", processId), { status: 'documents_completed', updatedAt: serverTimestamp() }, { merge: true });

    return { 
      id: docRef.id, 
      ...analysisData,
      uploadedAt: new Date() // For optimistic update
    } as unknown as DocumentAnalysis; // Cast due to serverTimestamp
  } catch (error) {
    console.error("Error saving document analysis to Firestore:", error);
    throw error;
  }
};

// Helper to convert Firestore Timestamp to Date, handling both types
const convertTimestampToDate = (timestamp: any): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  // If it's already a Date (e.g., from optimistic update), return it
  if (timestamp instanceof Date) {
    return timestamp;
  }
  // Fallback for serialized timestamps (less ideal, but can happen)
  // or if serverTimestamp() was somehow not yet converted by Firestore client.
  return timestamp && timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(); 
};


export const getDocumentAnalyses = async (processId: string): Promise<DocumentAnalysis[]> => {
  try {
    const analysesCol = collection(db, "processes", processId, "documentAnalyses");
    const q = query(analysesCol, orderBy("uploadedAt", "desc")); // Order by upload time
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        uploadedAt: convertTimestampToDate(data.uploadedAt),
      } as DocumentAnalysis; // Cast to ensure type correctness
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
  Timestamp // Export Timestamp if it's used externally, otherwise it's internal
};
