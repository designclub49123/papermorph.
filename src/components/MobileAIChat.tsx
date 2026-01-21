import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Send, 
  Loader2, 
  Sparkles, 
  Download, 
  Copy, 
  Check,
  FileText,
  Mail,
  FileBarChart,
  Wand2,
  MessageSquare,
  ArrowLeft,
  Bot,
  User,
  Trash2,
  Menu,
  X
} from 'lucide-react';
import { useAISidebar } from '@/state/useAISidebar';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/state/useUserStore';
import jsPDF from 'jspdf';

const QUICK_PROMPTS = [
  { id: 'letter', label: 'Write a Letter', icon: Mail, prompt: 'Write a professional business letter for me.' },
  { id: 'email', label: 'Draft Email', icon: Mail, prompt: 'Help me write a professional email.' },
  { id: 'report', label: 'Create Report', icon: FileBarChart, prompt: 'Help me create a detailed report.' },
  { id: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Summarize the following content for me.' },
  { id: 'brainstorm', label: 'Brainstorm', icon: Sparkles, prompt: 'Help me brainstorm ideas for...' },
];

export const MobileAIChat: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useUserStore();
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isGenerating,
    sendMessage,
    clearMessages,
  } = useAISidebar();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isGenerating) return;
    
    const message = inputValue.trim();
    setInputValue('');
    
    try {
      await sendMessage(message);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setInputValue(message);
    }
  }, [inputValue, isGenerating, sendMessage]);

  const handleQuickPrompt = useCallback((prompt: string) => {
    setInputValue(prompt);
    inputRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleDownloadPDF = useCallback((content: string) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      
      doc.setFontSize(12);
      const lines = doc.splitTextToSize(content, maxWidth);
      
      let y = margin;
      const lineHeight = 7;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      lines.forEach((line: string) => {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += lineHeight;
      });
      
      doc.save('ai-response.pdf');
      toast.success('PDF downloaded');
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to download PDF');
    }
  }, []);

  const handleClearChat = useCallback(() => {
    clearMessages();
    setShowMenu(false);
    toast.success('Chat cleared');
  }, [clearMessages]);

  const lastAssistantMessage = messages.slice().reverse().find(m => m.role === 'assistant');

  return (
    <div className={cn(
      "flex flex-col h-screen w-full",
      theme === 'dark' ? 'bg-background' : 'bg-background'
    )}>
      {/* Header */}
      <header className={cn(
        "flex items-center justify-between px-4 py-3 border-b",
        "bg-background border-border"
      )}>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">PaperMorph AI</h1>
              <p className="text-xs text-muted-foreground">Your writing assistant</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI
          </Badge>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowMenu(!showMenu)}
            className="h-9 w-9"
          >
            {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Menu Dropdown */}
      {showMenu && (
        <div className={cn(
          "absolute top-14 right-4 z-50 rounded-lg shadow-lg border p-2 min-w-[160px]",
          "bg-background border-border"
        )}>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-sm"
            onClick={handleClearChat}
          >
            <Trash2 className="h-4 w-4" />
            Clear Chat
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-sm"
            onClick={() => {
              navigate('/dashboard');
              setShowMenu(false);
            }}
          >
            <FileText className="h-4 w-4" />
            My Documents
          </Button>
        </div>
      )}

      {/* Quick Prompts - Show only when no messages or few messages */}
      {messages.length <= 1 && (
        <div className="p-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-3">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => handleQuickPrompt(item.prompt)}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              
              <div className={cn(
                "max-w-[85%] rounded-2xl px-4 py-3",
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              )}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                
                {/* Action buttons for assistant messages */}
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleCopy(message.content, message.id)}
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleDownloadPDF(message.content)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          
          {isGenerating && (
            <div className="flex gap-3 justify-start">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Download Last Response Card */}
      {lastAssistantMessage && !isGenerating && (
        <div className="px-4 pb-2">
          <Card className="border-dashed">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Latest AI response ready</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadPDF(lastAssistantMessage.content)}
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-background border-border">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask me anything..."
            className="flex-1 h-11 text-base"
            disabled={isGenerating}
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isGenerating}
            className="h-11 w-11 p-0"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Powered by PaperMorph AI
        </p>
      </div>
    </div>
  );
};

export default MobileAIChat;
