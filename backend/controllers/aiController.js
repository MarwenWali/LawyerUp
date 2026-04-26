import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '../config/supabase.js';

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000 }
});

export async function askRAG(req, res) {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // 1. Vectorize the user's question
    const embedResult = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: message,
      config: { outputDimensionality: 768 },
    });
    const query_embedding = embedResult.embeddings[0].values;

    // 2. Query Supabase for relevant context
    const { data: docs, error } = await supabaseAdmin.rpc('match_legal_docs', {
      query_embedding,
      match_threshold: 0.5,
      match_count: 3,
    });

    if (error) {
      throw new Error(`Supabase RPC Error: ${error.message}`);
    }

    let contextText = '';
    if (docs && docs.length > 0) {
      contextText = docs.map((doc) => {
        const articleName = doc.metadata?.article_name || 'Unknown Article';
        const source = doc.metadata?.source || 'Unknown Source';
        return `[Source: ${source} | Article: ${articleName}]\n${doc.content}`;
      }).join('\n\n');
    }

    // 3. Inference with Gemini 1.5 Flash
    const systemInstruction = `You are the LawyerUp AI Assistant, an expert in Tunisian Law. Use the provided Arabic legal context to answer the user's question accurately.
DETECTION: Identify the language the user is speaking (Tunisian Derja, Standard Arabic, French, or English) and respond ONLY in that exact language. If the answer isn't in the context, inform them politely in their language.

CITATION: At the end of your response, you MUST cite the article_name from the metadata provided in the context so the user knows which law is being cited.

Context:
${contextText}`;

    const chatResult = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({
      response: chatResult.text,
      sources: docs ? docs.map((d) => d.metadata) : [],
    });
  } catch (error) {
    console.log('AI Error:', error);
    console.error('[RAG Controller] Error:', error);
    res.status(500).json({
      error: 'Failed to process AI request',
      details: error.message,
    });
  }
}
