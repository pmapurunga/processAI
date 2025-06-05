// TODO: Initialize Firebase App
// import { initializeApp, getApp, getApps } from "firebase/app";
// import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
// import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";
// import type { User } from "firebase/auth";

// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
// };

// let app;
// if (typeof window !== 'undefined' && !getApps().length) {
//   app = initializeApp(firebaseConfig);
// } else if (typeof window !== 'undefined') {
//   app = getApp();
// }

// const auth = app ? getAuth(app) : undefined;
// const db = app ? getFirestore(app) : undefined;
// const googleProvider = app ? new GoogleAuthProvider() : undefined;


// export { app, auth, db, googleProvider, signInWithPopup, firebaseSignOut, doc, setDoc, getDoc, collection, addDoc, query, where, getDocs };
// export type { User };


// MOCK IMPLEMENTATIONS (Remove these once Firebase is properly configured)

export interface MockUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const mockSignInWithGoogle = async (): Promise<{ user: MockUser } | null> => {
  console.log("Mock: Signing in with Google...");
  // Simulate a successful sign-in
  await new Promise(resolve => setTimeout(resolve, 500));
  const mockUser: MockUser = {
    uid: 'mock-user-uid-' + Math.random().toString(36).substring(7),
    displayName: 'Mock User',
    email: 'mock.user@example.com',
    photoURL: 'https://placehold.co/100x100.png?text=MU',
  };
  // Store mock user in localStorage to persist session for demo purposes
  if (typeof window !== 'undefined') {
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
  }
  return { user: mockUser };
};

export const mockSignOut = async (): Promise<void> => {
  console.log("Mock: Signing out...");
  await new Promise(resolve => setTimeout(resolve, 300));
  if (typeof window !== 'undefined') {
    localStorage.removeItem('mockUser');
  }
};

export const mockGetCurrentUser = (): MockUser | null => {
  if (typeof window !== 'undefined') {
    const storedUser = localStorage.getItem('mockUser');
    if (storedUser) {
      return JSON.parse(storedUser) as MockUser;
    }
  }
  return null;
};


export interface ProcessSummary {
  id?: string;
  processNumber: string;
  summaryText: string;
  summaryJson: any;
  createdAt: Date;
  userId: string;
}

export interface DocumentAnalysis {
  id?: string;
  fileName: string;
  analysisPrompt: string;
  analysisResult: any;
  uploadedAt: Date;
  processId: string;
}

// Placeholder Firestore functions
export const mockSaveSummary = async (processNumber: string, summaryText: string, summaryJson: any, userId: string): Promise<ProcessSummary> => {
  console.log(`Mock: Saving summary for process ${processNumber}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const newSummary: ProcessSummary = { 
    id: processNumber, // Using processNumber as ID for mock
    processNumber, 
    summaryText, 
    summaryJson, 
    createdAt: new Date(),
    userId
  };
  // Mock storing in localStorage
  if (typeof window !== 'undefined') {
    const processes = JSON.parse(localStorage.getItem('mockProcesses') || '{}');
    processes[processNumber] = { summary: newSummary, documents: {} };
    localStorage.setItem('mockProcesses', JSON.stringify(processes));
  }
  return newSummary;
};

export const mockSaveDocumentAnalysis = async (processId: string, fileName: string, analysisPrompt: string, analysisResult: any): Promise<DocumentAnalysis> => {
  console.log(`Mock: Saving analysis for ${fileName} in process ${processId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  const newAnalysis: DocumentAnalysis = {
    id: `${processId}-${fileName}-${Date.now()}`,
    fileName,
    analysisPrompt,
    analysisResult,
    uploadedAt: new Date(),
    processId
  };
   if (typeof window !== 'undefined') {
    const processes = JSON.parse(localStorage.getItem('mockProcesses') || '{}');
    if (processes[processId]) {
      processes[processId].documents = processes[processId].documents || {};
      processes[processId].documents[newAnalysis.id!] = newAnalysis;
      localStorage.setItem('mockProcesses', JSON.stringify(processes));
    }
  }
  return newAnalysis;
};

export const mockGetDocumentAnalyses = async (processId: string): Promise<DocumentAnalysis[]> => {
  console.log(`Mock: Fetching analyses for process ${processId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  if (typeof window !== 'undefined') {
    const processes = JSON.parse(localStorage.getItem('mockProcesses') || '{}');
    if (processes[processId] && processes[processId].documents) {
      return Object.values(processes[processId].documents);
    }
  }
  return [
    // { id: '1', fileName: "doc1.pdf", analysisPrompt: "Test prompt", analysisResult: { summary: "Analysis for doc1" }, uploadedAt: new Date(), processId },
    // { id: '2', fileName: "doc2.pdf", analysisPrompt: "Test prompt", analysisResult: { summary: "Analysis for doc2" }, uploadedAt: new Date(), processId },
  ];
};

export const mockGetProcesses = async (userId: string): Promise<ProcessSummary[]> => {
  console.log(`Mock: Fetching processes for user ${userId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  if (typeof window !== 'undefined') {
    const processes = JSON.parse(localStorage.getItem('mockProcesses') || '{}');
    return Object.values(processes)
      .map((p: any) => p.summary)
      .filter((s: ProcessSummary) => s.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return [];
}

export const mockGetProcessSummary = async (processId: string): Promise<ProcessSummary | null> => {
  console.log(`Mock: Fetching summary for process ${processId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
   if (typeof window !== 'undefined') {
    const processes = JSON.parse(localStorage.getItem('mockProcesses') || '{}');
    if (processes[processId]) {
      return processes[processId].summary;
    }
  }
  return null;
}

// End MOCK IMPLEMENTATIONS
