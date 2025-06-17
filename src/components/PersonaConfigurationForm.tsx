"use client";

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { updateAiPersonaConfig } from '@/app/actions';
import type { PersonaConfig } from '@/lib/types';
import { Bot, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';

const formSchema = z.object({
  description: z.string().min(20, "Persona description must be at least 20 characters long."),
});

type FormValues = z.infer<typeof formSchema>;

interface PersonaConfigurationFormProps {
  currentPersona: PersonaConfig;
}

export default function PersonaConfigurationForm({ currentPersona }: PersonaConfigurationFormProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState(currentPersona.updatedAt);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: currentPersona.description || '',
    },
  });
  
  useEffect(() => {
    form.reset({ description: currentPersona.description });
    setLastUpdated(currentPersona.updatedAt);
  }, [currentPersona, form]);


  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      try {
        const result = await updateAiPersonaConfig(data.description);
        if (result.success && result.persona) {
          toast({
            title: "AI Persona Updated",
            description: result.message,
          });
          form.reset({ description: result.persona.description }); // Update form with potentially modified description from backend
          setLastUpdated(result.persona.updatedAt);
        } else {
          toast({
            title: "Update Failed",
            description: result.message,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Update Error",
          description: "An unexpected error occurred while updating the persona.",
          variant: "destructive",
        });
        console.error("Persona update error:", error);
      }
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center">
            <Bot className="mr-3 h-7 w-7 text-primary" />
            Configure AI Persona
        </CardTitle>
        <CardDescription>
          Define how the AI should behave, its tone, and communication style.
          Last updated: {format(new Date(lastUpdated), "PPpp")}
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-semibold">Persona Description</Label>
            <Textarea
              id="description"
              rows={10}
              className="text-base leading-relaxed"
              placeholder="e.g., You are a helpful legal assistant. Be formal and cite sources from the document..."
              {...form.register('description')}
              disabled={isPending}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full sm:w-auto text-lg py-3" disabled={isPending || !form.formState.isDirty}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" /> Save Persona
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
