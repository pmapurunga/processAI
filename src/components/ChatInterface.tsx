"use client";

import { useState, useEffect, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage, DocumentMetadata } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { queryDocumentAction } from '@/app/actions';

interface ChatInterfaceProps {
  document: DocumentMetadata;
  initialMessages: ChatMessage[];
}

export default function ChatInterface({ document, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      documentId: document.id,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');

    startTransition(async () => {
      try {
        const aiMessage = await queryDocumentAction({ documentId: document.id, query: currentInput });
        setMessages(prev => [...prev, aiMessage]);
      } catch (error) {
        console.error("Error querying document:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        
        toast({
          title: 'Error',
          description: `Failed to get a response: ${errorMessage}`,
          variant: 'destructive',
        });

        const errorAiMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            documentId: document.id,
            role: 'assistant',
            content: "I'm sorry, but I encountered an error while trying to answer your question. Please try again.",
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorAiMessage]);
      }
    });
  };

  return (
    <Card className="w-full h-[calc(100vh-10rem)] flex flex-col shadow-2xl rounded-lg overflow-hidden">
      <CardHeader className="border-b">
        <CardTitle className="text-xl font-headline">Chat with: {document.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end space-x-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot size={18} /></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-xs lg:max-w-md p-3 rounded-xl shadow',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-foreground rounded-bl-none'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn("text-xs mt-1", msg.role === 'user' ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/70 text-left')}>
                     {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                 {msg.role === 'user' && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><User size={18} /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isPending && (
               <div className="flex items-end space-x-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot size={18} /></AvatarFallback>
                  </Avatar>
                  <div className="max-w-xs lg:max-w-md p-3 rounded-xl shadow bg-muted text-foreground rounded-bl-none">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
               </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-3">
          <Input
            type="text"
            placeholder={document.status !== 'processed' ? 'Please wait, document is being processed...' : 'Ask something about the document...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 text-base"
            disabled={isPending || document.status !== 'processed'}
            aria-label="Chat message input"
          />
          <Button type="submit" size="icon" disabled={isPending || !input.trim() || document.status !== 'processed'} aria-label="Send message">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
