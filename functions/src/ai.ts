
import { genkit } from "@genkit-ai/core";
import { googleAI } from "@genkit-ai/googleai";
import { firebase } from "@genkit-ai/firebase";

// This is a specific AI initialization for the Cloud Functions backend.
// It ensures that the functions environment has its own configured instance of Genkit.

export const ai = genkit({
  plugins: [
    firebase(), // Configure Firebase plugin for backend operations
    googleAI(), // Configure Google AI plugin
  ],
  logSinks: ["firebase"], // Log to Firebase by default in the backend
  enableTracingAndMetrics: true,
});
