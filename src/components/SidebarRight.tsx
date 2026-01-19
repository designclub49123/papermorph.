import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIChatBubble } from './AIChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { WizardForm } from './WizardForm';
import { useAISidebar, type WizardType } from '@/state/useAISidebar';
import { useEditorStore } from '@/state/useEditorStore';
import { useUserStore } from '@/state/useUserStore';
import { useDocStore } from '@/state/useDocStore';
import { AI_ACTIONS, WIZARD_TYPES } from '@/constants';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wand2,
  MessageSquare,
  GraduationCap,
  Check,
  Minimize2,
  Maximize2,
  FileText,
  Mail,
  FileBarChart,
  Presentation,
  BookOpen,
  Eraser,
  Zap,
  Pencil,
  Lightbulb,
  Copy,
  FileCheck,
  RefreshCw,
  AlertCircle,
  Brain,
  Flame,
  Eye,
  Volume2,
  Plus,
  X,
  Settings,
  History,
  Star,
  TrendingUp,
  Mic,
  Paperclip,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Code,
  Image,
  Link,
  Table,
  Search,
  Filter,
  Download,
  Upload,
  Share2,
  Heart,
  Bookmark,
  Flag,
  Archive,
  Trash2,
  Edit3,
  Save,
  Undo,
  Redo,
  Scissors,
  Clipboard,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { debounce } from 'lodash';
import { useSidebarStore } from '@/state/useSidebarStore';

const CHAT_SUGGESTIONS = [
  {
    id: 'summarize',
    title: 'Summarize',
    icon: FileText,
    prompt: 'Please summarize the selected text or document in a clear and concise manner, highlighting the main points and key information.'
  },
  {
    id: 'formal',
    title: 'Make Formal',
    icon: GraduationCap,
    prompt: 'Please rewrite the selected text in a more formal tone, using professional language and appropriate business communication style.'
  },
  {
    id: 'grammar',
    title: 'Check Grammar',
    icon: Check,
    prompt: 'Please review and correct any grammatical errors, spelling mistakes, and punctuation issues in the selected text.'
  },
  {
    id: 'expand',
    title: 'Expand',
    icon: Maximize2,
    prompt: 'Please expand on the selected text with more details, examples, and explanations to make it more comprehensive and informative.'
  },
  {
    id: 'condense',
    title: 'Make Concise',
    icon: Minimize2,
    prompt: 'Please condense the selected text to make it more brief and to the point, removing unnecessary words while maintaining the core meaning.'
  },
  {
    id: 'generate',
    title: 'Generate',
    icon: Sparkles,
    prompt: 'Please generate new content based on the topic or context provided, creating original and relevant material.'
  }
];

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  generate: Sparkles,
  formal: GraduationCap,
  grammar: Check,
  condense: Minimize2,
  expand: Maximize2,
  summarize: FileText,
};

const WIZARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  letter: Mail,
  report: FileBarChart,
  proposal: Presentation,
  essay: BookOpen,
};

export function SidebarRight() {
  const { rightCollapsed, setRightCollapsed } = useSidebarStore();
  const { currentDocument } = useDocStore();
  const [inputValue, setInputValue] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [isQuickActionsCollapsed, setIsQuickActionsCollapsed] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [isTipsCollapsed, setIsTipsCollapsed] = useState(false);
  const [documentContext, setDocumentContext] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; content?: string; size?: number; type?: string }[]>([]);
  const [compactMode, setCompactMode] = useState<boolean>(() => { try { return localStorage.getItem('pm:compact') === '1'; } catch { return false; } });
  const [activeTab, setActiveTab] = useState<'chat' | 'tools' | 'history'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [floatingTab, setFloatingTab] = useState<'chat' | 'tools' | 'history' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [actionProgress, setActionProgress] = useState<Record<string, number>>({});
  const [recentActions, setRecentActions] = useState<Array<{id: string, action: string, timestamp: Date}>>([]);
  const [aiUsage, setAiUsage] = useState({ total: 0, today: 0, remaining: 100 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { editor } = useEditorStore();
  const { theme, colorTheme } = useUserStore();
  
  // Enhanced document context extraction
  useEffect(() => {
    if (currentDocument && editor?.documentEditor) {
      try {
        const content = editor.documentEditor.serialize();
        const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        setDocumentContext(plainText.slice(0, 2000)); // Limit context size
      } catch (error) {
        console.error('Failed to extract document context:', error);
      }
    }
  }, [currentDocument, editor]);

  // AI Usage tracking
  useEffect(() => {
    const usage = localStorage.getItem('pm:aiUsage');
    if (usage) {
      setAiUsage(JSON.parse(usage));
    }
  }, []);

  const updateAiUsage = useCallback(() => {
    const newUsage = {
      total: aiUsage.total + 1,
      today: aiUsage.today + 1,
      remaining: Math.max(0, aiUsage.remaining - 1)
    };
    setAiUsage(newUsage);
    localStorage.setItem('pm:aiUsage', JSON.stringify(newUsage));
  }, [aiUsage]);

  const addRecentAction = useCallback((action: string) => {
    const newAction = {
      id: Date.now().toString(),
      action,
      timestamp: new Date()
    };
    setRecentActions(prev => [newAction, ...prev.slice(0, 9)]); // Keep last 10
  }, []);

  const {
    isOpen,
    mode,
    messages,
    isGenerating,
    wizardType,
    setMode,
    sendMessage,
    clearMessages,
    generateSection,
    rewriteFormal,
    fixGrammar,
    condense,
    expand,
    summarize,
    startWizard,
  } = useAISidebar();

  const speakText = (text?: string) => {
    if (!text) return;
    try {
      if ('speechSynthesis' in window) {
        const s = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(s);
      } else {
        toast.error('TTS not supported');
      }
    } catch (e) {
      console.error('TTS error', e);
    }
  };

  const applyLastAssistant = () => {
    const last = messages.slice().reverse().find(m => m.role === 'assistant');
    if (!last || !last.content) {
      toast.error('No assistant response found');
      return;
    }
    const ev = new CustomEvent('applyContent', { detail: { content: last.content } });
    window.dispatchEvent(ev);
    toast.success('Applied last AI content');
  };

  const showShortcuts = () => {
    alert('Keyboard shortcuts:\n• Enter = send\n• Shift+Enter = newline\n• Ctrl+Enter = page break\n• Ctrl+S = save (if available)');
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enhanced message sending with context and validation
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) {
      toast.error('Please enter a message');
      return;
    }
    
    if (aiUsage.remaining <= 0) {
      toast.error('AI usage limit reached. Please try again tomorrow.');
      return;
    }
    
    const message = inputValue.trim();
    setInputValue('');
    setShowQuickActions(false);
    
    // Build enhanced context from document and uploaded files
    const fileContext = uploadedFiles
      .filter(f => f.content)
      .map(f => `\n[File: ${f.name}]\n${f.content}`)
      .join('\n---\n');
    
    const fullContext = documentContext ? `\n[Document Context]\n${documentContext}\n${fileContext || ''}` : fileContext || '';

    try {
      await sendMessage(message, fullContext || undefined);
      updateAiUsage();
      toast.success('Message sent successfully!');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      setInputValue(message); // Restore for retry
    }
  }, [inputValue, uploadedFiles, sendMessage, documentContext, updateAiUsage, aiUsage.remaining]);

  // Debounced input handling for better performance
  const debouncedInputHandler = useCallback(
    debounce((value: string) => {
      // Additional input processing if needed
      if (value.length > 10000) {
        toast.error("Input too long. Please keep your message under 10,000 characters.");
       }
     }, 300),
     []
  );

  // File upload handling
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newFile = {
          id: Date.now().toString() + Math.random().toString(36),
          name: file.name,
          content: content.slice(0, 5000), // Limit content size
          size: file.size,
          type: file.type,
        };
        setUploadedFiles(prev => [...prev, newFile]);
        toast.success(`Uploaded: ${file.name}`);
      };
      reader.readAsText(file);
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Enhanced quick action handlers with progress tracking
  const handleQuickAction = useCallback(async (action: string) => {
    if (aiUsage.remaining <= 0) {
      toast.error('AI usage limit reached. Please try again tomorrow.');
      return;
    }

    // Get selected text from current document or use placeholder
    const selectedText = currentDocument?.content || 'Please help me with my document.';

    try {
      setActionProgress(prev => ({ ...prev, [action]: 0 }));
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setActionProgress(prev => {
          const current = prev[action] || 0;
          if (current >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return { ...prev, [action]: current + 10 };
        });
      }, 100);

      let result = '';
      switch (action) {
        case 'generate':
          await generateSection();
          toast.success('Content generated successfully!');
          break;
        case 'formal':
          result = await rewriteFormal(selectedText);
          if (result) toast.success('Text made more formal!');
          break;
        case 'grammar':
          result = await fixGrammar(selectedText);
          if (result) toast.success('Grammar checked and corrected!');
          break;
        case 'condense':
          result = await condense(selectedText);
          if (result) toast.success('Text condensed successfully!');
          break;
        case 'expand':
          result = await expand(selectedText);
          if (result) toast.success('Text expanded with more details!');
          break;
        case 'summarize':
          result = await summarize(selectedText);
          if (result) toast.success('Document summarized!');
          break;
        default:
          break;
      }
      
      clearInterval(progressInterval);
      setActionProgress(prev => ({ ...prev, [action]: 100 }));
      
      // Update usage and recent actions
      updateAiUsage();
      addRecentAction(action);
      
      // Reset progress after completion
      setTimeout(() => {
        setActionProgress(prev => ({ ...prev, [action]: 0 }));
      }, 1000);
      
    } catch (error) {
      console.error('Quick action failed:', error);
      setActionProgress(prev => ({ ...prev, [action]: 0 }));
      toast.error('Action failed. Please try again.');
    }
  }, [generateSection, rewriteFormal, fixGrammar, condense, expand, summarize, updateAiUsage, addRecentAction, aiUsage.remaining]);

  // Voice recording handler
  // Enhanced copy functionality with feedback
  const handleCopyMessage = useCallback(async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      toast.success("Message copied to clipboard");
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      toast.error("Failed to copy message");
    }
  }, []);

  // Enhanced input focus handling
  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
  }, []);

  // Enhanced UX handlers
  const handleActionHover = useCallback((actionId: string) => {
    setHoveredAction(actionId);
  }, []);

  const handleActionLeave = useCallback(() => {
    setHoveredAction(null);
  }, []);

  const handleSearchToggle = useCallback(() => {
    setShowSearch(!showSearch);
    if (!showSearch) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const handleTypingStart = useCallback(() => {
    setIsTyping(true);
  }, []);

  const handleTypingEnd = useCallback(() => {
    setIsTyping(false);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    setIsAnimating(true);
    setRightCollapsed(!rightCollapsed);
    setTimeout(() => setIsAnimating(false), 300);
  }, [rightCollapsed]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setInputValue('');
    toast.success("New chat started");
  }, [clearMessages]);

  const handleSuggestionClick = useCallback((suggestion: typeof CHAT_SUGGESTIONS[0]) => {
    setInputValue(suggestion.prompt);
    inputRef.current?.focus();
  }, []);

  const handleTipAction = useCallback((tipId: string, prompt: string) => {
    setInputValue(prompt);
    setShowTips(false);
    setShowQuickActions(false);
    inputRef.current?.focus();
    toast.success("Tip applied to input");
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      toast.success("Recording stopped");
    } else {
      setIsRecording(true);
      toast.success("Recording started");
    }
  };

  return (
    <div className={cn('flex flex-col border-l transition-all duration-200 h-full relative', rightCollapsed ? 'w-16' : 'w-80')}
         style={{ backgroundColor: theme === 'dark' ? '#000000' : '#ffffff' }}>
      {/* Enhanced Header with AI Usage */}
      <div className="flex flex-col border-b transition-all duration-200 backdrop-blur-xl"
           style={{ backgroundColor: theme === 'dark' ? '#000000' : '#ffffff' }}>
        <div className="flex items-center justify-between p-4">
          {!rightCollapsed && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300 bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30">
                <Brain className="h-4 w-4 transition-colors text-primary animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm transition-colors text-foreground">AI Assistant</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs transition-colors text-muted-foreground">Chat & Help</span>
                  <Badge variant={aiUsage.remaining > 20 ? "secondary" : aiUsage.remaining > 5 ? "outline" : "destructive"} 
                         className="text-xs px-1.5 py-0.5 h-auto">
                    {aiUsage.remaining} left
                  </Badge>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            {!rightCollapsed && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSearchToggle}
                  className={`h-8 w-8 transition-all duration-200 backdrop-blur-sm border transform hover:scale-110 ${
                    theme === 'dark' 
                      ? 'hover:bg-primary/10 hover:text-primary border-gray-700/50' 
                      : 'hover:bg-primary/10 hover:text-primary border-gray-200/50'
                  }`}
                  title="Search conversations"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNewChat}
                  className={`h-8 w-8 transition-all duration-200 backdrop-blur-sm border transform hover:scale-110 ${
                    theme === 'dark' 
                      ? 'hover:bg-primary/10 hover:text-primary border-gray-700/50' 
                      : 'hover:bg-primary/10 hover:text-primary border-gray-200/50'
                  }`}
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSidebarToggle}
              className={`h-8 w-8 transition-all duration-300 backdrop-blur-sm border transform hover:scale-105 ${
                theme === 'dark' 
                  ? 'hover:bg-primary/10 hover:text-primary border-gray-700/50' 
                  : 'hover:bg-primary/10 hover:text-primary border-gray-200/50'
              }`}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${
                rightCollapsed ? 'rotate-0' : 'rotate-180'
              }`} />
            </Button>
          </div>
        </div>
        
        {/* AI Usage Bar */}
        {!rightCollapsed && (
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">AI Usage Today</span>
              <span className="text-muted-foreground">{aiUsage.today}/100</span>
            </div>
            <Progress value={aiUsage.today} max={100} 
                     className={`h-1.5 ${aiUsage.today > 80 ? 'bg-red-200' : aiUsage.today > 50 ? 'bg-yellow-200' : 'bg-green-200'}`} />
          </div>
        )}
      </div>

      {/* Search Bar (when shown) */}
      {!rightCollapsed && showSearch && (
        <div className={`px-4 py-3 border-b transition-all duration-300 ${
          theme === 'dark' ? 'border-gray-800 bg-black/10' : 'border-gray-200 bg-white/50'
        }`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`} />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className={`pl-10 pr-4 h-8 text-sm transition-all duration-200 backdrop-blur-sm border ${
                theme === 'dark' 
                  ? 'bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500 focus:border-primary/50' 
                  : 'bg-white/50 border-gray-200/50 placeholder-gray-500 focus:border-primary/50'
              }`}
            />
          </div>
        </div>
      )}

      {/* Floating Tabs for Collapsed State - Top Aligned */}
      {rightCollapsed && (
        <div className="flex flex-col items-center gap-2 p-3 pt-4 h-full overflow-y-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFloatingTab('chat')}
            className={`h-8 w-8 transition-all duration-200 backdrop-blur-sm border transform hover:scale-105 p-1.5 ${
              theme === 'dark' 
                ? 'hover:bg-primary/10 hover:text-primary border-gray-700/50' 
                : 'hover:bg-white/20 border-gray-200/50'
            }`}
            title="Open Chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFloatingTab('history')}
            className={`h-8 w-8 transition-all duration-200 backdrop-blur-sm border transform hover:scale-105 p-1.5 ${
              theme === 'dark' 
                ? 'hover:bg-primary/10 hover:text-primary border-gray-700/50' 
                : 'hover:bg-white/20 border-gray-200/50'
            }`}
            title="Open History"
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Floating Panel */}
      {floatingTab && (
        <div className={`absolute left-full top-0 ml-2 w-80 h-96 rounded-lg border transition-all duration-200 backdrop-blur-xl z-50 ${
          theme === 'dark' 
            ? 'bg-black/90 border-gray-700/50' 
            : 'bg-white/90 border-gray-200/50'
        }`}>
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className={`font-semibold text-sm ${
              theme === 'dark' ? 'text-white' : 'text-foreground'
            }`}>
              {floatingTab === 'chat' && 'Chat'}
              {floatingTab === 'tools' && 'Tools'}
              {floatingTab === 'history' && 'History'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFloatingTab(null)}
              className={`h-6 w-6 ${
                theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100/50'
              }`}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {floatingTab === 'chat' && (
              <div className="space-y-4">
                <div className={`p-3 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 border-gray-700/50' 
                    : 'bg-gray-50/50 border-gray-200/50'
                }`}>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>Chat interface will appear here...</p>
                </div>
              </div>
            )}
            {floatingTab === 'history' && (
              <div className="space-y-4">
                <div className={`p-3 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-800/50 border-gray-700/50' 
                    : 'bg-gray-50/50 border-gray-200/50'
                }`}>
                  <h4 className={`font-medium text-sm mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>Chat History</h4>
                  <div className="space-y-2">
                    <div className={`p-2 rounded border ${
                      theme === 'dark' 
                        ? 'bg-gray-900/50 border-gray-700/50' 
                        : 'bg-white/50 border-gray-200/50'
                    }`}>
                      <p className={`text-xs ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>No chat history yet...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {!rightCollapsed && (
        <>
          {/* Chat & History Tab Navigation */}
          <div className={`flex p-3 gap-1.5 border-b transition-all duration-200 backdrop-blur-sm ${
            theme === 'dark' ? 'border-gray-800 bg-black/10' : 'border-gray-200 bg-white/5'
          }`}>
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 gap-1.5 h-8 p-1.5 transition-all duration-200 ${
                activeTab === 'chat' 
                  ? theme === 'dark' 
                    ? 'bg-primary/20 text-primary border-primary/30 backdrop-blur-sm' 
                    : 'bg-primary/10 text-primary border-primary/30 backdrop-blur-sm'
                  : theme === 'dark'
                    ? 'hover:bg-primary/10 hover:text-primary'
                    : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">Chat</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className={`w-8 gap-1.5 transition-all duration-200 p-1.5 ${
                theme === 'dark'
                  ? 'hover:bg-primary/10 hover:text-primary'
                  : 'hover:bg-primary/10 hover:text-primary'
              }`}
              title="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant={activeTab === 'history' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('history')}
              className={`flex-1 gap-1.5 h-8 p-1.5 transition-all duration-200 ${
                activeTab === 'history' 
                  ? theme === 'dark' 
                    ? 'bg-primary/20 text-primary border-primary/30 backdrop-blur-sm' 
                    : 'bg-primary/10 text-primary border-primary/30 backdrop-blur-sm'
                  : theme === 'dark'
                    ? 'hover:bg-primary/10 hover:text-primary'
                    : 'hover:bg-primary/10 hover:text-primary'
              }`}
            >
              <History className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-medium">History</span>
            </Button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <>
              {/* Chat Messages Area */}
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-4 py-8">
                    {/* Welcome Message */}
                    <div className="text-center space-y-6 mb-8">
                      <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto backdrop-blur-md border transition-all duration-300 ${
                        theme === 'dark' 
                          ? 'bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/20' 
                          : 'bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30 shadow-lg shadow-primary/10'
                      }`}>
                        <Brain className={`h-8 w-8 ${
                          theme === 'dark' ? 'text-primary' : 'text-primary'
                        }`} />
                      </div>
                      <div className="space-y-2">
                        <h3 className={`text-lg font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        }`}>AI Assistant</h3>
                        <p className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        }`}>Ask me anything about your document!</p>
                      </div>
                    </div>

                    {/* Suggestions Grid */}
                    <div className="w-full max-w-xs space-y-2">
                      <div className={`text-center text-xs font-medium ${
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      }`}>Try asking:</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {CHAT_SUGGESTIONS.map((suggestion) => (
                          <Button
                            key={suggestion.id}
                            variant="outline"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={`h-10 p-1.5 flex flex-col items-center justify-center gap-1 transition-all duration-200 backdrop-blur-sm border transform hover:scale-105 ${
                              theme === 'dark'
                                ? 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/40 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10'
                                : 'bg-white/30 border-gray-200/50 hover:bg-primary/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10'
                            }`}
                          >
                            <suggestion.icon className="h-3 w-3 flex-shrink-0" />
                            <div className={`text-xs font-medium text-center leading-tight ${
                              theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
                            }`}>{suggestion.title}</div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <AIChatBubble
                        key={message.id}
                        message={message}
                      />
                    ))}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Enhanced Input Area - Stuck to Bottom */}
              <div className={`p-4 border-t transition-colors ${
                theme === 'dark' ? 'border-gray-800' : 'border-border'
              }`}>
                <div className="space-y-3">
                  {/* File Attachments */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Paperclip className="h-4 w-4" />
                          <span>Attached files ({uploadedFiles.length})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedFiles([])}
                          className="text-sm h-6 px-3 text-destructive hover:bg-destructive/10"
                        >
                          Clear all
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-sm transition-all duration-200 hover:shadow-sm ${
                              theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-700/50'
                                : 'bg-gray-50/50 border-gray-200/50 text-gray-700 hover:bg-white/80'
                            }`}
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{file.name}</div>
                              {file.size && (
                                <div className="text-muted-foreground text-xs">
                                  {(file.size / 1024).toFixed(1)} KB
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(file.id)}
                              className="h-6 w-6 hover:bg-destructive/10 text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Input Controls with Focus Effects */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          debouncedInputHandler(e.target.value);
                          setIsTyping(e.target.value.length > 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          } else if (e.key === 'Enter' && e.shiftKey) {
                            // Allow new line
                          } else if (e.key === 'Escape') {
                            setInputValue('');
                            inputRef.current?.blur();
                          }
                        }}
                        onFocus={handleInputFocus}
                        onBlur={handleInputBlur}
                        placeholder={aiUsage.remaining <= 0 ? "AI usage limit reached" : "Ask AI anything..."}
                        disabled={aiUsage.remaining <= 0}
                        className={`pr-28 resize-none transition-all duration-300 backdrop-blur-sm border transform h-10 ${
                          theme === 'dark' 
                            ? 'bg-gray-900/50 border-gray-700/50 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-gray-800/50 focus:scale-[1.02]' 
                            : 'bg-white/50 border-gray-200/50 placeholder-gray-500 focus:border-primary/50 focus:bg-white/70 focus:scale-[1.02]'
                        } ${inputFocused ? 'shadow-lg' : ''} ${
                          aiUsage.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        maxLength={10000}
                      />
                      
                      {/* Character count */}
                      {inputValue.length > 500 && (
                        <div className={`absolute right-2 top-1 text-xs ${
                          inputValue.length > 9000 ? 'text-red-500' : 'text-muted-foreground'
                        }`}>
                          {inputValue.length}/10000
                        </div>
                      )}
                      
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => document.getElementById('file-upload')?.click()}
                          disabled={aiUsage.remaining <= 0}
                          className={`h-7 w-7 transition-all duration-200 backdrop-blur-sm border transform hover:scale-110 ${
                            theme === 'dark' 
                              ? 'hover:bg-gray-700/50 text-gray-400 border-gray-600/30' 
                              : 'hover:bg-gray-100/50 text-gray-500 border-gray-200/30'
                          } ${aiUsage.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Attach file"
                        >
                          <Paperclip className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleRecording}
                          disabled={aiUsage.remaining <= 0}
                          className={`h-7 w-7 transition-all duration-200 backdrop-blur-sm border transform hover:scale-110 ${
                            isRecording ? 'text-red-500 animate-pulse' : ''
                          } ${
                            theme === 'dark' 
                              ? 'hover:bg-gray-700/50 text-gray-400 border-gray-600/30' 
                              : 'hover:bg-gray-100/50 text-gray-500 border-gray-200/30'
                          } ${aiUsage.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Voice input"
                        >
                          <Mic className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isGenerating || aiUsage.remaining <= 0}
                      className={`h-10 w-10 transition-all duration-200 backdrop-blur-sm border transform hover:scale-105 ${
                        theme === 'dark'
                          ? 'bg-primary/20 border-primary/30 hover:bg-primary/30 text-primary hover:shadow-lg hover:shadow-primary/20'
                          : 'bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary hover:shadow-lg hover:shadow-primary/10'
                      } ${inputValue.trim() && !isGenerating && aiUsage.remaining > 0 ? 'animate-pulse' : ''} ${
                        aiUsage.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      title={aiUsage.remaining <= 0 ? "AI usage limit reached" : "Send message"}
                    >
                      {isGenerating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Typing indicator inside input */}
                  {isGenerating && (
                    <div className="absolute right-12 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                      <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  )}

                  {/* Context indicator */}
                  {documentContext && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Document context available</span>
                    </div>
                  )}

                  {/* Hidden File Upload */}
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".txt,.md,.doc,.docx,.pdf"
                  />
                </div>
              </div>
            </>
          )}

          {/* Enhanced Tools Tab */}
          {activeTab === 'tools' && (
            <div className="flex-1 p-4">
              <div className="space-y-6">
                {/* Writing Tools with Progress */}
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Pencil className="h-4 w-4" />
                    Writing Tools
                    <Badge variant="outline" className="text-xs ml-auto">
                      {aiUsage.remaining} uses left
                    </Badge>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(ACTION_ICONS).map(([action, Icon]) => {
                      const progress = actionProgress[action] || 0;
                      const isDisabled = aiUsage.remaining <= 0;
                      return (
                        <div key={action} className="relative">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAction(action)}
                            disabled={isDisabled || progress > 0}
                            className={`h-12 text-xs gap-2 hover:bg-primary/5 hover:border-primary/20 flex-col items-start relative overflow-hidden transition-all duration-200 ${
                              isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                            } ${progress > 0 ? 'bg-primary/5 border-primary/30' : ''}`}
                          >
                            {progress > 0 && (
                              <div className="absolute inset-0 bg-primary/10">
                                <Progress value={progress} className="h-full w-full" />
                              </div>
                            )}
                            <div className="relative z-10 flex items-center gap-2 w-full">
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <div className="text-left flex-1 min-w-0">
                                <div className="font-medium truncate">{action.charAt(0).toUpperCase() + action.slice(1)}</div>
                                <div className="text-muted-foreground text-xs truncate">
                                  {action === 'generate' && 'Create new content'}
                                  {action === 'formal' && 'Make formal tone'}
                                  {action === 'grammar' && 'Fix grammar issues'}
                                  {action === 'condense' && 'Make shorter'}
                                  {action === 'expand' && 'Make longer'}
                                  {action === 'summarize' && 'Create summary'}
                                </div>
                              </div>
                              {progress > 0 && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            </div>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Document Types */}
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Document Wizards
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(WIZARD_TYPES).map(([type, config]) => {
                      const Icon = WIZARD_ICONS[type];
                      return (
                        <Button
                          key={type}
                          variant="outline"
                          onClick={() => startWizard(type as WizardType)}
                          className="h-12 text-xs gap-2 hover:bg-primary/5 hover:border-primary/20 flex-col items-start transition-all duration-200"
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <div className="text-left flex-1 min-w-0">
                            <div className="font-medium truncate">{config.label}</div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Actions */}
                {recentActions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Recent Actions
                    </h4>
                    <div className="space-y-1.5">
                      {recentActions.slice(0, 5).map((action) => (
                        <div key={action.id} 
                             className={`flex items-center gap-2 p-2 rounded-lg border text-xs ${
                               theme === 'dark' 
                                 ? 'bg-gray-800/50 border-gray-700/50 text-gray-300' 
                                 : 'bg-gray-50/50 border-gray-200/50 text-gray-700'
                             }`}>
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <span className="flex-1 truncate">{action.action}</span>
                          <span className="text-muted-foreground">
                            {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formatting Tools */}
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Bold className="h-4 w-4" />
                    Quick Formatting
                  </h4>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { icon: Bold, label: 'Bold', action: 'bold' },
                      { icon: Italic, label: 'Italic', action: 'italic' },
                      { icon: Underline, label: 'Underline', action: 'underline' },
                      { icon: AlignLeft, label: 'Left', action: 'alignLeft' },
                      { icon: AlignCenter, label: 'Center', action: 'alignCenter' },
                      { icon: AlignRight, label: 'Right', action: 'alignRight' },
                      { icon: List, label: 'List', action: 'bulletList' },
                      { icon: ListOrdered, label: 'Numbered', action: 'numberedList' },
                    ].map(({ icon: Icon, label, action }) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Dispatch formatting action to main editor
                          const event = new CustomEvent('formatAction', { detail: { action } });
                          window.dispatchEvent(event);
                          toast.success(`${label} applied`);
                        }}
                        className="h-8 w-8 p-0 hover:bg-primary/5 hover:border-primary/20 transition-all duration-200 hover:scale-105"
                        title={label}
                      >
                        <Icon className="h-3 w-3" />
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced History Tab */}
          {activeTab === 'history' && (
            <div className="flex-1 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Conversation History
                    {messages.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {messages.length} messages
                      </Badge>
                    )}
                  </h4>
                  <div className="flex gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const historyText = messages.map(m => 
                          `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
                        ).join('\n\n');
                        navigator.clipboard.writeText(historyText);
                        toast.success('Conversation copied to clipboard');
                      }}
                      className="text-xs h-7 px-2"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearMessages} 
                      className="text-xs h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>
                
                {/* Search within history */}
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 ${
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversation..."
                    className={`pl-9 pr-4 h-8 text-xs transition-all duration-200 backdrop-blur-sm border ${
                      theme === 'dark' 
                        ? 'bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500 focus:border-primary/50' 
                        : 'bg-white/50 border-gray-200/50 placeholder-gray-500 focus:border-primary/50'
                    }`}
                  />
                </div>
                
                {messages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border transition-all duration-300 ${
                      theme === 'dark' 
                        ? 'bg-gradient-to-br from-gray-800/50 to-gray-700/30 border-gray-600/50' 
                        : 'bg-gradient-to-br from-gray-100/50 to-gray-50/30 border-gray-200/50'
                    }`}>
                      <History className={`h-8 w-8 ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`} />
                    </div>
                    <h3 className={`text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    }`}>No conversation history</h3>
                    <p className={`text-xs ${
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    }`}>Start a conversation to see your history here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {messages
                        .filter(message => 
                          !searchQuery || 
                          message.content.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((message, index) => (
                          <div key={message.id} 
                               className={`group relative p-3 rounded-xl border transition-all duration-200 hover:shadow-md ${
                                 theme === 'dark' 
                                   ? 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/40' 
                                   : 'bg-gray-50/50 border-gray-200/50 hover:bg-white/80'
                               }`}>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                  message.role === 'user' 
                                    ? 'bg-primary/20 text-primary border border-primary/30' 
                                    : 'bg-gradient-to-br from-primary/20 to-primary/10 text-primary border border-primary/30'
                                }`}>
                                  {message.role === 'user' ? 'Y' : 'AI'}
                                </div>
                                <span className="text-xs font-medium">
                                  {message.role === 'user' ? 'You' : 'AI Assistant'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleCopyMessage(message.content, message.id)}
                                  className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                                    theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'
                                  }`}
                                >
                                  {copiedMessageId === message.id ? (
                                    <Check className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            <p className={`text-xs leading-relaxed line-clamp-3 ${
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {message.content}
                            </p>
                            {message.content.length > 200 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Expand message or show full content
                                  toast.info('Full message view coming soon!');
                                }}
                                className="text-xs mt-2 h-6 px-2 text-primary hover:bg-primary/5"
                              >
                                Read more
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}

          </>
      )}
    </div>
  );
}
