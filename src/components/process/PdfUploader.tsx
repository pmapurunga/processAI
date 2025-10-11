"use client";

import React, { useState, useCallback, ChangeEvent } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, FileText, XCircle, Loader2 } from 'lucide-react';

interface PdfUploaderProps {
  onFileSelect: (file: File | null, dataUri: string | null) => void;
  onFilesSelect?: (files: FileList | null, dataUris: { name: string; dataUri: string }[]) => void;
  multiple?: boolean;
  ctaText?: string;
  idSuffix?: string;
  isProcessing?: boolean;
}

export function PdfUploader({ onFileSelect, onFilesSelect, multiple = false, ctaText, idSuffix = "", isProcessing = false }: PdfUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;

    if (multiple && onFilesSelect) {
      if (files && files.length > 0) {
        setSelectedFiles(files);
        const dataUrisArray: { name: string; dataUri: string }[] = [];
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type !== "application/pdf") {
            setError(`File "${file.name}" is not a PDF. Please upload PDF files only.`);
            onFilesSelect(null, []);
            setSelectedFiles(null);
            return;
          }
          if (file.size > 15 * 1024 * 1024) { // 15MB limit
             setError(`File "${file.name}" exceeds the 15MB size limit.`);
             onFilesSelect(null, []);
             setSelectedFiles(null);
             return;
          }
          try {
            const dataUri = await readFileAsDataURL(file);
            dataUrisArray.push({ name: file.name, dataUri });
          } catch (e) {
             setError(`Error reading file "${file.name}".`);
             onFilesSelect(null, []);
             setSelectedFiles(null);
             return;
          }
        }
        onFilesSelect(files, dataUrisArray);
      } else {
        setSelectedFiles(null);
        onFilesSelect(null, []);
      }
    } else if (!multiple && onFileSelect) {
      const file = files?.[0];
      if (file) {
        if (file.type !== "application/pdf") {
          setError("Invalid file type. Please upload a PDF.");
          onFileSelect(null, null);
          setSelectedFile(null);
          return;
        }
        if (file.size > 15 * 1024 * 1024) { // 15MB limit
          setError("File exceeds the 15MB size limit.");
          onFileSelect(null, null);
          setSelectedFile(null);
          return;
        }
        setSelectedFile(file);
        try {
          const dataUri = await readFileAsDataURL(file);
          onFileSelect(file, dataUri);
        } catch (e) {
          setError("Error reading file.");
          onFileSelect(null, null);
          setSelectedFile(null);
        }
      } else {
        setSelectedFile(null);
        onFileSelect(null, null);
      }
    }
     // Reset the input value to allow re-uploading the same file after an error or clearing
    event.target.value = '';

  }, [onFileSelect, onFilesSelect, multiple]);

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setSelectedFiles(null);
    setError(null);
    if (!multiple && onFileSelect) onFileSelect(null, null);
    if (multiple && onFilesSelect) onFilesSelect(null, []);
  };
  
  const inputId = `pdf-upload-${idSuffix}`;

  return (
    <div className="w-full space-y-4">
      <label
        htmlFor={inputId}
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-secondary/50 transition-colors
          ${error ? 'border-destructive' : 'border-primary/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          {isProcessing ? (
            <Loader2 className="w-10 h-10 mb-3 text-primary animate-spin" />
          ) : (
            <UploadCloud className="w-10 h-10 mb-3 text-primary" />
          )}
          <p className="mb-2 text-sm text-foreground">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-muted-foreground">PDF only (MAX. 15MB {multiple ? 'per file' : ''})</p>
          {ctaText && <p className="text-xs text-primary mt-1">{ctaText}</p>}
        </div>
        <Input
          id={inputId}
          type="file"
          className="hidden"
          accept="application/pdf"
          onChange={handleFileChange}
          multiple={multiple}
          disabled={isProcessing}
        />
      </label>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Upload Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!multiple && selectedFile && !error && (
        <div className="p-3 border rounded-md bg-secondary/30 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm text-foreground truncate max-w-xs sm:max-w-sm md:max-w-md">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
          <Button variant="ghost" size="icon" onClick={clearSelection} disabled={isProcessing}>
            <XCircle className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}
      
      {multiple && selectedFiles && selectedFiles.length > 0 && !error && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">{selectedFiles.length} file(s) selected:</h4>
          <ul className="max-h-48 overflow-y-auto space-y-1 pr-2">
            {Array.from(selectedFiles).map((file, index) => (
              <li key={index} className="p-2 border rounded-md bg-secondary/30 flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-foreground truncate ">{file.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              </li>
            ))}
          </ul>
           <Button variant="outline" size="sm" onClick={clearSelection} disabled={isProcessing} className="mt-2">
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
