
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { handlePdfUpload } from '@/app/actions';
import { UploadCloud, Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_FILE_TYPES = ['application/pdf'];

const formSchema = z.object({
  pdfFile: z
    .instanceof(FileList, { message: "Please select a valid file." })
    .refine((files) => files.length > 0, "Please select a PDF file.")
    .refine((files) => files.length > 0 && files[0].size <= MAX_FILE_SIZE, `Max file size is 100MB.`)
    .refine(
      (files) => files.length > 0 && ACCEPTED_FILE_TYPES.includes(files[0].type),
      "Only .pdf files are accepted."
    ),
});

type FormValues = z.infer<typeof formSchema>;

export default function DocumentUploadForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdfFile: undefined,
    },
    mode: 'onChange', // Validate on change for better UX with file inputs
  });

  const { ref: pdfFileRef, ...pdfFileRest } = form.register('pdfFile');

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('pdfFile', data.pdfFile[0]);

      try {
        const result = await handlePdfUpload(formData);
        if (result.success) {
          toast({
            title: "Upload Successful",
            description: result.message,
          });
          if (result.document) {
            router.push(`/dashboard`); 
          } else {
            router.push('/dashboard');
          }
        } else {
          toast({
            title: "Upload Failed",
            description: result.message,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "An unexpected error occurred during upload.",
          variant: "destructive",
        });
        console.error("Upload error:", error);
      }
    });
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center">
          <UploadCloud className="mr-3 h-7 w-7 text-primary" />
          Upload PDF Document
        </CardTitle>
        <CardDescription>
          Select a PDF file to process. Max file size: 100MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pdfFile" className="text-base">PDF File</Label>
            <Input
              id="pdfFile"
              type="file"
              accept=".pdf"
              className="file:text-primary file:font-semibold hover:file:bg-primary/10 h-auto p-3"
              {...pdfFileRest}
              ref={pdfFileRef}
              onChange={(event) => {
                // Manually call react-hook-form's onChange and then our custom logic
                pdfFileRest.onChange(event); 
                
                const files = event.target.files;
                if (files && files.length > 0) {
                  form.setValue('pdfFile', files, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                  setFileName(files[0].name);
                } else {
                  // Clear the value if no file is selected or selection is cancelled
                  form.setValue('pdfFile', new DataTransfer().files, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
                  setFileName(null);
                }
              }}
              disabled={isPending}
            />
            {fileName && <p className="text-sm text-muted-foreground mt-1">Selected: {fileName}</p>}
            {form.formState.errors.pdfFile && (
              <p className="text-sm text-destructive">{form.formState.errors.pdfFile.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full text-lg py-3" disabled={isPending || !form.formState.isValid}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-5 w-5" /> Upload and Process
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
