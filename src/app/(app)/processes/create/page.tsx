
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PdfUploader } from "@/components/process/PdfUploader";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, CheckCircle, AlertCircle, Save } from "lucide-react";
import { extractSummaryFromPdf, type ExtractSummaryFromPdfOutput } from "@/ai/flows/extract-summary-from-pdf";
import { saveSummary } from "@/lib/firebase"; // Updated import

export default function CreateProcessPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [summaryDataUri, setSummaryDataUri] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ExtractSummaryFromPdfOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (file: File | null, dataUri: string | null) => {
    setSummaryFile(file);
    setSummaryDataUri(dataUri);
    setAnalysisResult(null); 
    setError(null);
  };

  const handleAnalyzeSummary = async () => {
    if (!summaryDataUri || !user) {
      setError("Please select a PDF file to analyze.");
      toast({
        title: "Error",
        description: "No PDF file selected or user not logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await extractSummaryFromPdf({ pdfDataUri: summaryDataUri });
      setAnalysisResult(result);
      toast({
        title: "Analysis Complete",
        description: "Summary and Process Number extracted successfully.",
        variant: "default",
        className: "bg-green-500 text-white"
      });
    } catch (err) {
      console.error("Error analyzing summary:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
      setError(errorMessage);
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProcess = async () => {
    if (!analysisResult || !user) {
      toast({
        title: "Error",
        description: "No analysis result to save or user not logged in.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      // Use the updated saveSummary function
      const savedProcess = await saveSummary(
        analysisResult.processNumber,
        analysisResult.summary,
        analysisResult, // Save the full JSON output as well
        user.uid
      );
      toast({
        title: "Process Saved",
        description: `Process ${savedProcess.processNumber} created. Proceed to document analysis.`,
        variant: "default",
         className: "bg-green-500 text-white"
      });
      router.push(`/processes/${savedProcess.id}/documents`); // Use the ID from the saved process
    } catch (err) {
      console.error("Error saving process:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred while saving.";
      setError(errorMessage);
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="container mx-auto max-w-3xl py-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-3 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Step 1: New Process Summary</CardTitle>
          </div>
          <CardDescription>
            Upload a PDF document containing the process summary. The system will extract the summary and process number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="summary-pdf" className="text-lg font-medium">Upload Summary PDF</Label>
            <PdfUploader idSuffix="summary" onFileSelect={handleFileSelect} ctaText="Upload the main process summary PDF" isProcessing={isLoading || isSaving} />
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-md flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">An Error Occurred</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
          
          {summaryFile && !analysisResult && !isLoading && (
             <Button onClick={handleAnalyzeSummary} disabled={isLoading || isSaving || !summaryFile} className="w-full text-base py-3">
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              Analyze Summary PDF
            </Button>
          )}
          
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-6 border rounded-md bg-secondary/30">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-3" />
              <p className="text-lg font-medium text-foreground">Analyzing PDF...</p>
              <p className="text-sm text-muted-foreground">This may take a few moments.</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4 p-6 border rounded-md shadow-inner bg-green-500/5">
              <h3 className="text-xl font-semibold text-green-700 flex items-center"><CheckCircle className="h-6 w-6 mr-2"/>Analysis Complete</h3>
              <div>
                <Label htmlFor="processNumber" className="font-medium text-green-700">Process Number</Label>
                <Input id="processNumber" value={analysisResult.processNumber} readOnly className="bg-white border-green-300 text-green-800"/>
              </div>
              <div>
                <Label htmlFor="summary" className="font-medium text-green-700">Extracted Summary</Label>
                <Textarea id="summary" value={analysisResult.summary} readOnly rows={8} className="bg-white border-green-300 text-green-800"/>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSaveProcess} 
            disabled={!analysisResult || isLoading || isSaving} 
            className="w-full text-base py-3 bg-primary hover:bg-primary/90"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            Save Process & Continue to Document Analysis
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
