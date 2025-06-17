import DocumentUploadForm from '@/components/DocumentUploadForm';

export default function UploadPage() {
  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <h1 className="text-3xl font-headline font-bold mb-8 text-center">Process New Document</h1>
      <DocumentUploadForm />
    </div>
  );
}
