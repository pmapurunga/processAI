
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
// import { handlePdfUpload } from '@/app/actions'; // Não mais usado diretamente
import { UploadCloud, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  const [fileName, setFileName] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pdfFile: undefined,
    },
    mode: 'onChange',
  });

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      if (!data.pdfFile || data.pdfFile.length === 0) {
        toast({ title: "Error", description: "No file selected for upload.", variant: "destructive" });
        return;
      }

      const fileToUpload = data.pdfFile[0];
      const formDataPayload = new FormData();
      formDataPayload.append('pdfFile', fileToUpload);

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataPayload,
        });

        const result = await response.json();

        if (response.ok && result.success) {
          toast({
            title: "Upload In Progress",
            description: result.message,
          });
          if (result.documentId) {
            console.log("Document ID from API:", result.documentId);
            // router.push(`/dashboard`); // Pode ser reativado se necessário
          }
        } else {
          toast({
            title: "Upload Failed",
            description: result.message || "An error occurred on the server.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Upload error (client-side fetch catch block):", error);
        toast({
          title: "Upload Error (Client)",
          description: error instanceof Error ? error.message : "An unexpected network error occurred during the upload attempt.",
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
          Select a PDF file to process. Max file size: 100MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          {/* O atributo 'action' é removido pois o envio é manual via fetch */}
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
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-5 w-5" /> Upload and Process
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
