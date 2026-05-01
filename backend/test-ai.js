import { GoogleGenAI } from '@google/genai';
import { lawyerAppTools } from './services/aiTools.js';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000 }
});

async function test() {
  try {
    const contents = [{ role: 'user', parts: [{ text: 'Who is the best lawyer?' }] }];
    const firstResult = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents,
      config: {
        systemInstruction: "You are the LawyerUp Assistant.",
        temperature: 0.4,
        tools: [{ functionDeclarations: lawyerAppTools }],
      },
    });
    console.log("Success:", firstResult.text || "No text");
  } catch (err) {
    console.error("SDK Error name:", err.name);
    console.error("SDK Error msg:", err.message);
    console.error("SDK Error details:", err);
  }
}

test();
