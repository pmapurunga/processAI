
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep for raw JSON view
import { getProcessSummary, type ProcessSummary as FirebaseProcessSummary } from '@/lib/firebase'; 
import { Loader2, FileText, AlertCircle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast'; 
import type { DocumentEntryInSummary } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export default function ProcessSummaryPage() {
  const params = useParams();
  const router = useRouter(); 
  const { toast } = useToast(); 
  const processId = params.processId as string;

  const [summaryData, setSummaryData] = useState<FirebaseProcessSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processId) {
      setIsLoading(true);
      setError(null);
      getProcessSummary(processId) 
        .then(data => {
          if (data) {
            setSummaryData(data);
          } else {
            setError("Process summary not found.");
            toast({ title: "Error", description: "Process summary not found. Redirecting...", variant: "destructive"});
            router.replace("/dashboard");
          }
        })
        .catch(err => {
          console.error("Error fetching process summary:", err);
          const errorMessage = err instanceof Error ? err.message : "Failed to load summary.";
          setError(errorMessage);
           toast({ title: "Error", description: errorMessage, variant: "destructive"});
        })
        .finally(() => setIsLoading(false));
    }
  }, [processId, router, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10 h-[calc(100vh-250px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !summaryData) { 
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center"><AlertCircle className="mr-2 h-6 w-6" />Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
          <Button variant="link" asChild className="mt-4">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summaryData) { 
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>No Summary Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The summary for this process could not be found.</p>
           <Button variant="link" asChild className="mt-4">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const documentTable = summaryData.summaryJson?.documentTable as DocumentEntryInSummary[] | undefined;

  return (
    <Card className="shadow-xl w-full">
      <CardHeader>
        <div className="flex items-center space-x-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Step 1: Process Summary</CardTitle>
        </div>
        <CardDescription>
          Review the extracted process number and document table for Process: <strong>{summaryData.processNumber}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="processNumber" className="text-base font-medium">Process Number</Label>
          <Input id="processNumber" value={summaryData.processNumber} readOnly className="bg-muted/50 text-lg"/>
        </div>
        
        {summaryData.summaryText && ( // Display if summaryText still exists and has content (optional field now)
            <div>
              <Label htmlFor="summaryText" className="text-base font-medium">Generic Summary Text (if any)</Label>
              <Textarea
                id="summaryText"
                value={summaryData.summaryText}
                readOnly
                rows={5}
                className="bg-muted/50 text-sm"
              />
            </div>
          )}

        {documentTable && documentTable.length > 0 ? (
          <div>
            <Label className="text-base font-medium flex items-center mb-2">
              <List className="h-5 w-5 mr-2 text-primary" /> Extracted Document Table
            </Label>
            <Card className="border bg-card">
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tipo do Documento</TableHead>
                      <TableHead>Polo</TableHead>
                      <TableHead>Data da Assinatura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentTable.map((doc, index) => (
                      <TableRow key={doc.id + '-' + index}>
                        <TableCell className="font-mono text-xs">{doc.id}</TableCell>
                        <TableCell>{doc.type}</TableCell>
                        <TableCell>{doc.polo}</TableCell>
                        <TableCell>{doc.signatureDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
        ) : (
          <div>
            <Label className="text-base font-medium">Extracted Document Table</Label>
            <p className="text-sm text-muted-foreground p-4 border rounded-md bg-muted/50">
              No document table data was extracted or the table is empty.
            </p>
          </div>
        )}

        {summaryData.summaryJson && (
          <div className="mt-4">
            <Label htmlFor="summaryJson" className="text-base font-medium">Raw JSON Output (from AI)</Label>
            <Textarea
              id="summaryJson"
              value={JSON.stringify(summaryData.summaryJson, null, 2)}
              readOnly
              rows={15}
              className="font-code text-xs bg-muted/50 mt-1"
            />
          </div>
        )}
         <div className="pt-4 text-right">
            <Button asChild>
                <Link href={`/processes/${processId}/documents`}>Proceed to Document Analysis</Link>
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
