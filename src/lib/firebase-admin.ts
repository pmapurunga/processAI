import * as admin from 'firebase-admin';

/**
 * Implements "lazy initialization" for the Firebase Admin SDK.
 * This ensures that the SDK is initialized only once and only when it's actually needed.
 * This is the recommended pattern for Next.js and other serverless environments.
 */
export function getAdmin() {
  // If the app is already initialized, return the existing admin instance.
  if (admin.apps.length > 0) {
    return admin;
  }

  // In a GCP environment, it's best to rely on the standard `GOOGLE_CLOUD_PROJECT`
  // environment variable, but we'll fall back to the one defined in the Next.js config.
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      'Firebase project ID not found. Please set the ' +
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable.',
    );
  }

  console.log(`Initializing Firebase Admin SDK for project: ${projectId}`);

  admin.initializeApp({
    // Use Application Default Credentials, which is the standard for GCP environments.
    credential: admin.credential.applicationDefault(),
    // Explicitly provide the projectId and databaseURL to ensure the SDK
    // connects to the correct project and database.
    projectId: projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  // Return the admin namespace, which contains all the services like auth, firestore, etc.
  return admin;
}
