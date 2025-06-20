
import { NextResponse } from 'next/server';
import { processPdfUploadLogic } from '@/app/actions';
import { getAdmin } from '@/lib/firebase-admin'; // Import firebase-admin

export async function POST(request: Request) {
  console.log('[API ROUTE /api/upload] Received POST request');
  try {
    const formData = await request.formData();
    console.log('[API ROUTE /api/upload] FormData parsed from request');

    const idToken = formData.get('idToken') as string | null;

    if (!idToken) {
      console.log('[API ROUTE /api/upload] Missing ID token');
      return NextResponse.json({ success: false, message: 'Authentication token is missing.' }, { status: 401 });
    }

    let userId: string;
    try {
      const admin = getAdmin();
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      userId = decodedToken.uid;
      console.log(`[API ROUTE /api/upload] Verified ID token for user: ${userId}`);
    } catch (authError) {
      console.error('[API ROUTE /api/upload] Invalid ID token:', authError);
      return NextResponse.json({ success: false, message: 'Invalid authentication token.' }, { status: 401 });
    }

    // Chama a lógica de processamento, passando o userId real
    const result = await processPdfUploadLogic(formData, userId);

    if (result.success) {
      console.log('[API ROUTE /api/upload] Process logic successful:', result.message);
      return NextResponse.json(result, { status: 200 });
    } else {
      console.log('[API ROUTE /api/upload] Process logic failed:', result.message);
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('[API ROUTE /api/upload] Error processing request:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred on the server.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
