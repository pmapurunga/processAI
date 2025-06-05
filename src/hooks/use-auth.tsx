
"use client";
// THIS FILE REQUIRES THE .tsx EXTENSION because it contains JSX.
// Please ensure it is named use-auth.tsx

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  auth, 
  signInWithGoogle as firebaseSignInWithGoogle, 
  signOutFirebaseAuth as firebaseSignOut, 
  type FirebaseUser 
} from '@/lib/firebase';
import { onAuthStateChanged } from "firebase/auth";

// Using FirebaseUser directly or a mapped version
export type AuthUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
} | null;

interface AuthContextType {
  user: AuthUser;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  setUser: Dispatch<SetStateAction<AuthUser>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUserResult: FirebaseUser | null) => {
      if (firebaseUserResult) {
        setUser({
          uid: firebaseUserResult.uid,
          displayName: firebaseUserResult.displayName,
          email: firebaseUserResult.email,
          photoURL: firebaseUserResult.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignInWithGoogle();
      // Auth state change (success) will be handled by onAuthStateChanged listener,
      // which will also set loading to false.
    } catch (e: unknown) {
      let errorCode: string | undefined;
      // Safely access error code
      if (typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: string }).code === 'string') {
        errorCode = (e as { code: string }).code;
      }

      if (errorCode === 'auth/popup-closed-by-user') {
        console.info('Sign-in popup closed by user.');
      } else if (errorCode === 'auth/cancelled-popup-request') {
        console.info('Sign-in cancelled: Another popup request was made before the current one could complete.');
      } else if (errorCode === 'auth/popup-blocked') {
        console.warn('Sign-in popup was blocked by the browser. Please ensure popups are enabled for this site.');
        // Consider showing a toast to the user here.
        // Example: toast({ title: "Popup Blocked", description: "Please enable popups to sign in.", variant: "destructive" });
      } else {
        console.error('Error signing in (from use-auth.tsx):', e);
      }
      // Ensure user is null and loading is false if the sign-in process itself fails
      // This provides more immediate state reset than waiting for onAuthStateChanged in error cases.
      setUser(null); 
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    // setLoading(true); // User will be set to null by onAuthStateChanged, which also sets loading to false
    try {
      await firebaseSignOut();
      // Auth state change will be handled by onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing out:', error);
      // setLoading(false); // In case of error, ensure loading is reset if onAuthStateChanged doesn't cover it
    }
    // setLoading(false) will be called by onAuthStateChanged when user becomes null
  }, []);
  
  const authProviderValue: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    setUser,
  };

  return (
    <AuthContext.Provider value={authProviderValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
