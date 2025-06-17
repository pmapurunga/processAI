import Link from 'next/link';
import { getDocuments } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, MessageSquare, UploadCloud, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {format} from 'date-fns';
import type { DocumentMetadata } from '@/lib/types';

function getStatusBadgeVariant(status: DocumentMetadata['status']) {
  switch (status) {
    case 'processed':
      return 'default'; // Greenish, using primary for now
    case 'processing':
    case 'uploaded':
      return 'secondary'; // Bluish/Grayish
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusIcon(status: DocumentMetadata['status']) {
  switch (status) {
    case 'processed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'processing':
    case 'uploaded':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

export default async function DashboardPage() {
  const documents = await getDocuments();

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

      {documents.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">No Documents Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Get started by uploading your first PDF document.</p>
            <Button asChild size="lg">
              <Link href="/upload">
                <UploadCloud className="mr-2 h-5 w-5" /> Upload PDF
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
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
                  Uploaded: {format(new Date(doc.uploadedAt), "PPp")}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getStatusBadgeVariant(doc.status)} className="capitalize">{doc.status}</Badge>
                </div>
                 {doc.status === 'processed' && doc.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    <strong>Summary:</strong> {doc.summary}
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
      )}
    </div>
  );
}

export const revalidate = 0; // Revalidate this page on every request
