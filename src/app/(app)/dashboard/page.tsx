
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { getProcesses, type ProcessSummary } from "@/lib/firebase"; // Updated import
import { FilePlus, ListChecks, MessageSquare, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  const { user } = useAuth();
  const [recentProcesses, setRecentProcesses] = useState<ProcessSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      getProcesses(user.uid) // Updated function call
        .then(processes => {
          setRecentProcesses(processes.slice(0, 3)); // Show top 3 recent
          setIsLoading(false);
        })
        .catch(error => {
          console.error("Error fetching recent processes:", error);
          setIsLoading(false);
        });
    }
  }, [user]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="font-headline text-3xl md:text-4xl font-semibold text-foreground">
          Welcome back, {user?.displayName?.split(" ")[0] || "User"}!
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage your legal process analyses efficiently.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Analysis</CardTitle>
            <FilePlus className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Start Fresh</div>
            <p className="text-xs text-muted-foreground mb-4">Upload a summary PDF to begin.</p>
            <Button asChild className="w-full">
              <Link href="/processes/create">Create New Process</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Analysis</CardTitle>
            <ListChecks className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Deep Dive</div>
            <p className="text-xs text-muted-foreground mb-4">Analyze multiple documents for a case.</p>
             <Button variant="outline" className="w-full" asChild>
                <Link href="/processes">Select Process</Link>
             </Button> 
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consolidated Chat</CardTitle>
            <MessageSquare className="h-5 w-5 text-destructive" /> 
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AI Assistant</div>
            <p className="text-xs text-muted-foreground mb-4">Chat about your consolidated findings.</p>
            <Button variant="outline" className="w-full" asChild>
                <Link href="/processes">Select Process</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Separator className="my-8"/>

      <div>
        <h2 className="font-headline text-2xl font-semibold text-foreground mb-4">Recent Processes</h2>
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : recentProcesses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentProcesses.map((process) => (
              <Card key={process.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="truncate font-headline text-lg">{process.processNumber}</CardTitle>
                  <CardDescription>Created: {process.createdAt instanceof Date ? process.createdAt.toLocaleDateString() : new Date(process.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 h-10">
                    {process.summaryText || "No summary text available."}
                  </p>
                </CardContent>
                <div className="border-t p-4">
                   <Button asChild variant="ghost" className="w-full justify-start text-primary">
                     <Link href={`/processes/${process.id}/summary`}>View Details</Link>
                   </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center justify-center py-12 text-center bg-card border-dashed">
            <Image src="https://placehold.co/300x200.png?text=No+Processes" alt="No processes" width={300} height={200} className="mb-4 rounded opacity-50" data-ai-hint="empty state illustration"/>
            <p className="text-lg font-medium text-muted-foreground">No recent processes found.</p>
            <p className="text-sm text-muted-foreground mb-4">Start by creating a new process analysis.</p>
            <Button asChild>
              <Link href="/processes/create">
                <FilePlus className="mr-2 h-4 w-4" /> Create New Process
              </Link>
            </Button>
          </Card>
        )}
         {recentProcesses.length > 0 && (
            <div className="mt-6 text-center">
                <Button variant="outline" asChild>
                    <Link href="/processes">View All My Processes</Link>
                </Button>
            </div>
        )}
      </div>
    </div>
  );
}
