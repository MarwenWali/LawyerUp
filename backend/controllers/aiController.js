import { GoogleGenAI } from '@google/genai';
import { supabaseAdmin } from '../config/supabase.js';
import { lawyerAppTools, getLawyers, sendMessageToLawyer } from '../services/aiTools.js';

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
    const systemInstruction = `You are the LawyerUp Assistant. You have access to the app's database.

Lawyer Recommendations: If a user asks for a lawyer, use getLawyers. Only recommend lawyers found in the database.

Messaging: If a user wants to contact a lawyer, FIRST draft a professional message and ask the user: 'Here is the draft: [message]. Should I send it?'.

Confirmation: ONLY call sendMessageToLawyer if the user explicitly confirms (e.g., 'Yes', 'Send it').

Tone: Be professional but helpful. Speak in Tunisian Derja if the user does.

Context:
${contextText}`;

    const chatResult = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
        tools: [{ functionDeclarations: lawyerAppTools }],
      },
    });

    let finalResponseText = chatResult.text;

    if (chatResult.functionCalls && chatResult.functionCalls.length > 0) {
      const call = chatResult.functionCalls[0];
      let apiResponse;

      if (call.name === 'getLawyers') {
        apiResponse = await getLawyers(call.args.specialty, call.args.minRating);
      } else if (call.name === 'sendMessageToLawyer') {
        apiResponse = await sendMessageToLawyer(call.args.lawyerId, call.args.messageBody, req.user?.id);
      }

      const secondResult = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ functionCall: call }] },
          { role: 'user', parts: [{ functionResponse: { name: call.name, response: apiResponse } }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
          tools: [{ functionDeclarations: lawyerAppTools }]
        },
      });

      finalResponseText = secondResult.text;
    }

    res.json({
      response: finalResponseText,
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
