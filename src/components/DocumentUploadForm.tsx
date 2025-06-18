
"use client";

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UploadCloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { DocumentMetadata } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext'; // Import the auth context

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_FILE_TYPES = ['application/pdf'];

const formSchema = z.object({
  pdfFile: z
    .instanceof(FileList)
    .refine((files) => files && files.length > 0, "Please select a PDF file.")
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 100MB.`)
    .refine(
      (files) => files?.[0]?.type ? ACCEPTED_FILE_TYPES.includes(files[0].type) : false,
      "Only .pdf files are accepted."
    ),
});

type FormValues = z.infer<typeof formSchema>;

export default function DocumentUploadForm() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth(); // Get the authenticated user
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{success: boolean; message: string; document?: DocumentMetadata} | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdfFile: undefined,
    },
    mode: 'onChange',
  });

  const onSubmit = (data: FormValues) => {
    setUploadResult(null);
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be signed in to upload a document.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      if (!data.pdfFile || data.pdfFile.length === 0) {
        toast({ title: "Error", description: "No file selected.", variant: "destructive" });
        return;
      }
      
      try {
        const idToken = await user.getIdToken();
        const fileToUpload = data.pdfFile[0];
        const formDataPayload = new FormData();
        formDataPayload.append('pdfFile', fileToUpload);
        formDataPayload.append('idToken', idToken); // Append the auth token

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataPayload,
        });

        const result = await response.json();
        setUploadResult(result);

        if (response.ok && result.success) {
          toast({
            title: "Upload Queued",
            description: result.message,
            variant: "default",
          });
          form.reset();
          setFileName(null);
          
          if (result.document && result.document.id) {
            setTimeout(() => router.push(`/chat/${result.document.id}`), 1500);
          } else {
            setTimeout(() => router.push('/dashboard'), 1500);
          }
        } else {
          toast({
            title: "Upload Failed",
            description: result.message || "An error occurred.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Upload error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected network error occurred.";
        setUploadResult({success: false, message: errorMessage});
        toast({
          title: "Upload Error",
          description: errorMessage,
          variant: "destructive",
        });
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
          Select a PDF file to process. Your document will be processed in the background.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!user ? (
            <div className="text-center text-lg text-muted-foreground p-8">
                <p>Please <Button variant="link" className="p-0 h-auto text-lg" onClick={() => router.push('/login')}>sign in</Button> to upload documents.</p>
            </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="pdfFile"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel htmlFor={field.name}>PDF File</FormLabel>
                    <FormControl>
                      <Input
                        id={field.name}
                        type="file"
                        accept=".pdf"
                        className="file:text-primary file:font-semibold hover:file:bg-primary/10 h-auto p-3"
                        disabled={isPending}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            form.setValue('pdfFile', files, { shouldValidate: true });
                            setFileName(files[0].name);
                            setUploadResult(null);
                          } else {
                            form.setValue('pdfFile', new DataTransfer().files, { shouldValidate: true });
                            setFileName(null);
                          }
                        }}
                        ref={field.ref}
                      />
                    </FormControl>
                    {fileName && !fieldState.error && <p className="text-sm text-muted-foreground mt-1">Selected: {fileName}</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-lg py-3" disabled={isPending || !form.formState.isValid}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Queuing Upload...
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2 h-5 w-5" /> Upload and Process
                  </>
                )}
              </Button>
            </form>
          </Form>
        )}
         {uploadResult && (
          <div className={`mt-4 p-4 rounded-md text-sm ${uploadResult.success ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'}`}>
            <div className="flex items-center">
              {uploadResult.success ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertTriangle className="h-5 w-5 mr-2" />}
              <p className="font-semibold">{uploadResult.success ? "Queued for Processing" : "Error"}</p>
            </div>
            <p>{uploadResult.message}</p>
            {uploadResult.success && uploadResult.document && (
               <Button variant="link" size="sm" className="p-0 h-auto mt-1" onClick={() => router.push(`/chat/${uploadResult.document!.id}`)}>
                 View processing status for {uploadResult.document.name}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
