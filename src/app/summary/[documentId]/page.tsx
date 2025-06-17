import { getDocumentById, getDocumentSummary } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SummaryPageProps {
  params: {
    documentId: string;
  };
}

export default async function SummaryPage({ params }: SummaryPageProps) {
  const documentId = params.documentId;
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
            This document is currently '{document.status}' and its summary is not yet available. Please check back later.
             <br />
            <Button asChild variant="link" className="mt-2">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = await getDocumentSummary(documentId);

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" asChild className="mb-6">
        <Link href="/dashboard">← Back to Dashboard</Link>
      </Button>
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl font-headline">{document.name} - Summary</CardTitle>
              <CardDescription>A concise overview of the document content.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {summary ? (
            <article className="prose prose-lg max-w-none dark:prose-invert">
              <p className="text-lg leading-relaxed whitespace-pre-line">{summary}</p>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-10">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-xl">Generating summary, please wait...</p>
              <p>This might take a few moments.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const revalidate = 0; // Revalidate this page on every request
