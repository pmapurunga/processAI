
"use client";

import { usePathname, useParams, useRouter } from "next/navigation"; // Added useRouter
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ListChecks, MessageSquare } from "lucide-react";
import { getProcessSummary, type ProcessSummary as FirebaseProcessSummary } from "@/lib/firebase"; // Updated import
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // Added useToast

export default function ProcessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter(); // Initialize router
  const { toast } = useToast(); // Initialize toast
  const processId = params.processId as string;
  
  const [processSummary, setProcessSummary] = useState<FirebaseProcessSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [errorLoading, setErrorLoading] = useState<string | null>(null);

  useEffect(() => {
    if (processId) {
      setIsLoadingSummary(true);
      setErrorLoading(null);
      getProcessSummary(processId) // Updated function call
        .then(summary => {
          if (summary) {
            setProcessSummary(summary);
          } else {
            setErrorLoading("Process not found.");
            toast({
              title: "Error",
              description: `Process with ID ${processId} could not be found. Redirecting to dashboard.`,
              variant: "destructive"
            });
            router.replace("/dashboard"); // Redirect if process not found
          }
          setIsLoadingSummary(false);
        })
        .catch(error => {
          console.error("Error fetching process summary:", error);
          setErrorLoading("Failed to load process details.");
          toast({
            title: "Loading Error",
            description: "Could not load process details. Please try again later.",
            variant: "destructive"
          });
          setIsLoadingSummary(false);
        });
    }
  }, [processId, router, toast]);

  const getActiveTab = () => {
    if (pathname.endsWith("/summary")) return "summary";
    if (pathname.endsWith("/documents")) return "documents";
    if (pathname.endsWith("/chat")) return "chat";
    return "summary";
  };

  const tabs = [
    { value: "summary", label: "Summary", icon: FileText, href: `/processes/${processId}/summary` },
    { value: "documents", label: "Documents Analysis", icon: ListChecks, href: `/processes/${processId}/documents` },
    { value: "chat", label: "Consolidated Chat", icon: MessageSquare, href: `/processes/${processId}/chat` },
  ];

  if (isLoadingSummary) {
     return (
      <div className="container mx-auto py-2">
        <Card className="mb-6 shadow-md">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="p-0">
             <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
        <div className="flex justify-center items-center h-64">
          <Skeleton className="h-32 w-full"/>
        </div>
      </div>
    );
  }

  if (errorLoading && !processSummary) { // If there was an error and no summary loaded (e.g. process not found)
    return (
       <div className="container mx-auto py-8 text-center">
          <Card className="max-w-md mx-auto shadow-lg">
            <CardHeader>
                <CardTitle className="text-destructive">Error Loading Process</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-lg text-muted-foreground mb-4">{errorLoading}</p>
                <Button asChild>
                    <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
            </CardContent>
          </Card>
        </div>
    );
  }


  return (
    <div className="container mx-auto py-2">
      <Card className="mb-6 shadow-md">
        <CardHeader>
          {processSummary ? (
            <>
            <CardTitle className="font-headline text-xl md:text-2xl">
              Process: {processSummary.processNumber}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Created on: {processSummary.createdAt instanceof Date ? processSummary.createdAt.toLocaleDateString() : new Date(processSummary.createdAt).toLocaleDateString()}
            </p>
            </>
          ) : (
             <CardTitle className="font-headline text-xl md:text-2xl text-destructive">
              Process Information Unavailable
            </CardTitle>
          )}
        </CardHeader>
        {processSummary && ( // Only show tabs if summary is loaded
        <CardContent className="p-0">
          <Tabs value={getActiveTab()} className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-none border-b h-auto">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} asChild className="py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none">
                  <Link href={tab.href} className="flex items-center justify-center gap-2">
                    <tab.icon className="h-5 w-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
        )}
      </Card>
      {processSummary ? children : 
        <div className="text-center py-10">
          {/* This part might not be reached if redirection or error display above catches it */}
          <p className="text-lg text-muted-foreground">This process could not be loaded or does not exist.</p>
          <Link href="/dashboard">
            <Button variant="link" className="mt-4">Go to Dashboard</Button>
          </Link>
        </div>
      }
    </div>
  );
}
