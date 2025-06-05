"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mockGetProcessSummary, type ProcessSummary as ProcessSummaryType } from '@/lib/firebase'; // Using mock
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProcessSummaryPage() {
  const params = useParams();
  const processId = params.processId as string;

  const [summaryData, setSummaryData] = useState<ProcessSummaryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processId) {
      setIsLoading(true);
      setError(null);
      mockGetProcessSummary(processId)
        .then(data => {
          if (data) {
            setSummaryData(data);
          } else {
            setError("Process summary not found.");
          }
        })
        .catch(err => {
          console.error("Error fetching process summary:", err);
          setError(err instanceof Error ? err.message : "Failed to load summary.");
        })
        .finally(() => setIsLoading(false));
    }
  }, [processId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
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

  return (
    <Card className="shadow-xl w-full">
      <CardHeader>
        <div className="flex items-center space-x-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Process Summary Details</CardTitle>
        </div>
        <CardDescription>
          Review the extracted summary and process number for Process ID: <strong>{summaryData.processNumber}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="processNumber" className="text-base font-medium">Process Number</Label>
          <Input id="processNumber" value={summaryData.processNumber} readOnly className="bg-muted/50 text-lg"/>
        </div>
        <div>
          <Label htmlFor="summaryText" className="text-base font-medium">Extracted Summary</Label>
          <Textarea
            id="summaryText"
            value={summaryData.summaryText || "No summary text extracted."}
            readOnly
            rows={10}
            className="bg-muted/50 text-base"
          />
        </div>
        {summaryData.summaryJson && (
          <div>
            <Label htmlFor="summaryJson" className="text-base font-medium">Full JSON Output (from AI)</Label>
            <Textarea
              id="summaryJson"
              value={JSON.stringify(summaryData.summaryJson, null, 2)}
              readOnly
              rows={15}
              className="font-code text-xs bg-muted/50"
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
