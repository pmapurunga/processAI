
import { NextResponse } from 'next/server';
import { processPdfUploadLogic } from '@/app/actions'; // Importando a lógica de processamento

export async function POST(request: Request) {
  console.log('[API ROUTE /api/upload] Received POST request');
  try {
    const formData = await request.formData();
    console.log('[API ROUTE /api/upload] FormData parsed from request');

    // Chama a lógica de processamento que estava em actions.ts
    const result = await processPdfUploadLogic(formData);

    if (result.success) {
      console.log('[API ROUTE /api/upload] Process logic successful:', result.message);
      return NextResponse.json(result, { status: 200 });
    } else {
      console.log('[API ROUTE /api/upload] Process logic failed:', result.message);
      return NextResponse.json(result, { status: 400 }); // Ou outro status apropriado
    }
  } catch (error) {
    console.error('[API ROUTE /api/upload] Error processing request:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred on the server.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
