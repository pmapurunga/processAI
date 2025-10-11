"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { getProcesses, type ProcessSummary } from "@/lib/firebase"; 
import { Loader2, FilePlus, Eye, ListOrdered, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface IndexErrorState {
  message: string;
  link: string | null;
}

export default function ProcessesListPage() {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // General error
  const [indexError, setIndexError] = useState<IndexErrorState | null>(null); // Specific index error

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      setError(null);
      setIndexError(null);
      getProcesses(user.uid) 
        .then(data => {
          setProcesses(data);
        })
        .catch(err => {
          console.error("Error fetching processes:", err);
          if (err.message && err.message.includes("The query requires an index.")) {
            const match = err.message.match(/(https?:\/\/[^\s]+)/);
            setIndexError({
              message: err.message,
              link: match ? match[0] : null,
            });
          } else {
            setError(err instanceof Error ? err.message : "Failed to load processes.");
          }
        })
        .finally(() => setIsLoading(false));
    } else { // Handle case where user is not logged in initially
        setProcesses([]); 
        setIsLoading(false);
    }
  }, [user]); // Removed isLoading from dependency array

  const renderIndexErrorMessage = () => {
    if (!indexError) return null;
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Firestore Index Required</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            A required Firestore index is missing to list your processes.
            Please create it in the Firebase Console.
          </p>
          {indexError.link ? (
            <a
              href={indexError.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-destructive-foreground underline hover:text-destructive-foreground/80 break-all"
            >
              Click here to create the index
            </a>
          ) : (
            <p>Please check the browser console for a link to create the index.</p>
          )}
          <p className="mt-2 text-xs">
            (Full error: {indexError.message})
          </p>
          <p className="mt-2">
            After creating the index (which may take a few minutes), please refresh this page.
          </p>
        </AlertDescription>
      </Alert>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-[calc(100vh-150px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading your processes...</p>
      </div>
    );
  }

  if (error && !indexError) { // Show general error only if no specific index error
    return (
      <Card className="shadow-lg m-4">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-6 w-6" />Error Loading Processes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center space-x-3">
          <ListOrdered className="h-8 w-8 text-primary" />
          <h1 className="font-headline text-3xl md:text-4xl font-semibold">My Processes</h1>
        </div>
        <Button asChild>
          <Link href="/processes/create">
            <FilePlus className="mr-2 h-5 w-5" />
            Create New Process
          </Link>
        </Button>
      </div>

      {renderIndexErrorMessage()}

      {!user && !indexError ? (
        <Card className="text-center py-12 shadow-lg">
          <CardContent className="flex flex-col items-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4"/>
            <h2 className="text-2xl font-semibold mb-2 text-foreground">Please Log In</h2>
            <p className="text-muted-foreground mb-6">
              You need to be logged in to view your processes.
            </p>
            <Button asChild size="lg">
              <Link href="/login">
                Log In
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : processes.length === 0 && !indexError && !isLoading ? (
        <Card className="text-center py-12 shadow-lg border-dashed">
          <CardContent className="flex flex-col items-center">
            <Image src="https://placehold.co/300x200.png?text=No+Processes+Yet" alt="No processes illustration" width={300} height={200} data-ai-hint="empty state documents" className="mb-6 rounded-lg opacity-60"/>
            <h2 className="text-2xl font-semibold mb-2 text-foreground">No Processes Found</h2>
            <p className="text-muted-foreground mb-6">
              It looks like you haven't created any process analyses yet.
            </p>
            <Button asChild size="lg">
              <Link href="/processes/create">
                <FilePlus className="mr-2 h-5 w-5" />
                Start Your First Analysis
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : !indexError && processes.length > 0 ? (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>All Process Analyses</CardTitle>
            <CardDescription>
              Here is a list of all the processes you have initiated analysis for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Process Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processes.map((process) => (
                  <TableRow key={process.id}>
                    <TableCell className="font-medium">{process.processNumber}</TableCell>
                    <TableCell>
                       <Badge variant={process.status === 'chat_ready' || process.status === 'documents_completed' ? 'default' : 'secondary'} className={cn(
                        'capitalize',
                        {'bg-green-100 text-green-700 border-green-300': process.status === 'chat_ready' || process.status === 'documents_completed'},
                        {'bg-blue-100 text-blue-700 border-blue-300': process.status === 'summary_completed'},
                        {'bg-yellow-100 text-yellow-700 border-yellow-300': process.status === 'documents_pending' || process.status === 'summary_pending'}
                       )}>
                        {process.status ? process.status.replace(/_/g, ' ') : 'N/A'}
                       </Badge>
                    </TableCell>
                    <TableCell>{process.createdAt instanceof Date ? process.createdAt.toLocaleDateString() : new Date(process.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/processes/${process.id}/summary`}>
                          <Eye className="mr-1.5 h-4 w-4" /> View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter className="justify-center border-t pt-4">
                <p className="text-sm text-muted-foreground">
                    Showing {processes.length} process(es).
                </p>
            </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}

    