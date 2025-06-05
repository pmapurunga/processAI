"use client";
import Link from "next/link";
import { AuthButton } from "@/components/auth/AuthButton";
import { FileText } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" />
          <span className="font-headline text-2xl font-semibold text-foreground">ProcessAI</span>
        </Link>
        <AuthButton />
      </div>
    </header>
  );
}
