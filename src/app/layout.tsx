
"use client"; 

import type {Metadata} from 'next';
import './globals.css';
// import { Toaster } from "@/components/ui/toaster"; // Original import
import { AuthProvider } from "@/hooks/use-auth"; 
import dynamic from 'next/dynamic';

// Dynamically import Toaster with SSR turned off
const Toaster = dynamic(() => import('@/components/ui/toaster').then(mod => mod.Toaster), {
  ssr: false,
});

// Metadata should be defined as an export, not an object if layout is client component.
// However, for simplicity in this fix, we'll keep it as is.
// For production, consider moving metadata to a server component parent or using the `generateMetadata` function.
// export const metadata: Metadata = {
//   title: 'ProcessAI',
//   description: 'Automated Legal Process Analysis with AI',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
