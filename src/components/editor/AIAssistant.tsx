import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Wand2, 
  Send, 
  Plus,
  Eraser,
  Lightbulb,
  Volume2,
  VolumeX,
  Maximize2,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  isLoading?: boolean;
  isError?: boolean;
}

interface AIAssistantProps {
  onApplyContent: (content: string) => void;
  documentContext?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ onApplyContent, documentContext }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'wizard'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your PaperMorph AI assistant. I can help you write letters, emails, reports, and more. Just tell me what you need!",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    if (!user) {
      toast.error('Please sign in to use AI features');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };
    
    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    const userQuery = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          action: 'chat',
          content: userQuery,
          context: documentContext || undefined,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get AI response');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Replace loading message with actual response
      setMessages(prev => prev.map(msg => 
        msg.isLoading 
          ? { ...msg, content: data.result, isLoading: false }
          : msg
      ));

    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      // Replace loading message with error
      setMessages(prev => prev.map(msg => 
        msg.isLoading 
          ? { ...msg, content: errorMessage, isLoading: false, isError: true }
          : msg
      ));
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Chat cleared. How can I help you?",
      },
    ]);
  };

  const handleApply = () => {
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant' && !m.isLoading && !m.isError).pop();
    if (lastAssistantMessage) {
      onApplyContent(lastAssistantMessage.content);
      toast.success('Content applied to document');
    }
  };

  const handleQuickAction = async (action: string) => {
    if (!user) {
      toast.error('Please sign in to use AI features');
      return;
    }

    let prompt = '';
    switch (action) {
      case 'letter':
        prompt = 'Write a professional business letter template with proper formatting';
        break;
      case 'email':
        prompt = 'Write a professional email template for business communication';
        break;
      case 'report':
        prompt = 'Create a report template with sections for executive summary, findings, and recommendations';
        break;
      case 'tips':
        prompt = 'Give me 5 quick tips for better document writing';
        break;
      default:
        return;
    }

    setInputValue(prompt);
  };

  return (
    <aside className="ai-assistant">
      {/* Header */}
      <div className="ai-header">
        <div className="ai-header-title">
          <div className="ai-avatar">
            <Wand2 size={16} />
          </div>
          <div className="ai-title-text">
            <span className="ai-name">AI Assistant</span>
            <span className="ai-subtitle">Intelligent writing</span>
          </div>
        </div>
        <div className="ai-header-actions">
          <button className="ai-icon-btn" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button className="ai-icon-btn">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ai-tabs">
        <button 
          className={`ai-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={14} />
          <span>Chat</span>
        </button>
        <button 
          className={`ai-tab ${activeTab === 'wizard' ? 'active' : ''}`}
          onClick={() => setActiveTab('wizard')}
        >
          <Wand2 size={14} />
          <span>Wizard</span>
        </button>
      </div>

      {/* Quick Actions */}
      {activeTab === 'wizard' && (
        <div className="ai-quick-actions p-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Quick Templates</p>
          <div className="flex flex-wrap gap-2">
            <button 
              className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              onClick={() => handleQuickAction('letter')}
            >
              📝 Letter
            </button>
            <button 
              className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              onClick={() => handleQuickAction('email')}
            >
              ✉️ Email
            </button>
            <button 
              className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
              onClick={() => handleQuickAction('report')}
            >
              📊 Report
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="ai-messages">
        {messages.map((message) => (
          <div key={message.id} className={`ai-message ${message.role} ${message.isError ? 'error' : ''}`}>
            {message.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            ) : message.isError ? (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{message.content}</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {/* Apply Button */}
        {messages.length > 0 && messages.some(m => m.role === 'assistant' && !m.isLoading && !m.isError) && (
          <button className="ai-apply-btn" onClick={handleApply}>
            <Check size={14} />
            <span>Apply to Document</span>
          </button>
        )}
      </div>

      {/* Footer Actions */}
      <div className="ai-footer-actions">
        <button className="ai-action-btn" onClick={handleClear}>
          <Eraser size={14} />
          <span>Clear</span>
        </button>
        <button className="ai-action-btn" onClick={() => handleQuickAction('tips')}>
          <Lightbulb size={14} />
          <span>Tips</span>
        </button>
      </div>

      {/* Input */}
      <div className="ai-input-container">
        <button className="ai-input-add" onClick={() => setActiveTab('wizard')}>
          <Plus size={16} />
        </button>
        <input
          type="text"
          placeholder={isLoading ? "Thinking..." : "Ask me anything..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="ai-input"
          disabled={isLoading}
        />
        <button 
          className="ai-send-btn" 
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </aside>
  );
};

export default AIAssistant;
