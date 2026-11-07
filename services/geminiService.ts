import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateSignageImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  
  // Use gemini-2.5-flash-image for fast image generation
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Create a professional digital signage background image for: ${prompt}. 
                 High resolution, 16:9 aspect ratio, clean design, suitable for public display. 
                 Do not include text inside the image if possible, or keep it very minimal and legible.`,
        },
      ],
    },
    config: {
        // Nano banana models don't support responseMimeType or specific imageConfig schemas like 'imageSize'
        // We rely on the model prompt to guide ratio.
    }
  });

  // Extract the image from the response
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated.");
};

export const generateSlideContent = async (topic: string): Promise<{ title: string; body: string }> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a short, catchy title and a brief announcement body text (max 20 words) for a digital signage slide about: ${topic}. Return strictly JSON.`,
        config: {
            responseMimeType: 'application/json'
        }
    });
    
    try {
        const text = response.text;
        if (!text) throw new Error("No text returned");
        return JSON.parse(text);
    } catch (e) {
        console.error("JSON parse error", e);
        return { title: topic, body: "Welcome!" };
    }
}