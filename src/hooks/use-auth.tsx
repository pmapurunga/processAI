
"use client";

import type { Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  auth, 
  signInWithGoogle as firebaseSignInWithGoogle, 
  signOut as firebaseSignOut, 
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
  setUser: Dispatch<SetStateAction<AuthUser>>; // Still useful for optimistic updates or manual override if needed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
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
      // Auth state change will be handled by onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing in:', error);
      // setUser(null); // Listener will handle this
    } finally {
      // setLoading(false); // Listener will handle final loading state
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await firebaseSignOut();
      // Auth state change will be handled by onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // setLoading(false); // Listener will handle final loading state
    }
  }, []);
  
  const authProviderValue: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    setUser, // Keep setUser for potential advanced use cases, though mostly driven by onAuthStateChanged now
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
