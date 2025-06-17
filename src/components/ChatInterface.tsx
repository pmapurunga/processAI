"use client";

import { useState, useEffect, useRef, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage, DocumentMetadata } from '@/lib/types';
import { getChatMessages, sendMessage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

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
    // Scroll to bottom when messages change
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

    const optimisticUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      documentId: document.id,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, optimisticUserMessage]);
    const currentInput = input;
    setInput('');

    startTransition(async () => {
      const result = await sendMessage({ documentId: document.id, message: currentInput });
      
      setMessages(prev => prev.filter(msg => msg.id !== optimisticUserMessage.id)); // Remove optimistic message

      if (result.success && result.userMessage && result.aiMessage) {
        setMessages(prev => [...prev, result.userMessage!, result.aiMessage!]);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to send message.',
          variant: 'destructive',
        });
        // Add back user message if AI failed
        setMessages(prev => [...prev, optimisticUserMessage]);
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
            {isPending && messages[messages.length-1]?.role === 'user' && ( // Show loader only if last message was user and pending
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
            placeholder="Ask something about the document..."
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
