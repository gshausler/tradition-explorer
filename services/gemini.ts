
import { GoogleGenAI, Type } from "@google/genai";
import { Tradition, ComparisonResult, SectionKey } from "../types";

export const generateComparison = async (
  question: string,
  traditions: Tradition[],
  systemPrompt: string
): Promise<ComparisonResult> => {
  // Always initialize right before use with the API key from process.env to ensure fresh credentials
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Define the schema for the JSON response
  const traditionSchemaProperties = traditions.reduce((acc, trad) => {
    acc[trad] = { type: Type.STRING };
    return acc;
  }, {} as any);

  const sectionSchema = {
    type: Type.OBJECT,
    properties: traditionSchemaProperties,
    required: traditions,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze the following scholarly question: "${question}" from the distinct perspectives of: ${traditions.join(', ')}. Provide a deep, structured comparison.`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: sectionSchema,
            comparison: sectionSchema,
            discussion: sectionSchema,
            "deep dive": sectionSchema,
            "quotes and references": sectionSchema,
            conclusion: sectionSchema,
          },
          required: ["summary", "comparison", "discussion", "deep dive", "quotes and references", "conclusion"],
        },
      },
    });

    const rawJson = response.text || "{}";
    const parsedData = JSON.parse(rawJson);

    return {
      id: crypto.randomUUID(),
      question,
      selectedTraditions: traditions,
      timestamp: Date.now(),
      data: parsedData,
    };
  } catch (err) {
    console.error("Gemini API Error details:", err);
    throw err;
  }
};
