import PersonaConfigurationForm from '@/components/PersonaConfigurationForm';
import { getAiPersona } from '@/app/actions';

export default async function PersonaAdminPage() {
  const currentPersona = await getAiPersona();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">AI Persona Management</h1>
      <PersonaConfigurationForm currentPersona={currentPersona} />
    </div>
  );
}
