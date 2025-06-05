"use client";

import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ListChecks, MessageSquare } from "lucide-react";
import { mockGetProcessSummary, type ProcessSummary } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProcessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const processId = params.processId as string;
  
  const [processSummary, setProcessSummary] = useState<ProcessSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  useEffect(() => {
    if (processId) {
      setIsLoadingSummary(true);
      mockGetProcessSummary(processId)
        .then(summary => {
          setProcessSummary(summary);
          setIsLoadingSummary(false);
        })
        .catch(error => {
          console.error("Error fetching process summary:", error);
          setIsLoadingSummary(false);
        });
    }
  }, [processId]);

  const getActiveTab = () => {
    if (pathname.endsWith("/summary")) return "summary";
    if (pathname.endsWith("/documents")) return "documents";
    if (pathname.endsWith("/chat")) return "chat";
    return "summary"; // Default or based on further logic
  };

  const tabs = [
    { value: "summary", label: "Summary", icon: FileText, href: `/processes/${processId}/summary` },
    { value: "documents", label: "Documents Analysis", icon: ListChecks, href: `/processes/${processId}/documents` },
    { value: "chat", label: "Consolidated Chat", icon: MessageSquare, href: `/processes/${processId}/chat` },
  ];

  return (
    <div className="container mx-auto py-2">
      <Card className="mb-6 shadow-md">
        <CardHeader>
          {isLoadingSummary ? (
            <>
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </>
          ) : processSummary ? (
            <>
            <CardTitle className="font-headline text-xl md:text-2xl">
              Process: {processSummary.processNumber}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Created on: {new Date(processSummary.createdAt).toLocaleDateString()}
            </p>
            </>
          ) : (
             <CardTitle className="font-headline text-xl md:text-2xl text-destructive">
              Process Not Found
            </CardTitle>
          )}
        </CardHeader>
        {processSummary && (
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
          <p className="text-lg text-muted-foreground">This process could not be loaded or does not exist.</p>
          <Link href="/dashboard">
            <Button variant="link" className="mt-4">Go to Dashboard</Button>
          </Link>
        </div>
      }
    </div>
  );
}
