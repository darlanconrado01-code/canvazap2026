
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const geminiService = {
  analyzeProductList: async (text: string) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise a seguinte lista de produtos e extraia o nome do produto e o preço sugerido (se houver). Formate como uma lista JSON. Texto: ${text}`,
        config: {
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (error) {
      console.error("Gemini Error:", error);
      return [];
    }
  },

  suggestMarketingSlogan: async (themeName: string, products: string[]) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Crie um slogan curto e chamativo para uma lâmina de ofertas com o tema "${themeName}" contendo os produtos: ${products.join(', ')}.`,
      });
      return response.text || 'Ofertas Imperdíveis!';
    } catch (error) {
      return 'Ofertas do Dia!';
    }
  }
};
