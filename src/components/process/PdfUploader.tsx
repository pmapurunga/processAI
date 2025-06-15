"use client";

import { useState } from "react";
import { getStorage, ref, uploadBytesResumable, UploadTaskSnapshot } from "firebase/storage";
import { app } from "@/lib/firebase"; // Import your initialized Firebase app
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface PdfUploaderProps {
  processId: string;
  onUploadSuccess?: () => void;
}

const storage = getStorage(app);

export function PdfUploader({ processId, onUploadSuccess }: PdfUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !processId) {
      toast({
        title: "Nenhum arquivo ou ID de processo",
        description: "Por favor, selecione um arquivo e certifique-se de que o ID do processo está disponível.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const filePath = `uploads/${processId}/${selectedFile.name}`;
    const storageRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Erro no upload:", error);
        toast({
          title: "Erro no Upload",
          description: `Falha no upload do arquivo: ${error.message}`,
          variant: "destructive",
        });
        setIsUploading(false);
      },
      () => {
        // Upload completed successfully
        toast({
          title: "Upload Concluído!",
          description: `O processamento de '${selectedFile.name}' foi iniciado no servidor.`,
        });
        setIsUploading(false);
        
        if (onUploadSuccess) {
          onUploadSuccess();
        }

        // Reset state
        setSelectedFile(null);
        setUploadProgress(0);
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = "";
        }
      }
    );
  };

  return (
    <div className="border rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-medium">Enviar PDF do Processo Completo</h3>
      <p className="text-sm text-muted-foreground">
        Envie o arquivo PDF completo. O processamento no servidor começará automaticamente.
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
        {isUploading && (
          <div className="space-y-1">
            <Label>Progresso do Upload</Label>
            <Progress value={uploadProgress} />
          </div>
        )}
        <Button type="submit" disabled={isUploading || !selectedFile}>
          {isUploading ? "Enviando..." : "Enviar e Processar"}
        </Button>
      </form>
    </div>
  );
}
