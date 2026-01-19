import { create } from 'zustand';
import { buildEnhancedSystemPrompt, postProcessAIResponse } from '@/config/papermorph-ai';
import { htmlToReadableText, isHTMLContent, sanitizeHTML } from '@/utils/htmlFormatter';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  applyContent?: string; // The content to apply to the document
  isError?: boolean; // Flag for error messages
}

export type WizardType = 'letter' | 'report' | 'proposal' | 'essay' | null;

export interface WizardStep {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  options?: string[];
  placeholder?: string;
  required?: boolean;
}

interface AISidebarState {
  isOpen: boolean;
  mode: 'chat' | 'wizard';
  messages: Message[];
  isGenerating: boolean;
  
  // Wizard state
  wizardType: WizardType;
  wizardStep: number;
  wizardData: Record<string, string>;
  
  // Actions
  toggle: () => void;
  setMode: (mode: 'chat' | 'wizard') => void;
  sendMessage: (content: string, documentContext?: string) => Promise<void>;
  clearMessages: () => void;
  
  // AI Actions
  generateSection: () => Promise<void>;
  rewriteFormal: (text: string) => Promise<string>;
  fixGrammar: (text: string) => Promise<string>;
  condense: (text: string) => Promise<string>;
  expand: (text: string) => Promise<string>;
  summarize: (text: string) => Promise<string>;
  
  // Wizard Actions
  startWizard: (type: WizardType) => void;
  setWizardData: (key: string, value: string) => void;
  nextWizardStep: () => void;
  prevWizardStep: () => void;
  finishWizard: () => Promise<void>;
  cancelWizard: () => void;
  // Pending intent (used for multi-step flows like email composition)
  pendingIntent: null | {
    type: 'email';
    assistantMessageId: string;
  };
  setPendingIntent: (intent: null | { type: 'email'; assistantMessageId: string }) => void;
}

const WIZARD_STEPS: Record<string, WizardStep[]> = {
  letter: [
    { id: 'recipient', label: 'Recipient Name', type: 'text', placeholder: 'John Smith', required: true },
    { id: 'recipientTitle', label: 'Recipient Title', type: 'text', placeholder: 'HR Manager' },
    { id: 'purpose', label: 'Purpose of Letter', type: 'select', options: ['Job Application', 'Resignation', 'Recommendation', 'Complaint', 'Thank You', 'Other'], required: true },
    { id: 'keyPoints', label: 'Key Points to Include', type: 'textarea', placeholder: 'List the main points you want to cover...' },
    { id: 'tone', label: 'Tone', type: 'select', options: ['Formal', 'Semi-formal', 'Friendly', 'Professional'] },
  ],
  report: [
    { id: 'title', label: 'Report Title', type: 'text', placeholder: 'Q1 Sales Report', required: true },
    { id: 'reportType', label: 'Report Type', type: 'select', options: ['Progress Report', 'Research Report', 'Annual Report', 'Incident Report', 'Technical Report'], required: true },
    { id: 'period', label: 'Reporting Period', type: 'text', placeholder: 'January - March 2025' },
    { id: 'keyFindings', label: 'Key Findings', type: 'textarea', placeholder: 'Summarize main findings...' },
    { id: 'recommendations', label: 'Recommendations', type: 'textarea', placeholder: 'List your recommendations...' },
  ],
  proposal: [
    { id: 'projectName', label: 'Project Name', type: 'text', placeholder: 'Website Redesign', required: true },
    { id: 'client', label: 'Client/Recipient', type: 'text', placeholder: 'ABC Corporation' },
    { id: 'objective', label: 'Project Objective', type: 'textarea', placeholder: 'What do you aim to achieve?', required: true },
    { id: 'budget', label: 'Budget Range', type: 'text', placeholder: '$10,000 - $15,000' },
    { id: 'timeline', label: 'Timeline', type: 'text', placeholder: '3 months' },
    { id: 'deliverables', label: 'Key Deliverables', type: 'textarea', placeholder: 'List main deliverables...' },
  ],
  essay: [
    { id: 'topic', label: 'Essay Topic', type: 'text', placeholder: 'Climate Change Impact', required: true },
    { id: 'essayType', label: 'Essay Type', type: 'select', options: ['Argumentative', 'Expository', 'Narrative', 'Descriptive', 'Compare/Contrast'], required: true },
    { id: 'thesis', label: 'Thesis Statement', type: 'textarea', placeholder: 'Your main argument or point...' },
    { id: 'wordCount', label: 'Target Word Count', type: 'text', placeholder: '1500' },
    { id: 'sources', label: 'Key Sources/References', type: 'textarea', placeholder: 'List your sources...' },
  ],
};

// Helper function to call AI edge function
async function callAIEdgeFunction(action: string, content: string, options?: {
  context?: string;
  targetLanguage?: string;
  tone?: string;
  style?: string;
}): Promise<{ result: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        action,
        content,
        context: options?.context,
        targetLanguage: options?.targetLanguage,
        tone: options?.tone,
        style: options?.style,
      },
    });

    if (error) {
      console.error('AI edge function error:', error);
      return { result: '', error: error.message || 'Failed to call AI service' };
    }

    if (data?.error) {
      return { result: '', error: data.error };
    }

    return { result: data?.result || '' };
  } catch (err) {
    console.error('AI call error:', err);
    return { result: '', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export const useAISidebar = create<AISidebarState>((set, get) => ({
  isOpen: true,
  mode: 'chat',
  messages: [],
  isGenerating: false,
  wizardType: null,
  wizardStep: 0,
  wizardData: {},
  pendingIntent: null,

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),

  setMode: (mode) => set({ mode }),

  setPendingIntent: (intent) => set({ pendingIntent: intent }),

  sendMessage: async (content, documentContext) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    // Add user message to the chat
    set((state) => ({
      messages: [...state.messages, userMessage],
      isGenerating: true,
    }));

    // Create assistant message with loading state
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    // Add empty assistant message to start
    set((state) => ({
      messages: [...state.messages, assistantMessage],
    }));

    try {
      // Build enhanced context using PaperMorph AI training
      const enhancedContext = documentContext 
        ? buildEnhancedSystemPrompt(documentContext, content).substring(0, 500)
        : undefined;

      const { result, error } = await callAIEdgeFunction('chat', content, {
        context: enhancedContext,
      });

      if (error) {
        throw new Error(error);
      }

      // Process the response
      const processedContent = postProcessAIResponse(result, 'general');
      
      // Prepare display and apply content
      let displayContent = processedContent;
      let htmlApplyContent = processedContent;

      if (isHTMLContent(processedContent)) {
        displayContent = htmlToReadableText(processedContent);
        htmlApplyContent = sanitizeHTML(processedContent);
      }
      
      // Update the assistant message
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: displayContent, applyContent: htmlApplyContent }
            : msg
        ),
      }));
    } catch (error) {
      console.error('Error calling AI:', error);
      
      // Better error handling with specific error types
      let errorMessage = 'Sorry, I encountered an error while processing your request.';
      const errMsg = error instanceof Error ? error.message : '';
      
      if (errMsg.includes('sign in') || errMsg.includes('401') || errMsg.includes('unauthorized')) {
        errorMessage = 'Please sign in to use AI features.';
      } else if (errMsg.includes('429') || errMsg.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (errMsg.includes('402') || errMsg.includes('payment')) {
        errorMessage = 'AI usage limit reached. Please upgrade your plan.';
      } else if (errMsg.includes('500') || errMsg.includes('unavailable')) {
        errorMessage = 'AI service temporarily unavailable. Please try again.';
      } else if (error instanceof TypeError) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      // Update with specific error message
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: errorMessage, isError: true } 
            : msg
        ),
      }));
    } finally {
      set({ isGenerating: false });
    }
  },

  clearMessages: () => set({ messages: [] }),

  generateSection: async () => {
    set({ isGenerating: true });
    await new Promise((resolve) => setTimeout(resolve, 500));
    set({ isGenerating: false });
  },

  rewriteFormal: async (text: string) => {
    set({ isGenerating: true });
    try {
      const { result, error } = await callAIEdgeFunction('rewrite', text, { tone: 'formal' });
      if (error) throw new Error(error);
      return result;
    } finally {
      set({ isGenerating: false });
    }
  },

  fixGrammar: async (text: string) => {
    set({ isGenerating: true });
    try {
      const { result, error } = await callAIEdgeFunction('grammar', text);
      if (error) throw new Error(error);
      return result;
    } finally {
      set({ isGenerating: false });
    }
  },

  condense: async (text: string) => {
    set({ isGenerating: true });
    try {
      const { result, error } = await callAIEdgeFunction('summarize', text);
      if (error) throw new Error(error);
      return result;
    } finally {
      set({ isGenerating: false });
    }
  },

  expand: async (text: string) => {
    set({ isGenerating: true });
    try {
      const { result, error } = await callAIEdgeFunction('expand', text);
      if (error) throw new Error(error);
      return result;
    } finally {
      set({ isGenerating: false });
    }
  },

  summarize: async (text: string) => {
    set({ isGenerating: true });
    try {
      const { result, error } = await callAIEdgeFunction('summarize', text);
      if (error) throw new Error(error);
      return result;
    } finally {
      set({ isGenerating: false });
    }
  },

  startWizard: (type) => set({ wizardType: type, wizardStep: 0, wizardData: {}, mode: 'wizard' }),

  setWizardData: (key, value) =>
    set((state) => ({ wizardData: { ...state.wizardData, [key]: value } })),

  nextWizardStep: () => {
    const { wizardType, wizardStep } = get();
    if (wizardType && wizardStep < WIZARD_STEPS[wizardType].length - 1) {
      set({ wizardStep: wizardStep + 1 });
    }
  },

  prevWizardStep: () => {
    const { wizardStep } = get();
    if (wizardStep > 0) {
      set({ wizardStep: wizardStep - 1 });
    }
  },

  finishWizard: async () => {
    const { wizardType, wizardData } = get();
    if (!wizardType) return;

    set({ isGenerating: true });

    try {
      // Build prompt based on wizard type
      let prompt = '';
      switch (wizardType) {
        case 'letter':
          prompt = `Write a ${wizardData.tone || 'formal'} letter to ${wizardData.recipient}${wizardData.recipientTitle ? ` (${wizardData.recipientTitle})` : ''} for the purpose of ${wizardData.purpose}.${wizardData.keyPoints ? ` Key points to include: ${wizardData.keyPoints}` : ''}`;
          break;
        case 'report':
          prompt = `Write a ${wizardData.reportType} titled "${wizardData.title}"${wizardData.period ? ` for the period ${wizardData.period}` : ''}.${wizardData.keyFindings ? ` Key findings: ${wizardData.keyFindings}` : ''}${wizardData.recommendations ? ` Recommendations: ${wizardData.recommendations}` : ''}`;
          break;
        case 'proposal':
          prompt = `Write a project proposal for "${wizardData.projectName}"${wizardData.client ? ` for ${wizardData.client}` : ''}. Objective: ${wizardData.objective}${wizardData.budget ? `. Budget: ${wizardData.budget}` : ''}${wizardData.timeline ? `. Timeline: ${wizardData.timeline}` : ''}${wizardData.deliverables ? `. Deliverables: ${wizardData.deliverables}` : ''}`;
          break;
        case 'essay':
          prompt = `Write a ${wizardData.essayType} essay on "${wizardData.topic}"${wizardData.thesis ? `. Thesis: ${wizardData.thesis}` : ''}${wizardData.wordCount ? `. Target word count: ${wizardData.wordCount}` : ''}${wizardData.sources ? `. Sources to reference: ${wizardData.sources}` : ''}`;
          break;
      }

      const { result, error } = await callAIEdgeFunction('chat', prompt);
      
      if (error) {
        throw new Error(error);
      }

      // Add the generated content as a message
      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: result,
        timestamp: new Date(),
        applyContent: result,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        wizardType: null,
        wizardStep: 0,
        wizardData: {},
        mode: 'chat',
      }));
    } catch (error) {
      console.error('Error in wizard:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error generating your document. Please try again.',
        timestamp: new Date(),
        isError: true,
      };
      set((state) => ({
        messages: [...state.messages, errorMessage],
      }));
    } finally {
      set({ isGenerating: false });
    }
  },

  cancelWizard: () =>
    set({
      wizardType: null,
      wizardStep: 0,
      wizardData: {},
      mode: 'chat',
    }),
}));

// Export wizard steps for use in components
export { WIZARD_STEPS };
