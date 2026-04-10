import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: Request) {
  try {
    const { message, fileData, mimeType, mode } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    let systemInstruction = "";
    if (mode === 'food') {
      systemInstruction = `You are a Nutritionist. Analyze the food image. Output a JSON object: { "food_name": "...", "calories": 000, "macros": { "protein": "0g", "carbs": "0g", "fats": "0g" }, "health_tip": "..." }`;
    } else if (mode === 'gym') {
      systemInstruction = `You are a Gym Coach. Identify the exercise, rate form (1-10), and give corrections. Output Markdown. End with: SEARCH_QUERY: [Exercise Name] correct form`;
    } else if (mode === 'medical') {
      systemInstruction = `You are a Medical Assistant. Summarize the report and suggest 3 diet changes. Disclaimer: Not a doctor.`;
    } else {
      systemInstruction = `You are a health assistant.`;
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