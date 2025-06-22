import * as admin from 'firebase-admin';
// The service-account-key.json is located at the root of the project.
// The build process will handle this import.
import serviceAccountKey from '../../../service-account-key.json';

// Type assertion for the imported JSON to satisfy the credential.cert method.
const serviceAccount = serviceAccountKey as admin.ServiceAccount;


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

  console.log(`Initializing Firebase Admin SDK for project: ${projectId} using explicit service account credentials.`);

  admin.initializeApp({
    // Use the explicit service account credentials from the imported JSON file.
    // This bypasses potential issues with Application Default Credentials in some environments.
    credential: admin.credential.cert(serviceAccount),
    // Explicitly provide the projectId and databaseURL to ensure the SDK
    // connects to the correct project and database.
    projectId: projectId,
    databaseURL: `https://${projectId}.firebaseio.com`,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  // Return the admin namespace, which contains all the services like auth, firestore, etc.
  return admin;
}
