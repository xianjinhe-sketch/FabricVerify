import { RollData } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

/**
 * 集中处理 Gemini 请求，直接在前端调用
 */
async function callGemini(contents: any[], schema?: any) {
  const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const config: any = {
    responseMimeType: "application/json",
  };

  if (schema) {
    config.responseSchema = schema;
  }

  // The contents passed from the functions are in the format [{ role: 'user', parts: [...] }]
  // We need to extract the parts for generateContent
  const parts = contents[0].parts;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config,
    });

    if (!response.text) {
      throw new Error("Empty response from Gemini");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    const errorString = typeof error === 'string' ? error : JSON.stringify(error) + (error.message || '');
    
    if (errorString.includes("leaked") || errorString.includes("PERMISSION_DENIED") || errorString.includes("API key not valid")) {
      throw new Error("您的 API Key 已被泄露或无效，已被 Google 禁用。\n\n解决办法：\n1. 前往 Google AI Studio (aistudio.google.com) 重新生成一个 API Key。\n2. 在 Vercel 的环境变量 (Environment Variables) 中更新 VITE_GEMINI_API_KEY。\n3. 重新部署您的 Vercel 项目。\n4. 切勿将 API Key 提交到 GitHub 公开仓库中。");
    }
    
    if (errorString.includes("429") || errorString.includes("quota")) {
      throw new Error("API 请求频率过快或额度已用尽，请稍等 1 分钟后再试。");
    }

    throw new Error(error.message || "调用 Gemini API 失败，请检查网络或 API Key。");
  }
}

export const parsePackingList = async (base64Images: string[]): Promise<Partial<RollData>[]> => {
  try {
    const parts = [
      ...base64Images.map(img => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
        }
      })),
      {
        text: `You are an industrial OCR assistant for fabric inspection. 
        Analyze the provided fabric packing list image(s) and extract roll information into a JSON array.

        Field Mappings:
        - rollNo: Look for "Roll No", "Piece No", "卷号", "匹号". 
        - dyeLot: Look for "Dye Lot", "Batch No", "Lot No", "缸号".
        - length: Look for "Length", "Quantity", "Meters", "米数". Must be a number.
        - weight: Look for "Weight", "G/M2", "克重". Must be a number.
        - width: Look for "Width", "Cuttable Width", "门幅". Must be a number.

        Parsing Rules:
        1. Accuracy: Do not hallucinate. If a value is unreadable, use null or 0.
        2. Global Values: Often "Width" is written once at the top/bottom. If so, apply it to all rows. Default to 58 if not found.
        3. Table Structure: Handle multi-column layouts. Each row in the physical list must be a separate object in the array.
        4. Consistency: Ensure data types match (string for IDs, number for measurements).
        5. Completion: Extraction must be exhaustive. Do not skip any rows.
        
        Return ONLY a JSON array of objects conforming to the schema.`
      }
    ];

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          rollNo: { type: Type.STRING },
          dyeLot: { type: Type.STRING },
          length: { type: Type.NUMBER },
          weight: { type: Type.NUMBER },
          width: { type: Type.NUMBER }
        },
        required: ["rollNo", "dyeLot", "length", "weight", "width"]
      }
    };

    const text = await callGemini([{ role: 'user', parts }], schema);
    const parsed = JSON.parse(text);

    return parsed.map((item: any) => ({
      rollNo: String(item.rollNo || ''),
      dyeLot: String(item.dyeLot || ''),
      length: Number(item.length || 0),
      weight: Number(item.weight || 0),
      width: Number(item.width) > 0 ? Number(item.width) : 58,
      status: 'PENDING',
      defects: [],
      comments: '',
      isSelected: false,
      id: Math.random().toString(36).substr(2, 9)
    }));
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    throw error; // 抛出错误让 UI 处理提示
  }
};

export const parseWeight = async (base64Image: string): Promise<number | null> => {
  try {
    const parts = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
        }
      },
      { text: "Read the scale weight number. Return JSON: {\"weight\": number}" }
    ];

    const text = await callGemini([{ role: 'user', parts }]);
    const parsed = JSON.parse(text);
    return parsed.weight || null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const analyzeLighting = async (base64Image: string): Promise<{ lux: number, status: 'PASS' | 'FAIL' | 'WARNING', message: string }> => {
  try {
    const parts = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
        }
      },
      { text: `Analyze lighting. Return JSON: {"lux": number, "status": "PASS"|"WARNING"|"FAIL", "message": "string"}` }
    ];

    const text = await callGemini([{ role: 'user', parts }]);
    return JSON.parse(text);
  } catch (e) {
    console.error(e);
    return { lux: 0, status: 'FAIL', message: 'Analysis failed' };
  }
};
