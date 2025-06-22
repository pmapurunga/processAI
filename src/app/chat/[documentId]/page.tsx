'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // Import useParams
import { getDocumentById, getChatMessages } from '@/app/actions';
import ChatInterface from '@/components/ChatInterface';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import type { DocumentMetadata, ChatMessage } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'; // Added Card imports for loading skeleton

export default function ChatPage() { 
  const routeParams = useParams();
  const documentId = routeParams.documentId as string;

  const { user, loading: authLoading } = useAuth();

  const [document, setDocument] = useState<DocumentMetadata | null | undefined>(undefined);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    if (authLoading) {
      return;
    }

    if (!user) {
      setLoadingData(false);
      setError("User not authenticated.");
      return;
    }

    setLoadingData(true);
    setError(null);

    async function fetchData() {
      try {
        const doc = await getDocumentById(documentId);
        setDocument(doc);

        if (doc && doc.status === 'processed') {
          const messages = await getChatMessages(documentId);
          setInitialMessages(messages);
        } else if (doc && doc.status !== 'processed') {
          setInitialMessages([]);
        } else if (!doc) {
           setInitialMessages([]);
        }
      } catch (e) {
        console.error("Error fetching chat page data:", e);
        setError(e instanceof Error ? e.message : "Failed to load document data.");
        setDocument(null);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [documentId, user, authLoading]);

  if (!documentId || authLoading || (loadingData && document === undefined)) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Document</AlertTitle>
          <AlertDescription>
            {error || "The document you are trying to access could not be loaded."}
            <br />
            <Button asChild variant="link" className="mt-2">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!document && !loadingData) {
    return (
      <div className="container mx-auto py-8 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Document Not Found</AlertTitle>
          <AlertDescription>
            The document you are trying to access does not exist.
            <br />
            <Button asChild variant="link" className="mt-2">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (document && document.status !== 'processed' && !loadingData) {
     return (
      <div className="container mx-auto py-8 text-center">
        <Alert variant="default" className="max-w-md mx-auto bg-secondary">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Document Not Ready</AlertTitle>
          <AlertDescription>
            This document is currently '{document.status}' and not yet ready for chat. Please check back later.
             <br />
            <Button asChild variant="link" className="mt-2">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (document && document.status === 'processed' && loadingData) {
     return (
      <div className="container mx-auto h-full flex flex-col items-center py-2">
         <Card className="w-full h-[calc(100vh-10rem)] flex flex-col shadow-2xl rounded-lg overflow-hidden">
            <CardHeader className="border-b">
                <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <div className="p-6 space-y-6">
                    <Skeleton className="h-10 w-1/2" />
                    <Skeleton className="h-10 w-2/3 self-end ml-auto" />
                    <Skeleton className="h-10 w-1/2" />
                </div>
            </CardContent>
            <CardFooter className="p-4 border-t">
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto h-full flex flex-col items-center py-2">
      {document && (
         <ChatInterface document={document} initialMessages={initialMessages} />
      )}
    </div>
  );
}
