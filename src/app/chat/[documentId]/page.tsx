import { getDocumentById, getChatMessages } from '@/app/actions';
import ChatInterface from '@/components/ChatInterface';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ChatPageProps {
  params: {
    documentId: string;
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  // Tentar 'await' params conforme sugerido pelo aviso do Next.js
  const resolvedParams = await params; // Esta linha foi adicionada/modificada
  const documentId = resolvedParams.documentId; // Usar o resultado do await
  
  const document = await getDocumentById(documentId);
  
  if (!document) {
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

  if (document.status !== 'processed') {
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

  const initialMessages = await getChatMessages(documentId);

  return (
    <div className="container mx-auto h-full flex flex-col items-center py-2">
      <ChatInterface document={document} initialMessages={initialMessages} />
    </div>
  );
}

export const revalidate = 0; // Revalidate this page on every request
