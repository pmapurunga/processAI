
import * as admin from 'firebase-admin';
// The service account key is in the root of the project, so we need to go up two directories.
import serviceAccountKey from '../../service-account-key.json';

// This function implements "lazy initialization" for the Firebase Admin SDK.
// It ensures that the SDK is initialized only once, and only when it's actually needed.
// This is the recommended pattern for Next.js and other serverless environments.

export function getAdmin() {
  if (admin.apps.length > 0) {
    return admin;
  }

  console.log("Initializing Firebase Admin SDK using Service Account Key...");

  // The imported JSON needs to be cast to the type expected by the Admin SDK
  const serviceAccount = serviceAccountKey as admin.ServiceAccount;

  admin.initializeApp({
    // Use the service account credentials from the JSON file.
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    // It is a good practice to also specify the database URL.
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });
  
  // Return the admin namespace, which contains all the services like auth, firestore, etc.
  return admin;
}
