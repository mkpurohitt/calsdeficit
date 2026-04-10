import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// Gemini 2.5 Flash-Lite — ultra-low cost for chat responses
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

export async function POST(req: Request) {
  try {
    const { message, fileData, mimeType, mode } = await req.json();

    let systemInstruction = "";
    if (mode === 'food') {
      systemInstruction = `You are a Nutritionist AI. The user has uploaded a food photo and may provide additional details about it. Analyze the food image carefully. Output a JSON object: { "food_name": "...", "calories": 000, "macros": { "protein": "0g", "carbs": "0g", "fats": "0g" }, "health_tip": "..." }. If the user provides extra context (e.g. portion size, ingredients), use it to refine your analysis.`;
    } else if (mode === 'gym') {
      systemInstruction = `You are a Gym Coach AI. The user has uploaded a workout/exercise video and may provide additional details about their exercise. Identify the exercise, rate their form (1-10), and give specific corrections. Output Markdown. End with: SEARCH_QUERY: [Exercise Name] correct form. If the user provides extra context (e.g. how long they've been training, any injuries), factor it into your advice.`;
    } else {
      systemInstruction = `You are a friendly health and fitness assistant. Help users with diet questions, workout advice, and general wellness tips. Be concise and practical.`;
    }

    const parts: any[] = [{ text: systemInstruction }];
    if (message) parts.push({ text: `User: ${message}` });

    if (fileData) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileData.split(",")[1]
        }
      });
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const responseText = result.response.text();
    
    return NextResponse.json({ success: true, data: responseText });

  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}