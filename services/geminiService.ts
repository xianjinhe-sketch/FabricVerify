import { GoogleGenAI, Type } from "@google/genai";
import { RollData } from "../types";

const parseJsonClean = (text: string) => {
  try {
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return [];
  } catch (e) {
    console.error("JSON Parse Error", e);
    return [];
  }
};

export const parsePackingList = async (base64Images: string[]): Promise<Partial<RollData>[]> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) {
    console.error("API Key missing");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

  // Build image parts from all uploaded photos
  const imageParts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg' as const,
      data: img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          ...imageParts,
          {
            text: `Analyze these image(s) of a fabric packing list/roll list. 
            Extract the following information for each roll found in the table(s): 
            Roll Number, Dye Lot Number, Length, Weight, and Width (in inches).
            If width is not specified per roll, look for a common fabric width in the header area.
            Return ONLY a JSON array of objects. Keys: "rollNo", "dyeLot", "length", "weight", "width".
            Ensure numerical values are numbers. If width is not found, use 0.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              rollNo: { type: Type.STRING },
              dyeLot: { type: Type.STRING },
              length: { type: Type.NUMBER },
              weight: { type: Type.NUMBER },
              width: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      console.warn("Empty response from Gemini");
      return [];
    }

    const parsed = typeof text === 'string' ? JSON.parse(text) : text;

    return parsed.map((item: any) => ({
      rollNo: String(item.rollNo || ''),
      dyeLot: String(item.dyeLot || ''),
      length: Number(item.length || 0),
      weight: Number(item.weight || 0),
      width: Number(item.width) > 0 ? Number(item.width) : 58, // Default 58 if not found
      status: 'PENDING',
      defects: [],
      comments: '',
      isSelected: false,
      id: Math.random().toString(36).substr(2, 9)
    }));

  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};

export const parseWeight = async (base64Image: string): Promise<number | null> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: "Read the fabric weight number from this image (e.g. GSM or oz/yd). Return only the number." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weight: { type: Type.NUMBER }
          }
        }
      }
    });

    const parsed = typeof response.text === 'string' ? JSON.parse(response.text) : response.text;
    return parsed.weight || null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const analyzeLighting = async (base64Image: string): Promise<{ lux: number, status: 'PASS' | 'FAIL' | 'WARNING', message: string }> => {
  if (!import.meta.env.VITE_GEMINI_API_KEY) return { lux: 0, status: 'FAIL', message: 'API Key missing' };
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          {
            text: `Analyze the lighting condition in this fabric inspection environment. 
          Estimate the illuminance (Lux) based on overall brightness, shadows, and clarity. 
          Usually, textile inspection requires >1000 Lux.
          Return a JSON object with: 
          "lux": estimated number, 
          "status": "PASS" if >1000, "WARNING" if 500-1000, "FAIL" if <500,
          "message": a brief description of the lighting quality.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lux: { type: Type.NUMBER },
            status: { type: Type.STRING },
            message: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (e) {
    console.error(e);
    return { lux: 0, status: 'FAIL', message: 'Analysis failed' };
  }
};
