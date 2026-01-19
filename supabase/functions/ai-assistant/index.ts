import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequest {
  action: 'chat' | 'rewrite' | 'summarize' | 'grammar' | 'translate' | 'expand' | 'complete';
  content: string;
  context?: string;
  targetLanguage?: string;
  tone?: string;
  style?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token and verify user
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.log('Auth error or no user:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Please sign in to use AI features' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AIRequest = await req.json();
    const { action, content, context, targetLanguage, tone, style } = body;

    if (!action || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt based on action
    let systemPrompt = '';
    let userPrompt = content;

    switch (action) {
      case 'chat':
        systemPrompt = `You are PaperMorph AI, an intelligent writing assistant for a document editor. You help users with their documents, answer questions about writing, and provide helpful suggestions. 

Your capabilities include:
- Writing letters, emails, reports, and various document types
- Providing formatting advice and structure suggestions
- Answering questions about grammar, style, and clarity
- Generating creative content when asked

Be concise, helpful, and professional. When asked to write documents, provide complete, well-formatted content that users can directly use.
${context ? `\nContext about the document the user is working on: ${context}` : ''}`;
        break;
      
      case 'rewrite':
        systemPrompt = `You are a professional editor. Rewrite the following text to improve clarity, flow, and engagement while maintaining the original meaning.${tone ? ` Use a ${tone} tone.` : ''}${style ? ` Write in a ${style} style.` : ''} Only return the rewritten text, no explanations or preamble.`;
        break;
      
      case 'summarize':
        systemPrompt = 'You are an expert summarizer. Create a clear, concise summary of the following text, capturing all key points. Only return the summary, no explanations or preamble.';
        break;
      
      case 'grammar':
        systemPrompt = 'You are a grammar expert. Check and correct any grammar, spelling, punctuation, or style issues in the following text. Return the corrected text only, no explanations or preamble.';
        break;
      
      case 'translate':
        systemPrompt = `You are a professional translator. Translate the following text to ${targetLanguage || 'English'}. Maintain the original tone and meaning. Only return the translated text, no explanations.`;
        break;
      
      case 'expand':
        systemPrompt = 'You are a creative writer. Expand and elaborate on the following text, adding more detail, examples, and depth while maintaining the original intent. Only return the expanded text, no explanations or preamble.';
        break;
      
      case 'complete':
        systemPrompt = 'You are an AI writing assistant. Complete the following text in a natural, coherent way that matches the style and context. Only return the completed portion that should be appended, not the original text.';
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log(`Processing ${action} request for user ${user.id}`);

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: action === 'grammar' ? 0.1 : 0.7,
        max_tokens: action === 'summarize' ? 500 : 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI usage limit reached. Please upgrade your plan.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // Log AI usage
    try {
      await supabaseClient.from('ai_usage').insert({
        user_id: user.id,
        action_type: action,
        tokens_used: tokensUsed,
        model: 'google/gemini-3-flash-preview',
      });
    } catch (logError) {
      console.warn('Failed to log AI usage:', logError);
    }

    console.log(`Successfully processed ${action} request, tokens used: ${tokensUsed}`);

    return new Response(
      JSON.stringify({ 
        result: aiResponse,
        tokensUsed,
        action 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
