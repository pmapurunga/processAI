'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/icons/Logo';

export default function LoginPage() {
  const { user, loading, signInWithGoogle, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  // Show loading spinner if auth state is loading OR if user exists (implies redirecting)
  if (loading || (!loading && user)) { 
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading or redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-sm shadow-2xl rounded-xl border-border/50">
        <CardHeader className="text-center p-8">
          <div className="mx-auto mb-6 w-2/3 sm:w-1/2">
             <Logo className="h-12 w-auto" />
          </div>
          <CardTitle className="text-3xl font-headline text-foreground">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-md text-muted-foreground pt-1">
            Sign in to access your intelligent document processor.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-6">
          {error && (
            <div className="text-center text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
              <p className="font-medium">Sign-in Error</p>
              <p>{error.message}</p>
            </div>
          )}
          <Button 
            onClick={signInWithGoogle} 
            className="w-full text-base py-6 rounded-lg shadow-md hover:shadow-lg transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            disabled={loading} // Technically loading should be false here, but good practice
            variant="default"
          >
            {loading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.5 512 0 398.8 0 256S110.5 0 244 0c69.8 0 130.8 28.2 175.2 72.9L347 147.4C329.8 130.6 300.1 117 244 117c-73.2 0-132.3 60.2-132.3 134.9s59.1 134.9 132.3 134.9c76.9 0 110.5-52.4 114.9-79.6H244v-61.8h243.6c2.9 16.2 4.4 33.2 4.4 50.8z"></path>
              </svg>
            )}
            Sign In with Google
          </Button>
        </CardContent>
        <CardFooter className="px-8 pb-8">
            <p className="text-xs text-center text-muted-foreground w-full">
                By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
