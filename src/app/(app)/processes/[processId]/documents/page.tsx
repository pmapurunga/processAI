
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
import { Loader2, ListChecks, AlertCircle, CheckCircle, UploadCloud, FileText, Trash2, Send, FileUp } from "lucide-react";
// analyzeDocumentBatch Server Action não é mais usada diretamente aqui
// import { analyzeDocumentBatch, type AnalyzeDocumentBatchInput, type AnalyzeDocumentBatchServerOutput } from "@/ai/flows/analyze-document-batch";
import { getDocumentAnalyses, getProcessSummary, type DocumentAnalysis, type ProcessSummary, uploadFileForProcessAnalysis } from "@/lib/firebase"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; 
import Link from "next/link"; 

export const maxDuration = 300; // Ainda pode ser útil para outras Server Actions na página, mas não para a análise principal

interface FileToUploadForAsync {
  file: File;
  dataUri?: string; // Data URI pode não ser mais necessário aqui, mas mantido por enquanto
  status: 'pending' | 'uploading' | 'completed_upload' | 'error_upload' | 'processing_async' | 'analysis_complete' | 'analysis_error';
  progress?: number;
  message?: string; 
  analysisResult?: any; // Preenchido quando a análise assíncrona estiver completa e for lida do Firestore
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
  const [isUploading, setIsUploading] = useState(false); // Renomeado de isAnalyzing para isUploading
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Função para buscar documentos analisados existentes e atualizar a lista.
  const fetchAnalyzedDocuments = async () => {
    if (processId && user) {
      setIsLoadingExisting(true);
      try {
        const docs = await getDocumentAnalyses(processId);
        setPreviouslyAnalyzedDocs(docs);
      } catch (err) {
        console.error("Error loading existing documents:", err);
        toast({ title: "Error", description: "Could not load existing documents.", variant: "destructive" });
      } finally {
        setIsLoadingExisting(false);
      }
    }
  };

  useEffect(() => {
    if (processId && user) {
      getProcessSummary(processId).then(summary => { 
        if (!summary) {
          toast({ title: "Error", description: "Process summary not found.", variant: "destructive" });
          router.push("/dashboard"); 
        }
        setProcessSummary(summary);
      });
      fetchAnalyzedDocuments(); // Chamar a função para buscar documentos existentes
    }
  }, [processId, user, toast, router]);

  // Opcional: Listener do Firestore para atualizações em tempo real (mais avançado)
  // useEffect(() => {
  //   if (processId) {
  //     const analysesCol = collection(db, "processes", processId, "documentAnalyses");
  //     const q = query(analysesCol, orderBy("uploadedAt", "desc"));
  //     const unsubscribe = onSnapshot(q, (querySnapshot) => {
  //       const docs = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DocumentAnalysis));
  //       setPreviouslyAnalyzedDocs(docs);
  //       // Atualizar status dos filesToUpload se eles foram processados
  //     });
  //     return () => unsubscribe();
  //   }
  // }, [processId]);


  const handleFilesSelect = (_files: FileList | null) => { // Data URIs não são mais passados aqui
    if (_files) {
      const newFiles = Array.from(_files).map(file => ({
        file,
        status: 'pending' as 'pending',
        progress: 0,
      }));
      setFilesToUpload(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  const removeFileToUpload = (index: number) => {
    setFilesToUpload(files => files.filter((_, i) => i !== index));
  };
  
  const handleSubmitUploads = async (event: FormEvent) => {
    event.preventDefault();
    if (filesToUpload.filter(f => f.status === 'pending').length === 0 || !analysisPrompt.trim() || !user || !processId) {
      toast({ title: "Missing Information", description: "Please select files, ensure the process is loaded, and the analysis prompt is filled.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setGlobalError(null);

    const pendingFiles = filesToUpload.filter(f => f.status === 'pending');
    let successfulUploads = 0;
    let failedUploads = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const currentFile = filesToUpload[i];
      if (currentFile.status !== 'pending') continue;

      setFilesToUpload(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 0, message: "Uploading..." } : f));
      
      try {
        await uploadFileForProcessAnalysis(
          currentFile.file,
          processId,
          analysisPrompt,
          user.uid,
          (progress) => {
            setFilesToUpload(prev => prev.map((f, idx) => idx === i ? { ...f, progress } : f));
          }
        );
        setFilesToUpload(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'completed_upload', progress: 100, message: "Upload successful. Awaiting async analysis." } : f));
        successfulUploads++;
      } catch (err) {
        console.error(`Error uploading file ${currentFile.file.name}:`, err);
        const errorMsg = err instanceof Error ? err.message : "Unknown upload error.";
        setFilesToUpload(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error_upload', message: errorMsg, progress: 0 } : f));
        failedUploads++;
      }
    }

    setIsUploading(false);

    if (successfulUploads > 0) {
      toast({ title: "Uploads Complete", description: `${successfulUploads} file(s) uploaded for asynchronous analysis.`, className: "bg-green-500 text-white" });
    }
    if (failedUploads > 0) {
       toast({ title: "Upload Issues", description: `${failedUploads} file(s) failed to upload. Check file status.`, variant: "destructive" });
    }
    
    // Após uploads, limpar a lista de arquivos pendentes ou movê-los para uma seção "processando"
    // setFilesToUpload(prev => prev.filter(f => f.status !== 'completed_upload' && f.status !== 'error_upload'));
    // Ou, para manter na lista e mostrar status "processing_async"
    setFilesToUpload(prev => prev.map(f => f.status === 'completed_upload' ? {...f, status: 'processing_async', message: 'Sent for async analysis...'} : f));


    // É uma boa prática recarregar os documentos analisados após um tempo ou fornecer um botão de atualização
    // fetchAnalyzedDocuments(); // Ou instruir o usuário a atualizar
  };
  
  // Determinar se o botão "Proceed to Chat" deve estar habilitado
  // Isso agora dependeria do status do processo pai, que a Cloud Function deve atualizar.
  const canProceedToChat = processSummary?.status === 'documents_completed' || processSummary?.status === 'chat_ready';

  const pendingFileCount = filesToUpload.filter(f=>f.status === 'pending').length;

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
            Provide a prompt to guide the AI analysis for each document. Documents will be processed asynchronously.
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
                {filesToUpload.map((item, index) => (
                  <div key={index} className="mb-2 p-3 border rounded-md bg-card shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate">
                        <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate" title={item.file.name}>{item.file.name}</span>
                      </div>
                       {item.status === 'pending' && !isUploading && (
                        <Button variant="ghost" size="icon" onClick={() => removeFileToUpload(index)} disabled={isUploading}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                       )}
                    </div>
                    {(item.status === 'uploading' || item.status === 'completed_upload') && item.progress !== undefined && 
                      <Progress value={item.progress} className="w-full h-1.5 mt-1" />
                    }
                    {item.status === 'completed_upload' && <p className="text-xs text-green-600 mt-1 flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>{item.message || "Upload successful."}</p>}
                    {item.status === 'processing_async' && <p className="text-xs text-blue-600 mt-1 flex items-center"><Loader2 className="h-3 w-3 mr-1 animate-spin"/>{item.message || "Awaiting async analysis..."}</p>}
                    {item.status === 'error_upload' && <p className="text-xs text-destructive mt-1 flex items-center"><AlertCircle className="h-3 w-3 mr-1"/>Error: {item.message || "Unknown upload error"}</p>}
                    {item.status === 'pending' && <p className="text-xs text-muted-foreground mt-1">Pending upload...</p>}
                    {item.status === 'uploading' && <p className="text-xs text-blue-600 mt-1">{item.message || `Uploading... ${item.progress?.toFixed(0)}%`}</p>}
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
          
          {isLoadingExisting && <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary"/> <span className="ml-2">Loading existing documents...</span></div>}

          {previouslyAnalyzedDocs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-md font-semibold">Previously Analyzed Documents ({previouslyAnalyzedDocs.length}):</h4>
               <ScrollArea className="h-48 border rounded-md p-3 bg-green-500/5">
                {previouslyAnalyzedDocs.map((doc) => (
                  <div key={doc.id} className="mb-2 p-2 border rounded-md bg-card shadow-sm text-sm flex items-center space-x-2">
                     <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0"/>
                     <span className="font-medium truncate" title={doc.fileName}>{doc.fileName}</span>
                     <span className="text-xs text-muted-foreground">(Analyzed: {doc.analyzedAt instanceof Date ? doc.analyzedAt.toLocaleDateString() : (doc.analyzedAt ? new Date((doc.analyzedAt as any).seconds * 1000).toLocaleDateString() : 'N/A')})</span>
                     <span className="text-xs text-muted-foreground">Processed by: { (doc as any).processedBy || 'N/A'}</span>
                  </div>
                ))}
              </ScrollArea>
               <Button variant="outline" size="sm" onClick={fetchAnalyzedDocuments} disabled={isLoadingExisting}>
                Refresh Analyzed List
              </Button>
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

