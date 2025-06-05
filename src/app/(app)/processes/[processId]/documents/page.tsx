
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
import { analyzeDocumentBatch, type AnalyzeDocumentBatchInput, type AnalyzeDocumentBatchOutput } from "@/ai/flows/analyze-document-batch";
import { saveDocumentAnalysis, getDocumentAnalyses, getProcessSummary, type DocumentAnalysis, type ProcessSummary } from "@/lib/firebase"; // Updated imports
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Added Alert imports
import Link from "next/link"; // Added Link import

// Increase the maximum duration for this Server Action to 5 minutes (300 seconds)
// This might help with long-running document analysis tasks.
// Note: Support and behavior may vary depending on the hosting environment.
export const maxDuration = 300;

interface FileToUpload {
  file: File;
  dataUri: string;
  status: 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error';
  progress?: number;
  analysisResult?: any;
  error?: string;
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
  const [analyzedDocuments, setAnalyzedDocuments] = useState<DocumentAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (processId && user) {
      getProcessSummary(processId).then(summary => { // Updated call
        if (!summary) {
          toast({ title: "Error", description: "Process summary not found.", variant: "destructive" });
          router.push("/dashboard"); 
        }
        setProcessSummary(summary);
      });
      getDocumentAnalyses(processId) // Updated call
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
        status: 'pending' as 'pending' | 'uploading' | 'analyzing' | 'completed' | 'error',
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
    if (filesToUpload.filter(f => f.status === 'pending').length === 0 || !analysisPrompt.trim() || !user) {
      toast({ title: "Missing Information", description: "Please select files and ensure the analysis prompt is filled.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    setGlobalError(null);

    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    const documentsToAnalyze: AnalyzeDocumentBatchInput['documents'] = pendingFiles.map(f => ({
      fileName: f.file.name,
      fileDataUri: f.dataUri,
    }));

    setFilesToUpload(prevFiles => prevFiles.map(f => 
      f.status === 'pending' ? { ...f, status: 'analyzing', progress: 50 } : f
    ));

    try {
      const results: AnalyzeDocumentBatchOutput = await analyzeDocumentBatch({
        documents: documentsToAnalyze,
        analysisPrompt: analysisPrompt,
      });

      const newAnalyzedDocs: DocumentAnalysis[] = [];
      const updatedFilesToUpload = [...filesToUpload];

      for (const result of results) {
        const originalFileIndex = updatedFilesToUpload.findIndex(f => f.file.name === result.fileName && f.status === 'analyzing');
        if (originalFileIndex !== -1) {
          try {
            const parsedResult = JSON.parse(result.analysisResult); // Validate JSON parsing
            const savedDoc = await saveDocumentAnalysis( // Updated call
              processId, 
              result.fileName, 
              analysisPrompt, 
              parsedResult
            );
            newAnalyzedDocs.push(savedDoc);
            updatedFilesToUpload[originalFileIndex] = { ...updatedFilesToUpload[originalFileIndex], status: 'completed', progress: 100, analysisResult: parsedResult };
          } catch (jsonError) {
            console.error(`Error parsing JSON for ${result.fileName}:`, jsonError);
             updatedFilesToUpload[originalFileIndex] = { ...updatedFilesToUpload[originalFileIndex], status: 'error', error: `AI returned invalid JSON: ${ (jsonError as Error).message}` };
          }
        }
      }
      setFilesToUpload(updatedFilesToUpload);
      setAnalyzedDocuments(prev => [...prev, ...newAnalyzedDocs]);
      
      const successfulCount = newAnalyzedDocs.length;
      const failedCount = documentsToAnalyze.length - successfulCount;

      if (successfulCount > 0) {
        toast({ title: "Analysis Complete", description: `${successfulCount} document(s) analyzed and saved.`, className: "bg-green-500 text-white" });
      }
      if (failedCount > 0) {
         toast({ title: "Analysis Issues", description: `${failedCount} document(s) failed to analyze or save. Check file status.`, variant: "destructive" });
      }


    } catch (err) {
      console.error("Error analyzing documents:", err);
      const errorMsg = err instanceof Error ? err.message : "An unknown error occurred during batch analysis.";
      setGlobalError(errorMsg);
      toast({ title: "Batch Analysis Failed", description: errorMsg, variant: "destructive" });
      setFilesToUpload(prevFiles => prevFiles.map(f => 
        f.status === 'analyzing' ? { ...f, status: 'error', error: "Batch analysis failed." } : f
      ));
    } finally {
      setIsAnalyzing(false);
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
              <AlertTitle>Analysis Error</AlertTitle>
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
                    {item.status === 'analyzing' && <Progress value={item.progress || 50} className="w-full h-1.5 mt-1" />}
                    {item.status === 'completed' && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>Analysis complete.</p>}
                    {item.status === 'error' && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Error: {item.error || "Unknown analysis error"}</p>}
                     {item.status === 'pending' && <p className="text-xs text-muted-foreground mt-1">Pending analysis...</p>}
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
            disabled={isAnalyzing || !someDocumentsSuccessfullyAnalyzed}
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

    