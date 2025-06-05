"use client";

import { AuthButton } from "@/components/auth/AuthButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FileText } from "lucide-react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || (!loading && user)) {
    // Show a loading state or blank screen while redirecting or checking auth
    return (
      <div className="flex min-h-screen items-center justify-center">
        <FileText className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="h-8 w-8" />
          </div>
          <CardTitle className="font-headline text-3xl">ProcessAI</CardTitle>
          <CardDescription className="text-md">
            Automate and streamline your legal document analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6 p-6">
          <p className="text-center text-muted-foreground">
            Sign in to access your dashboard and start analyzing processes.
          </p>
          <AuthButton />
        </CardContent>
      </Card>
       <footer className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} ProcessAI. All rights reserved.
      </footer>
    </div>
  );
}
