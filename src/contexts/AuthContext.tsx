
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithRedirect, // Alterado de signInWithPopup
  getRedirectResult,   // Adicionado para processar o resultado do redirect
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

  const isAdmin = !!user;

  useEffect(() => {
    const processAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Usuário logado com sucesso via redirect.
          // onAuthStateChanged abaixo irá definir o usuário e loading.
          setError(null); // Limpa erros anteriores se o redirect foi bem-sucedido.
        }
      } catch (redirectError) {
        // Erro durante o processo de login por redirecionamento.
        console.error("Google Sign-In Redirect Error:", redirectError);
        setError(redirectError as Error);
      }
      // Não defina setLoading(false) aqui, deixe onAuthStateChanged cuidar disso.
    };

    processAuth(); // Processa o resultado do redirect ao carregar o app.

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // Estado de autenticação determinado (usuário ou null)
    }, (err) => {
      // Erro ao observar o estado de autenticação (raro, mas possível)
      console.error("onAuthStateChanged Error:", err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleAuthProvider);
      // Após esta chamada, a página será redirecionada para o Google.
      // A execução do código aqui para, e o resultado será tratado
      // por getRedirectResult e onAuthStateChanged quando a página recarregar.
    } catch (initiationError) {
      // Este catch só será acionado se houver um erro ao *iniciar* o redirecionamento
      // (ex: Firebase não configurado corretamente, rede offline no momento da chamada inicial)
      console.error("Google Sign-In (redirect initiation) Error:", initiationError);
      setError(initiationError as Error);
      setLoading(false); // Houve uma falha ao iniciar o processo, então pare de carregar.
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
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
