
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation"; // Added useRouter
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Send, User, Bot, AlertCircle, CornerDownLeft } from "lucide-react";
import { consolidateAnalysisChat, type ConsolidateAnalysisChatInput, type ConsolidateAnalysisChatOutput } from "@/ai/flows/consolidate-analysis-chat";
import { getDocumentAnalyses, getProcessSummary, type DocumentAnalysis, type ProcessSummary } from "@/lib/firebase"; // Updated imports
import { cn } from "@/lib/utils";
import Link from "next/link"; // Added import for Link

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ConsolidatedChatPage() {
  const params = useParams();
  const processId = params.processId as string;
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const router = useRouter(); // Added router

  const [processSummary, setProcessSummary] = useState<ProcessSummary | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processId && user) {
      setIsLoadingData(true);
      setError(null);
      Promise.all([
        getProcessSummary(processId), // Updated function call
        getDocumentAnalyses(processId) // Updated function call
      ]).then(([summary, docs]) => {
        if (!summary) {
          setError("Process summary not found. Chat cannot be initiated.");
          toast({ title: "Chat Initialization Error", description: "Process summary not found.", variant: "destructive" });
          setProcessSummary(null);
          setDocumentCount(0);
          setIsLoadingData(false);
          router.push('/dashboard'); // Redirect if process not found
          return;
        }
        setProcessSummary(summary);
        setDocumentCount(docs.length);
        if (docs.length === 0) {
           const initialError = "No documents analyzed for this process. Chat cannot be effectively used.";
           setError(initialError);
           toast({ title: "Chat Information", description: initialError, variant: "default" }); // Info, not destructive
           setMessages([
            { 
              id: 'system-init-no-docs', 
              role: 'assistant', 
              content: `Hello! I'm ready to discuss Process ${summary.processNumber}. Currently, no documents have been analyzed. You can still ask general questions, or analyze documents first.`, 
              timestamp: new Date() 
            }
          ]);
        } else {
           setMessages([
            { 
              id: 'system-init', 
              role: 'assistant', 
              content: `Hello! I'm ready to discuss Process ${summary.processNumber}. I have access to ${docs.length} analyzed document(s). How can I help you?`, 
              timestamp: new Date() 
            }
          ]);
        }
      }).catch(err => {
        console.error("Error loading initial chat data:", err);
        const errorMsg = "Failed to load process data for chat.";
        setError(errorMsg);
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
      }).finally(() => setIsLoadingData(false));
    }
  }, [processId, user, toast, router]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!inputMessage.trim() || !processId || isSending ) return; // Allow sending even if initial error for no docs

    const userMessage: ChatMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsSending(true);

    try {
      const chatInput: ConsolidateAnalysisChatInput = {
        processId: processId,
        prompt: userMessage.content, 
      };
      const result: ConsolidateAnalysisChatOutput = await consolidateAnalysisChat(chatInput);
      
      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        content: result.chatResponse,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err) {
      console.error("Error in chat:", err);
      const errorMsg = err instanceof Error ? err.message : "An unknown error occurred in chat.";
      const errorResponseMessage: ChatMessage = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorResponseMessage]);
      toast({ title: "Chat Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center p-10 h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading chat data...</p>
      </div>
    );
  }
  
  // Allow chat even if initial error was "no documents analyzed", but not for "process not found"
  const isChatDisabled = error && error.includes("Process summary not found");

   if (isChatDisabled) {
     return (
      <Card className="shadow-lg w-full">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertCircle className="mr-2 h-6 w-6" />Chat Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive-foreground bg-destructive/10 p-4 rounded-md">{error}</p>
          <Button variant="link" asChild className="mt-4">
            <Link href={`/dashboard`}>Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-xl w-full h-[calc(100vh-220px)] flex flex-col">
      <CardHeader className="border-b">
         <div className="flex items-center space-x-3 mb-1">
            <MessageSquare className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl md:text-3xl">Step 3: Consolidated Chat</CardTitle>
        </div>
        <CardDescription>
          Interact with the AI about Process: <strong>{processSummary?.processNumber || processId}</strong>. 
          {documentCount > 0 ? `It has access to ${documentCount} analyzed document(s).` : "No documents have been analyzed yet for this process."}
        </CardDescription>
         {error && !isChatDisabled && ( // Display non-blocking errors (e.g. no documents)
          <div className="mt-2 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md text-sm">
            <AlertCircle className="inline h-4 w-4 mr-1" />
            {error}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4 sm:p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end space-x-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
                )}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="h-8 w-8 flex-shrink-0 bg-primary text-primary-foreground">
                    <AvatarFallback><Bot size={18}/></AvatarFallback>
                  </Avatar>
                )}
                 {msg.role === 'user' && user?.photoURL && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <img src={user.photoURL} alt={user.displayName || "User"} className="rounded-full"/>
                  </Avatar>
                )}
                {msg.role === 'user' && !user?.photoURL && (
                   <Avatar className="h-8 w-8 flex-shrink-0 bg-secondary text-secondary-foreground">
                    <AvatarFallback><User size={18}/></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "p-3 rounded-xl shadow",
                    msg.role === 'user'
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-card border rounded-bl-none",
                    msg.content.startsWith("Sorry, I encountered an error:") ? "bg-destructive/10 text-destructive border-destructive" : ""
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                      "text-xs mt-1",
                      msg.role === 'user' ? "text-primary-foreground/70 text-right" : "text-muted-foreground text-left"
                    )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-end space-x-3 mr-auto max-w-[85%]">
                 <Avatar className="h-8 w-8 flex-shrink-0 bg-primary text-primary-foreground">
                    <AvatarFallback><Bot size={18}/></AvatarFallback>
                  </Avatar>
                <div className="p-3 rounded-xl shadow bg-card border rounded-bl-none">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-card">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-3">
          <Input
            type="text"
            placeholder={isChatDisabled ? "Chat unavailable" : "Type your message here..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-1 text-base"
            disabled={isSending || isChatDisabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={isSending || !inputMessage.trim() || isChatDisabled}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

// Minimal Avatar components for this page if not globally available or to avoid ShadCN dependency for these simple ones
function Avatar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex items-center justify-center rounded-full overflow-hidden", className)}>{children}</div>;
}
function AvatarFallback({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center h-full w-full">{children}</div>;
}
