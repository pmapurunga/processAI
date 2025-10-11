
"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PdfUploader } from "@/components/process/PdfUploader";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ListChecks, AlertCircle, CheckCircle, UploadCloud, FileText, Trash2, Send, FileUp, RefreshCw } from "lucide-react";
import { 
  getDocumentAnalyses, // Still useful for initial load or manual refresh
  getProcessSummary, 
  type DocumentAnalysis, 
  type ProcessSummary, 
  uploadFileForProcessAnalysis,
  db // Import db instance
} from "@/lib/firebase"; 
import { collection, query, orderBy, onSnapshot, Unsubscribe } from "firebase/firestore"; // Firestore listener imports
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; 
import Link from "next/link"; 

export const maxDuration = 300; 

interface FileToUploadForAsync {
  id: string; // Unique ID for the file in the queue, e.g., timestamp + name
  file: File;
  status: 'pending' | 'uploading' | 'completed_upload' | 'error_upload' | 'processing_async' | 'analysis_complete' | 'analysis_error';
  progress?: number;
  message?: string; 
  analysisResult?: any; 
  analysisErrorMessage?: string;
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
  const [filesToUpload, setFilesToUpload] = useState<FileToUploadForAsync[]>([]);
  const [previouslyAnalyzedDocs, setPreviouslyAnalyzedDocs] = useState<DocumentAnalysis[]>([]);
  const [isUploading, setIsUploading] = useState(false); 
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (processId && user) {
      setIsLoadingInitialData(true);
      getProcessSummary(processId).then(summary => { 
        if (!summary) {
          toast({ title: "Error", description: "Process summary not found.", variant: "destructive" });
          router.push("/dashboard"); 
          return;
        }
        setProcessSummary(summary);
      }).catch(err => {
        console.error("Error fetching process summary:", err);
        toast({ title: "Error", description: "Failed to load process summary.", variant: "destructive" });
        router.push("/dashboard");
      });

      // Initial fetch of existing documents
      getDocumentAnalyses(processId).then(docs => {
        setPreviouslyAnalyzedDocs(docs);
      }).catch(err => {
        console.error("Error loading initial existing documents:", err);
        toast({ title: "Error", description: "Could not load existing documents.", variant: "destructive" });
      }).finally(() => {
        setIsLoadingInitialData(false);
      });

      // Setup Firestore listener
      const analysesCol = collection(db, "processes", processId, "documentAnalyses");
      const q = query(analysesCol, orderBy("uploadedAt", "desc"));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const updatedAnalyses = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            // Ensure timestamps are converted if needed, though they should be Dates from getDocumentAnalyses or serverTimestamp
            uploadedAt: data.uploadedAt?.toDate ? data.uploadedAt.toDate() : new Date(data.uploadedAt),
            analyzedAt: data.analyzedAt?.toDate ? data.analyzedAt.toDate() : (data.analyzedAt ? new Date(data.analyzedAt) : undefined),
          } as DocumentAnalysis;
        });
        
        setPreviouslyAnalyzedDocs(updatedAnalyses);

        // Update status of files in filesToUpload queue
        setFilesToUpload(prevFiles => 
          prevFiles.map(queuedFile => {
            if (queuedFile.status === 'processing_async') {
              const matchedAnalysis = updatedAnalyses.find(analysis => analysis.fileName === queuedFile.file.name);
              if (matchedAnalysis) {
                if (matchedAnalysis.status === 'completed') {
                  return { 
                    ...queuedFile, 
                    status: 'analysis_complete' as 'analysis_complete', 
                    message: 'Analysis complete!', 
                    analysisResult: matchedAnalysis.analysisResultJson 
                  };
                } else if (matchedAnalysis.status === 'error') {
                  return { 
                    ...queuedFile, 
                    status: 'analysis_error' as 'analysis_error', 
                    message: `Analysis error: ${matchedAnalysis.errorMessage || 'Unknown error'}`,
                    analysisErrorMessage: matchedAnalysis.errorMessage 
                  };
                }
              }
            }
            return queuedFile;
          })
        );
      }, (error) => {
        console.error("Error with Firestore listener:", error);
        toast({ title: "Listener Error", description: "Could not listen for real-time document updates.", variant: "destructive" });
      });
      
      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
      };
    }
  }, [processId, user, toast, router]);


  const handleFilesSelect = (_files: FileList | null) => {
    if (_files) {
      const newFiles = Array.from(_files).map(file => ({
        id: `${Date.now()}-${file.name}`, // Unique ID for queue item
        file,
        status: 'pending' as 'pending',
        progress: 0,
      }));
      setFilesToUpload(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const removeFileToUpload = (idToRemove: string) => {
    setFilesToUpload(files => files.filter(f => f.id !== idToRemove));
  };
  
  const handleSubmitUploads = async (event: FormEvent) => {
    event.preventDefault();
    if (filesToUpload.filter(f => f.status === 'pending').length === 0 || !analysisPrompt.trim() || !user || !processId) {
      toast({ title: "Missing Information", description: "Please select files, ensure the process is loaded, and the analysis prompt is filled.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setGlobalError(null);

    let successfulUploads = 0;
    let failedUploads = 0;

    // Process only pending files by mapping over the current state
    const uploadPromises = filesToUpload.map(async (queuedFile, index) => {
      if (queuedFile.status !== 'pending') {
        return queuedFile; // Keep non-pending files as they are
      }

      setFilesToUpload(prev => prev.map((f) => f.id === queuedFile.id ? { ...f, status: 'uploading', progress: 0, message: "Uploading..." } : f));
      
      try {
        await uploadFileForProcessAnalysis(
          queuedFile.file,
          processId,
          analysisPrompt,
          user.uid,
          (progress) => {
             setFilesToUpload(prev => prev.map((f) => f.id === queuedFile.id ? { ...f, progress } : f));
          }
        );
        successfulUploads++;
        return { ...queuedFile, status: 'processing_async' as 'processing_async', progress: 100, message: "Upload successful. Awaiting async analysis." };
      } catch (err) {
        console.error(`Error uploading file ${queuedFile.file.name}:`, err);
        const errorMsg = err instanceof Error ? err.message : "Unknown upload error.";
        failedUploads++;
        return { ...queuedFile, status: 'error_upload' as 'error_upload', message: errorMsg, progress: 0 };
      }
    });

    const updatedFiles = await Promise.all(uploadPromises);
    setFilesToUpload(updatedFiles);

    setIsUploading(false);

    if (successfulUploads > 0) {
      toast({ title: "Uploads Sent", description: `${successfulUploads} file(s) sent for asynchronous analysis. Status will update automatically.`, className: "bg-green-500 text-white" });
    }
    if (failedUploads > 0) {
       toast({ title: "Upload Issues", description: `${failedUploads} file(s) failed to upload. Check file status.`, variant: "destructive" });
    }
  };
  
  const canProceedToChat = processSummary?.status === 'documents_completed' || processSummary?.status === 'chat_ready';
  const pendingFileCount = filesToUpload.filter(f => f.status === 'pending').length;

  if (isLoadingInitialData) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading document analysis data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmitUploads}>
      <Card className="shadow-xl w-full">
        <CardHeader>
          <div className="flex items-center space-x-3 mb-2">
            <ListChecks className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Step 2: Document Analysis</CardTitle>
          </div>
          <CardDescription>
            Upload multiple documents related to Process: <strong>{processSummary?.processNumber || processId}</strong>. 
            Provide a prompt to guide the AI analysis for each document. Documents will be processed asynchronously and update in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="analysisPrompt" className="text-base font-medium">Analysis Prompt (for async processing)</Label>
            <Textarea
              id="analysisPrompt"
              value={analysisPrompt}
              onChange={(e) => setAnalysisPrompt(e.target.value)}
              rows={10}
              placeholder="Enter your detailed analysis instructions here. This prompt will be used by the asynchronous analysis..."
              className="text-sm"
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-1">This prompt will be associated with each uploaded document for background processing.</p>
          </div>

          <div>
            <Label className="text-base font-medium">Upload Documents for Asynchronous Analysis</Label>
            <PdfUploader multiple onFilesSelect={handleFilesSelect} ctaText="Select all relevant PDF documents for this process" idSuffix="docs" isProcessing={isUploading}/>
          </div>
          
          {globalError && (
             <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Global Error</AlertTitle>
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}

          {filesToUpload.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold">Files Queue ({filesToUpload.length}):</h4>
              <ScrollArea className="h-64 border rounded-md p-3 bg-secondary/20">
                {filesToUpload.map((item) => (
                  <div key={item.id} className="mb-2 p-3 border rounded-md bg-card shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate" title={item.file.name}>{item.file.name}</span>
                      </div>
                       {item.status === 'pending' && !isUploading && (
                        <Button variant="ghost" size="icon" onClick={() => removeFileToUpload(item.id)} disabled={isUploading}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                       )}
                    </div>
                    {(item.status === 'uploading' || item.status === 'completed_upload' || item.status === 'processing_async') && item.progress !== undefined && 
                      <Progress value={item.status === 'processing_async' || item.status === 'analysis_complete' || item.status === 'analysis_error' ? 100 : item.progress} className="w-full h-1.5 mt-1" />
                    }
                    {item.status === 'pending' && <p className="text-xs text-muted-foreground mt-1">Pending upload...</p>}
                    {item.status === 'uploading' && <p className="text-xs text-blue-600 mt-1">{item.message || `Uploading... ${item.progress?.toFixed(0)}%`}</p>}
                    {item.status === 'processing_async' && <p className="text-xs text-blue-600 mt-1 flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin"/>{item.message || "Awaiting async analysis..."}</p>}
                    {item.status === 'error_upload' && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Error: {item.message || "Unknown upload error"}</p>}
                    {item.status === 'analysis_complete' && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>{item.message || "Analysis complete!"}</p>}
                    {item.status === 'analysis_error' && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>{item.message || "Analysis failed."}</p>}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
          
          {isLoadingInitialData && !processId && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> <span className="ml-2">Loading document data...</span></div>}

          {previouslyAnalyzedDocs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold">Previously Analyzed Documents ({previouslyAnalyzedDocs.length}):</h4>
               <ScrollArea className="h-48 border rounded-md p-3 bg-green-500/5">
                {previouslyAnalyzedDocs.map((doc) => (
                  <div key={doc.id} className="mb-2 p-2 border rounded-md bg-card shadow-sm text-sm flex items-center space-x-2">
                     <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0"/>
                     <span className="font-medium truncate" title={doc.fileName}>{doc.fileName}</span>
                     <span className="text-xs text-muted-foreground">(Analyzed: {doc.analyzedAt instanceof Date ? doc.analyzedAt.toLocaleDateString() : 'N/A'})</span>
                     {/*@ts-ignore*/}
                     <span className="text-xs text-muted-foreground">Status: {doc.status}{doc.processedBy ? ` by ${doc.processedBy}`: ''}</span>
                  </div>
                ))}
              </ScrollArea>
               {/* <Button variant="outline" size="sm" onClick={fetchAnalyzedDocuments} disabled={isLoadingInitialData}>
                <RefreshCw className="mr-2 h-3 w-3"/> Refresh Analyzed List (Manual)
              </Button> */}
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
          <Button 
            type="submit" 
            disabled={isUploading || pendingFileCount === 0 || !analysisPrompt.trim()}
            className="w-full sm:w-auto text-base py-3"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-5 w-5" />
            )}
            Upload {pendingFileCount > 0 ? `${pendingFileCount} Pending File(s)` : 'Selected Files'}
          </Button>
          <Button 
            type="button"
            variant="default"
            onClick={() => router.push(`/processes/${processId}/chat`)}
            disabled={isUploading || !canProceedToChat} 
            className="w-full sm:w-auto text-base py-3 bg-primary hover:bg-primary/90"
            title={!canProceedToChat ? "Document analysis must be complete to proceed to chat." : "Proceed to chat"}
          >
            <Send className="mr-2 h-5 w-5" />
            Proceed to Consolidated Chat
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

    