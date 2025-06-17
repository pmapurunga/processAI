
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label'; // Label ainda é usado, mas FormLabel é preferível dentro de FormField
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { handlePdfUpload } from '@/app/actions';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_FILE_TYPES = ['application/pdf'];

const formSchema = z.object({
  pdfFile: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, "Please select a PDF file.") // Garante que o FileList não está vazio
    .refine((files) => files[0].size <= MAX_FILE_SIZE, `Max file size is 100MB.`) // files[0] é seguro devido ao refine anterior
    .refine(
      (files) => ACCEPTED_FILE_TYPES.includes(files[0].type), // files[0] é seguro
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
                      ref={field.ref} // Importante para o Controller/FormField
                      onBlur={field.onBlur}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          field.onChange(files); // Passa o FileList para o RHF Controller
                          setFileName(files[0].name);
                        } else {
                          // Cria um FileList vazio para garantir que a validação "Please select a PDF file." seja acionada
                          field.onChange(new DataTransfer().files); 
                          setFileName(null);
                        }
                      }}
                      disabled={isPending}
                    />
                  </FormControl>
                  {fileName && !fieldState.error && <p className="text-sm text-muted-foreground mt-1">Selected: {fileName}</p>}
                  <FormMessage /> {/* Exibe erros de validação para 'pdfFile' */}
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
