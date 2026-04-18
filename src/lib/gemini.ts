import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export const SYSTEM_INSTRUCTION = `
You are TradeMate AI, a smart business assistant for market traders in Nigeria.
Your goal is to help traders track sales, inventory, and debts using natural language, primarily Nigerian Pidgin.

USER CONTEXT:
- Target users: Market traders, kiosk owners in Akwa Ibom/Nigeria.
- Language: Default to Nigerian Pidgin, also support English.
- Tone: Helpful, machine-like but friendly ("senior man" vibes), cryptic yet clear.

OUTPUT FORMAT:
You MUST always return a structured JSON response.

{
  "intent": "record_sale" | "record_debt" | "debt_payment" | "query_sales" | "query_inventory" | "unknown",
  "entities": {
    "item": string | null,
    "quantity": number | null,
    "price": number | null,
    "customer": string | null,
    "amount": number | null
  },
  "action": "CREATE" | "UPDATE" | "DELETE" | "QUERY" | "NONE",
  "response": string (Respond in the same language as the user, primarily Pidgin)
}

GUIDELINES:
- If someone says "I sell 2 bread 500 each", intent is "record_sale", item is "bread", quantity is 2, price is 500, response is like "I don record am. 2 bread for 1000 naira."
- If someone says "Mary owe me 5k", intent is "record_debt", customer is "Mary", amount is 5000, response is like "Mary owe you 5k. I don put am for book."
- If someone says "How much I make today?", intent is "query_sales", response should ask them to check the summary or provide a placeholder if data isn't provided.
- ALWAYS respond in Pidgin if the user uses Pidgin.
- Keep responses short and snappy.
`;

export async function processMessage(input: string | { data: string, mimeType: string }, history: any[] = []) {
  const isAudio = typeof input !== 'string';
  const parts: any[] = [];
  
  if (isAudio) {
    parts.push({
      inlineData: {
        data: input.data,
        mimeType: input.mimeType
      }
    });
    parts.push({ text: "Process this voice note from the trader. Extract intent and entities as specified." });
  } else {
    parts.push({ text: input });
  }

  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history,
      { role: "user", parts }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: { type: Type.STRING },
          entities: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING, nullable: true },
              quantity: { type: Type.NUMBER, nullable: true },
              price: { type: Type.NUMBER, nullable: true },
              customer: { type: Type.STRING, nullable: true },
              amount: { type: Type.NUMBER, nullable: true }
            }
          },
          action: { type: Type.STRING },
          response: { type: Type.STRING }
        },
        required: ["intent", "entities", "action", "response"]
      }
    }
  });

  const result = await model;
  let text = result.text || "{}";
  // Clean up markdown code blocks if the model included them
  if (text.includes("```json")) {
    text = text.split("```json")[1].split("```")[0];
  } else if (text.includes("```")) {
    text = text.split("```")[1].split("```")[0];
  }
  return JSON.parse(text.trim());
}
