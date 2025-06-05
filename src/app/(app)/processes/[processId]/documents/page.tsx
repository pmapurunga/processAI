
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PdfUploader } from "@/components/process/PdfUploader";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListChecks, AlertCircle, CheckCircle, UploadCloud, FileText, Trash2, Send } from "lucide-react";
import { analyzeDocumentBatch, type AnalyzeDocumentBatchInput, type AnalyzeDocumentBatchServerOutput } from "@/ai/flows/analyze-document-batch";
import { getDocumentAnalyses, getProcessSummary, type DocumentAnalysis, type ProcessSummary } from "@/lib/firebase"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; 
import Link from "next/link"; 

export const maxDuration = 300;

interface FileToUpload {
  file: File;
  dataUri: string;
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error';
  progress?: number;
  analysisResult?: any; // This will be the parsed JSON
  message?: string; // For error messages or success messages from server
}

export default function DocumentAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const processId = params.processId as string;
  const { user } = useAuth();
  const { toast } = useToast();

  const [processSummary, setProcessSummary] = useState<ProcessSummary | null>(null);
  const [analysisPrompt, setAnalysisPrompt] = useState<string>(
`ANALISAR LOTE DE DOCUMENTOS (AUTOS E/OU ADICIONAIS) - FOCO MÉDICO INDIVIDUAL - JSON

Vou anexar agora um lote de documentos pertencentes a este processo da Justiça Federal. Este lote pode conter documentos dos autos (Polo Ativo, Passivo, Interno) e/ou documentos adicionais (considerados do Polo Ativo para fins periciais). Nomes de arquivos dos autos geralmente seguem o formato "número do processo_id_tipo.pdf".

Para CADA documento anexado NESTE lote:
1.  Leia o nome do arquivo e extraia o Id e o Tipo/Título (se for dos autos) ou use o nome completo (se adicional).
2.  Leia o conteúdo completo do documento para análise geral.
3.  Determine o Polo (Ativo, Passivo, Interno) com base no CONTEÚDO principal e no tipo de documento. Para adicionais, considere Polo Ativo.
4.  Realize a análise médico-pericial e processual deste arquivo como um todo, focando em informações relevantes.
5.  **CRUCIAL:** Procure ativamente **dentro deste arquivo** por documentos médicos **individuais** (ex: Atestados, Relatórios Médicos, Laudos de Exames Específicos como USG, RM, Raio-X, Laudos Psicológicos, Prontuários, etc.). Para CADA documento médico individual encontrado dentro deste arquivo:
    * Identifique o tipo específico do documento médico (Atestado, Laudo USG Ombro, etc.).
    * Extraia a data exata do documento médico (data de emissão, data do exame).
    * Extraia o nome do Profissional de saúde e/ou o nome da Instituição de saúde envolvida.
    * Faça um **resumo conciso FOCO NESTE DOCUMENTO MÉDICO ESPECÍFICO**, contendo o diagnóstico (com CID, se houver), principais achados/resultados, conclusões e quaisquer informações relevantes *contidas especificamente naquele documento*.
    * Se possível, indique a(s) página(s) dentro do arquivo PDF original onde este documento médico individual se encontra.
6.  Apresente a análise deste ARQUIVO completo, incluindo a lista de documentos médicos encontrados DENTRO dele, como um objeto JSON único, seguindo o formato especificado abaixo.

Formato JSON desejado para CADA arquivo processado NESTE lote:
\`\`\`json
{
  "IdDocumentoOriginal": "[Id extraído do filename ou NomeArquivoOriginal se adicional]",
  "TipoDocumentoOriginal": "[Tipo/Título extraído do filename ou inferido do conteúdo do arquivo]",
  "PoloInferido": "[Polo determinado pelo AI para o arquivo (Ativo, Passivo, Interno)]",
  "NomeArquivoOriginal": "[Nome do arquivo anexado neste lote]",
  "ResumoGeralConteudoArquivo": "[Resumo conciso do conteúdo principal deste arquivo (pode incluir peças processuais, etc.)]",
  "InformacoesProcessuaisRelevantes": "[Pontos processuais relevantes encontrados neste arquivo (decisões, petições, etc.)]",
  "DocumentosMedicosEncontradosNesteArquivo": [
    {
      "TipoDocumentoMedico": "[Tipo específico do documento médico encontrado (ex: Atestado, Laudo RM Coluna)]",
      "DataDocumentoMedico": "[Data do documento médico individual]",
      "ProfissionalServico": "[Nome do Profissional ou Serviço/Instituição]",
      "ResumoConteudoMedico": "[Resumo conciso do CONTEÚDO DESTE DOCUMENTO MÉDICO (Diagnóstico, CID, Achados, Conclusões)]",
      "Pagina(s)NoOriginal": "[Ex: 'pg 5', 'pg 10-12', 'Não identificado']"
    }
  ]
}
\`\`\`
`);
  const [filesToUpload, setFilesToUpload] = useState<FileToUpload[]>([]);
  const [analyzedDocuments, setAnalyzedDocuments] = useState<DocumentAnalysis[]>([]); // Stores successfully analyzed & saved docs
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (processId && user) {
      getProcessSummary(processId).then(summary => { 
        if (!summary) {
          toast({ title: "Error", description: "Process summary not found.", variant: "destructive" });
          router.push("/dashboard"); 
        }
        setProcessSummary(summary);
      });
      getDocumentAnalyses(processId) 
        .then(docs => {
          setAnalyzedDocuments(docs);
          setIsLoadingExisting(false);
        })
        .catch(err => {
          console.error("Error loading existing documents:", err);
          toast({ title: "Error", description: "Could not load existing documents.", variant: "destructive" });
          setIsLoadingExisting(false);
        });
    }
  }, [processId, user, toast, router]);

  const handleFilesSelect = (_files: FileList | null, dataUris: { name: string; dataUri: string }[]) => {
    if (_files) {
      const newFiles = Array.from(_files).map((file, index) => ({
        file,
        dataUri: dataUris.find(du => du.name === file.name)?.dataUri || "",
        status: 'pending' as 'pending', // Corrected type
        progress: 0,
      }));
      setFilesToUpload(prevFiles => [...prevFiles, ...newFiles.filter(nf => nf.dataUri)]);
    }
  };

  const removeFileToUpload = (index: number) => {
    setFilesToUpload(files => files.filter((_, i) => i !== index));
  };
  
  const handleSubmitAnalysis = async (event: FormEvent) => {
    event.preventDefault();
    if (filesToUpload.filter(f => f.status === 'pending').length === 0 || !analysisPrompt.trim() || !user || !processId) {
      toast({ title: "Missing Information", description: "Please select files, ensure the process is loaded, and the analysis prompt is filled.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setGlobalError(null);

    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    const documentsToAnalyzeInput: AnalyzeDocumentBatchInput['documents'] = pendingFiles.map(f => ({
      fileName: f.file.name,
      fileDataUri: f.dataUri,
    }));

    // Update UI for pending files
    setFilesToUpload(prevFiles => prevFiles.map(f => 
      f.status === 'pending' ? { ...f, status: 'analyzing', progress: 50, message: "Analysis in progress..." } : f
    ));

    try {
      const serverResults: AnalyzeDocumentBatchServerOutput = await analyzeDocumentBatch({
        processId: processId,
        documents: documentsToAnalyzeInput,
        analysisPrompt: analysisPrompt,
      });

      const newlyCompletedAnalyses: DocumentAnalysis[] = [];

      // Update filesToUpload based on server results
      setFilesToUpload(prevFiles => {
        const updatedList = [...prevFiles];
        serverResults.forEach(sr => {
          const fileIndex = updatedList.findIndex(f => f.file.name === sr.fileName && f.status === 'analyzing');
          if (fileIndex !== -1) {
            updatedList[fileIndex] = {
              ...updatedList[fileIndex],
              status: sr.status,
              message: sr.message || (sr.status === 'completed' ? "Analysis successful." : "Analysis failed."),
              progress: sr.status === 'completed' ? 100 : updatedList[fileIndex].progress,
              analysisResult: sr.analysisResult // Store the parsed JSON if successful
            };
            if (sr.status === 'completed' && sr.analysisResult) {
                // For immediate display of newly analyzed docs, we can create a temporary DocumentAnalysis-like object
                // or refetch. For simplicity here, we'll add to a temporary list.
                 newlyCompletedAnalyses.push({
                    id: `temp-${Date.now()}-${sr.fileName}`, // Temporary ID
                    processId: processId,
                    fileName: sr.fileName,
                    analysisPromptUsed: analysisPrompt,
                    analysisResultJson: sr.analysisResult,
                    status: 'completed',
                    uploadedAt: new Date(), // Or get timestamp from server if available
                 });
            }
          }
        });
        return updatedList;
      });
      
      // Add newly completed analyses to the display list, or refetch all.
      // Here, we add them directly. For more robustness, refetch getDocumentAnalyses(processId).
      if (newlyCompletedAnalyses.length > 0) {
        setAnalyzedDocuments(prev => [...prev, ...newlyCompletedAnalyses]);
      }

      const successfulCount = serverResults.filter(r => r.status === 'completed').length;
      const failedCount = serverResults.filter(r => r.status === 'error').length;

      if (successfulCount > 0) {
        toast({ title: "Analysis Processed", description: `${successfulCount} document(s) processed successfully.`, className: "bg-green-500 text-white" });
      }
      if (failedCount > 0) {
         toast({ title: "Analysis Issues", description: `${failedCount} document(s) encountered errors. Check file status.`, variant: "destructive" });
      }


    } catch (err) {
      console.error("Error in analyzeDocumentBatch Server Action:", err);
      const errorMsg = err instanceof Error ? err.message : "An unknown error occurred calling batch analysis action.";
      setGlobalError(errorMsg);
      toast({ title: "Batch Analysis Action Failed", description: errorMsg, variant: "destructive" });
      // Mark all 'analyzing' files as errored on the client if the action itself fails
      setFilesToUpload(prevFiles => prevFiles.map(f => 
        f.status === 'analyzing' ? { ...f, status: 'error', message: "Server action failed: " + errorMsg } : f
      ));
    } finally {
      setIsAnalyzing(false);
      // Optionally, refetch all document analyses to ensure UI consistency
      // getDocumentAnalyses(processId).then(setAnalyzedDocuments);
    }
  };

  const someDocumentsSuccessfullyAnalyzed = analyzedDocuments.length > 0 || filesToUpload.some(f => f.status === 'completed');
  const pendingFileCount = filesToUpload.filter(f=>f.status === 'pending').length;

  return (
    <form onSubmit={handleSubmitAnalysis}>
      <Card className="shadow-xl w-full">
        <CardHeader>
          <div className="flex items-center space-x-3 mb-2">
            <ListChecks className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Step 2: Document Analysis</CardTitle>
          </div>
          <CardDescription>
            Upload multiple documents related to Process: <strong>{processSummary?.processNumber || processId}</strong>. 
            Provide a prompt to guide the AI analysis for each document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="analysisPrompt" className="text-base font-medium">Analysis Prompt</Label>
            <Textarea
              id="analysisPrompt"
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              rows={10}
              placeholder="Enter your detailed analysis instructions here..."
              className="text-sm"
              disabled={isAnalyzing}
            />
            <p className="text-xs text-muted-foreground mt-1">This prompt will be applied to each document uploaded below.</p>
          </div>

          <div>
            <Label className="text-base font-medium">Upload Documents</Label>
            <PdfUploader multiple onFilesSelect={handleFilesSelect} ctaText="Select all relevant PDF documents for this process" idSuffix="docs" isProcessing={isAnalyzing}/>
          </div>
          
          {globalError && (
             <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Server Action Error</AlertTitle>
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          {filesToUpload.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold">Files Queue ({filesToUpload.length}):</h4>
              <ScrollArea className="h-64 border rounded-md p-3 bg-secondary/20">
                {filesToUpload.map((item, index) => (
                  <div key={index} className="mb-2 p-3 border rounded-md bg-card shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate" title={item.file.name}>{item.file.name}</span>
                      </div>
                       {item.status === 'pending' && !isAnalyzing && (
                        <Button variant="ghost" size="icon" onClick={() => removeFileToUpload(index)} disabled={isAnalyzing}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                       )}
                    </div>
                    {(item.status === 'analyzing' || (item.status === 'error' && item.progress && item.progress < 100) || (item.status === 'completed' && item.progress && item.progress < 100) ) && 
                      <Progress value={item.progress || (item.status === 'analyzing' ? 50 : 0)} className="w-full h-1.5 mt-1" />
                    }
                    {item.status === 'completed' && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>{item.message || "Analysis complete."}</p>}
                    {item.status === 'error' && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Error: {item.message || "Unknown analysis error"}</p>}
                    {item.status === 'pending' && <p className="text-xs text-muted-foreground mt-1">Pending analysis...</p>}
                    {item.status === 'analyzing' && <p className="text-xs text-blue-600 mt-1">{item.message || "Analyzing..."}</p>}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
          
          {isLoadingExisting && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> <span className="ml-2">Loading existing documents...</span></div>}

          {analyzedDocuments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold">Previously Analyzed Documents ({analyzedDocuments.length}):</h4>
               <ScrollArea className="h-48 border rounded-md p-3 bg-green-500/5">
                {analyzedDocuments.map((doc) => (
                  <div key={doc.id} className="mb-2 p-2 border rounded-md bg-card shadow-sm text-sm flex items-center space-x-2">
                     <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0"/>
                     <span className="font-medium truncate" title={doc.fileName}>{doc.fileName}</span>
                     <span className="text-xs text-muted-foreground">(Analyzed: {doc.uploadedAt instanceof Date ? doc.uploadedAt.toLocaleDateString() : new Date(doc.uploadedAt).toLocaleDateString()})</span>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
          <Button 
            type="submit" 
            disabled={isAnalyzing || pendingFileCount === 0 || !analysisPrompt.trim()}
            className="w-full sm:w-auto text-base py-3"
          >
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-5 w-5" />
            )}
            Analyze {pendingFileCount > 0 ? `${pendingFileCount} Pending` : 'Selected'} Document(s)
          </Button>
          <Button 
            type="button"
            variant="default"
            onClick={() => router.push(`/processes/${processId}/chat`)}
            disabled={isAnalyzing || !someDocumentsSuccessfullyAnalyzed } // Ensure some docs are completed before proceeding
            className="w-full sm:w-auto text-base py-3 bg-primary hover:bg-primary/90"
          >
            <Send className="mr-2 h-5 w-5" />
            Proceed to Consolidated Chat
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
