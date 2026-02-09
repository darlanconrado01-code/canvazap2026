
import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_AI_KEY || '';
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

export const geminiService = {
  analyzeProductList: async (text: string) => {
    if (!GEMINI_KEY) return [];
    try {
      const result = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Analise a seguinte lista de produtos e extraia o nome do produto e o preço sugerido (se houver). Formate como uma lista JSON. Texto: ${text}` }] }]
      });
      return JSON.parse(result.text || '[]');
    } catch (error) {
      console.error("Gemini Error:", error);
      return [];
    }
  },

  suggestMarketingSlogan: async (themeName: string, products: string[]) => {
    if (!GEMINI_KEY) return 'Ofertas do Dia!';
    try {
      const result = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: `Crie um slogan curto e chamativo para uma lâmina de ofertas com o tema "${themeName}" contendo os produtos: ${products.join(', ')}.` }] }]
      });
      return result.text || 'Ofertas Imperdíveis!';
    } catch (error) {
      return 'Ofertas do Dia!';
    }
  },

  rewriteForCategory: async (text: string, category: string) => {
    if (!GEMINI_KEY) return text;
    try {
      const prompt = `
        Você é um redator publicitário experiente. 
        Reescreva o texto de locução abaixo para ser usado por uma empresa da categoria "${category}".
        
        REGRAS:
        1. Se for Supermercado ou Varejo: Use tom entusiasta, animado, focado em ofertas e urgência.
        2. Se for Farmácia/Saúde: Use tom confiável, cuidadoso, mas ainda convidativo.
        3. Se for Pet Shop: Use tom carinhoso e alegre.
        4. Se for Material de Construção: Use tom sólido, profissional e focado em soluções.
        5. Mantenha o texto curto (máximo 500 caracteres).
        6. Não use hashtags ou emojis, apenas o texto para ser lido.
        
        TEXTO ORIGINAL:
        "${text}"
      `;

      const result = await (ai as any).models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      return result.text?.trim() || text;
    } catch (error) {
      console.error("Gemini Rewrite Error:", error);
      return text;
    }
  }
};
