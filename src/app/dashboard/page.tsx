
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDocuments } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, MessageSquare, UploadCloud, AlertCircle, CheckCircle, Loader2, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import type { DocumentMetadata } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

function getStatusBadgeVariant(status: DocumentMetadata['status']) {
  switch (status) {
    case 'processed':
      return 'default'; // Greenish or success color
    case 'processing':
    case 'queued':
      return 'secondary'; // Bluish or neutral in-progress color
    case 'error':
      return 'destructive'; // Reddish color
    default:
      return 'outline';
  }
}

function getStatusIcon(status: DocumentMetadata['status']) {
  switch (status) {
    case 'processed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'processing':
    case 'queued':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  useEffect(() => {
    if (user?.uid && !authLoading) {
      console.log(`DashboardPage: Auth loaded, user UID: ${user.uid}. Fetching documents.`);
      setLoadingDocs(true);
      getDocuments(user.uid)
        .then(fetchedDocs => {
          console.log("DashboardPage: Documents fetched from action: ", fetchedDocs);
          setDocuments(fetchedDocs);
        })
        .catch(error => {
          console.error("DashboardPage: Failed to fetch documents:", error);
          setDocuments([]); 
        })
        .finally(() => setLoadingDocs(false));
    } else if (!authLoading && !user) {
      console.log("DashboardPage: Auth loaded, no user. Clearing documents.");
      setDocuments([]);
      setLoadingDocs(false);
    } else if (authLoading) {
      console.log("DashboardPage: Auth is loading...");
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/4 mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 border-t">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (!user && !authLoading) {
     return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-lg text-muted-foreground">Please log in to view your dashboard.</p>
         <Button asChild className="mt-4">
            <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-headline font-bold">Document Dashboard</h1>
        <Button asChild>
          <Link href="/upload">
            <UploadCloud className="mr-2 h-4 w-4" /> Upload New PDF
          </Link>
        </Button>
      </div>

      {loadingDocs && ( // Show skeletons if loading documents, even if some old ones are there briefly
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={`skeleton-${i}`} className="shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/4 mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 border-t">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!loadingDocs && documents.length === 0 ? (
        <Card className="text-center py-12 shadow-lg">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Inbox className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-headline font-semibold">No Documents Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Get started by uploading your first PDF document for this user.</p>
            <Button asChild size="lg">
              <Link href="/upload">
                <UploadCloud className="mr-2 h-5 w-5" /> Upload PDF
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        !loadingDocs && documents.length > 0 && ( // Ensure not loading and documents exist
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <Card key={doc.id} className="flex flex-col justify-between shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-semibold mb-1 font-headline truncate" title={doc.name}>
                      {doc.name}
                    </CardTitle>
                    {getStatusIcon(doc.status)}
                  </div>
                  <CardDescription>
                    Uploaded: {doc.uploadedAt ? format(new Date(doc.uploadedAt), "PPp") : 'N/A'}
                  </CardDescription>
                  {doc.updatedAt && doc.updatedAt !== doc.uploadedAt && (
                       <CardDescription>
                          Last update: {doc.updatedAt ? format(new Date(doc.updatedAt), "PPp") : 'N/A'}
                       </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={getStatusBadgeVariant(doc.status)} className="capitalize">{doc.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  {doc.status === 'error' && doc.errorMessage && (
                      <p className="text-sm text-destructive line-clamp-3" title={doc.errorMessage}>
                          <strong>Error:</strong> {doc.errorMessage}
                      </p>
                  )}
                  {doc.status === 'processed' && doc.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3" title={doc.summary}>
                      <strong>Summary:</strong> {doc.summary}
                    </p>
                  )}
                  {(doc.status === 'processing' || doc.status === 'queued') && !doc.summary && (
                       <p className="text-sm text-muted-foreground italic">
                          Document is being processed...
                       </p>
                  )}
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" size="sm" asChild disabled={doc.status !== 'processed'}>
                    <Link href={`/summary/${doc.id}`}>
                      <FileText className="mr-2 h-4 w-4" /> View Summary
                    </Link>
                  </Button>
                  <Button variant="default" size="sm" asChild disabled={doc.status !== 'processed'}>
                    <Link href={`/chat/${doc.id}`}>
                      <MessageSquare className="mr-2 h-4 w-4" /> Chat
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
