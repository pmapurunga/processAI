# **App Name**: ProcessAI

## Core Features:

- Google Login: Enable secure login using Google authentication.
- PDF Upload: Allow users to upload a PDF file containing a process summary.
- Summary Extraction: Extract the process summary and the 'Process Number' from the uploaded PDF using Documents AI.
- Summary Storage: Store the extracted summary in Firestore, indexed by the 'Process Number'.  Note: I can't provide code for cloud databases.
- Document Upload: Allow users to upload a sequence of documents related to the summary. Implement direct file uploads from Google Drive
- Document Analysis: Analyze each uploaded document using Documents AI combined with Gemini AI, following a user-defined prompt.
- Chat Interface: Use a generative AI tool, combined with data extracted from prior documents, to engage in a chat-style process analysis that leverages Gemini Pro 2.5, accessing the data from Firestore to inform the conversation.

## Style Guidelines:

- Primary color: HSL(210, 60%, 50%) which is a moderately saturated blue, conveying trust and efficiency.  Hex: #337AB7
- Background color:  HSL(210, 20%, 95%), a very light tint of the primary color that provides a clean, non-distracting backdrop for detailed document analysis.  Hex: #F0F4F8
- Accent color: HSL(180, 70%, 40%), a contrasting teal color used to highlight key interactive elements. Hex: #33A3A3
- Body font: 'Inter' sans-serif for a clean, modern, readable UI.
- Headline font: 'Space Grotesk' sans-serif to differentiate headers from the body font.
- Use simple, clear icons to represent document types, analysis status, and other key actions. Use filled icons for emphasis and line icons for auxiliary elements.
- Employ subtle animations for loading states and transitions between document analysis stages to provide a smooth user experience.