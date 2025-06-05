// IMPORTANT: This file contains JSX and therefore needs to have a .tsx file extension.
// Please rename this file from use-auth.ts to use-auth.tsx to resolve JSX parsing errors.
"use client";

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockSignInWithGoogle, mockSignOut, mockGetCurrentUser, type MockUser } from '@/lib/firebase';
// import { auth, googleProvider, signInWithPopup, firebaseSignOut, type User } from '@/lib/firebase';
// import { onAuthStateChanged } from "firebase/auth";

// Replace MockUser with User from firebase/auth when using real Firebase
type AuthUser = MockUser | null;

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
    // MOCK AUTH STATE
    const currentUser = mockGetCurrentUser();
    setUser(currentUser);
    setLoading(false);

    // REAL FIREBASE AUTH STATE LISTENER (Uncomment when firebase.ts is configured)
    // if (!auth) {
    //   setLoading(false);
    //   console.warn("Firebase auth is not initialized.");
    //   return;
    // }
    // const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    //   if (firebaseUser) {
    //     setUser({
    //       uid: firebaseUser.uid,
    //       displayName: firebaseUser.displayName,
    //       email: firebaseUser.email,
    //       photoURL: firebaseUser.photoURL,
    //     });
    //   } else {
    //     setUser(null);
    //   }
    //   setLoading(false);
    // });
    // return () => unsubscribe();
  }, []);

  const signIn = useCallback(async () => {
    setLoading(true);
    try {
      // MOCK SIGN IN
      const result = await mockSignInWithGoogle();
      if (result) {
        setUser(result.user);
      }
      // REAL FIREBASE SIGN IN (Uncomment when firebase.ts is configured)
      // if (!auth || !googleProvider) {
      //   throw new Error("Firebase auth or provider not initialized.");
      // }
      // const result = await signInWithPopup(auth, googleProvider);
      // if (result.user) {
      //   setUser({
      //     uid: result.user.uid,
      //     displayName: result.user.displayName,
      //     email: result.user.email,
      //     photoURL: result.user.photoURL,
      //   });
      // }
    } catch (error) {
      console.error('Error signing in:', error);
      setUser(null); // Ensure user is null on error
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      // MOCK SIGN OUT
      await mockSignOut();
      setUser(null);
      // REAL FIREBASE SIGN OUT (Uncomment when firebase.ts is configured)
      // if (!auth) {
      //   throw new Error("Firebase auth not initialized.");
      // }
      // await firebaseSignOut(auth);
      // setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const authProviderValue = {
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
