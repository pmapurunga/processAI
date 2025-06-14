"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast"; // Usando o hook de toast existente

interface PdfUploaderProps {
  processId: string; // O componente agora exige um processId
  onUploadSuccess?: (result: any) => void; // Callback opcional para quando o upload for bem-sucedido
}

export function PdfUploader({ processId, onUploadSuccess }: PdfUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo PDF para enviar.",
        variant: "destructive",
      });
      return;
    }

    if (!processId) {
      toast({
        title: "Erro de Configuração",
        description: "O ID do Processo não foi encontrado. Não é possível enviar.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    // 1. Criar o objeto FormData
    const formData = new FormData();
    formData.append("file", selectedFile); // O nome 'file' deve corresponder ao esperado no backend
    formData.append("processId", processId); // O nome 'processId' deve corresponder

    // 2. Enviar a requisição para a sua Cloud Function
    // !!! SUBSTITUA PELA URL REAL DA SUA FUNÇÃO !!!
    const functionUrl = "https://<SUA_REGIAO>-<SEU_PROJETO>.cloudfunctions.net/processPdfEndpoint";

    try {
      const response = await fetch(functionUrl, {
        method: "POST",
        body: formData, // O browser define o 'Content-Type' como 'multipart/form-data' automaticamente
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Falha no upload do arquivo.");
      }

      toast({
        title: "Upload Concluído!",
        description: `Arquivo '${selectedFile.name}' processado e texto extraído.`,
      });
      
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

    } catch (error) {
      console.error("Erro no upload:", error);
      toast({
        title: "Erro no Upload",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      // Limpa o input de arquivo
      const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-medium">Enviar PDF do Processo Completo</h3>
      <p className="text-sm text-muted-foreground">
        Envie o arquivo PDF completo. O sistema irá extrair o texto e prepará-lo para o chat.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="pdf-upload">Arquivo PDF</Label>
          <Input 
            id="pdf-upload" 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange} 
            disabled={isUploading}
          />
        </div>
        <Button type="submit" disabled={isUploading || !selectedFile}>
          {isUploading ? "Enviando..." : "Enviar e Processar"}
        </Button>
      </form>
    </div>
  );
}
