import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30000 }
});

async function test() {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'hi'
    });
    console.log("Success gemini-2.5-flash:", response.text);
  } catch (err) {
      console.log("gemini-2.5-flash failed");
  }

  try {
    const response2 = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'hi'
    });
    console.log("Success gemini-2.0-flash:", response2.text);
  } catch (err) {
      console.log("gemini-2.0-flash failed");
  }

  try {
    const response3 = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'hi'
    });
    console.log("Success gemini-1.5-flash:", response3.text);
  } catch (err) {
      console.log("gemini-1.5-flash failed", err.message);
  }
}

test();
