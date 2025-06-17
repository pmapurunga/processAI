
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithPopup, // Alterado de volta para signInWithPopup
  // getRedirectResult, // Não é mais necessário para popup
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();

  const isAdmin = !!user; // Simplificado, pode ser ajustado se houver lógica de admin real

  useEffect(() => {
    // Apenas onAuthStateChanged é necessário para o fluxo de popup e estado inicial
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      setError(null); // Limpa erros se o estado de autenticação for resolvido
    }, (err) => {
      console.error("onAuthStateChanged Error:", err);
      setError(err);
      setUser(null);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      // O usuário é definido pelo onAuthStateChanged, mas podemos limpar o erro aqui
      // setUser(result.user); // Opcional, onAuthStateChanged já fará isso
      if (result.user) {
        router.push('/dashboard'); // Redireciona após login bem-sucedido
      }
    } catch (popupError) {
      console.error("Google Sign-In Popup Error:", popupError);
      setError(popupError as Error);
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null); // Garante que o estado do usuário seja limpo imediatamente
      router.push('/login');
    } catch (err) {
      setError(err as Error);
      console.error("Sign-Out Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOutUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
