"use client";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
// AuthProvider is removed from here, as it's now in the root layout.
// useAuth will pick up context from the root AuthProvider.
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); // This will now use context from RootLayout's AuthProvider
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 md:ml-64 pt-4 pb-8 px-4 sm:px-6 lg:px-8 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The <AuthProvider> wrapper is removed from here.
  // AppLayoutContent will inherit the auth context from the RootLayout.
  return (
    <AppLayoutContent>{children}</AppLayoutContent>
  );
}
