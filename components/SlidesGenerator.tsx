
import React, { useState } from 'react';
import { MOCK_THEMES, MOCK_IMAGE_BANK } from '../constants';
import { geminiService } from '../services/geminiService';
import { Theme, ProductImage } from '../types';

const SlidesGenerator: React.FC = () => {
  const [productList, setProductList] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<any[]>([]);
  const [slogan, setSlogan] = useState('');

  const handleGenerate = async () => {
    if (!selectedTheme || !productList) return;
    
    setLoading(true);
    // 1. Analyze products via AI
    const analyzed = await geminiService.analyzeProductList(productList);
    
    // 2. Cross-reference with Image Bank
    const slides = analyzed.map((item: any) => {
      const dbMatch = MOCK_IMAGE_BANK.find(img => img.name.toLowerCase().includes(item.nome?.toLowerCase()));
      return {
        ...item,
        image: dbMatch?.imageUrl || 'https://via.placeholder.com/200?text=Solicitar+Foto',
        found: !!dbMatch
      };
    });

    // 3. Get AI Slogan
    const aiSlogan = await geminiService.suggestMarketingSlogan(selectedTheme.name, analyzed.map((i: any) => i.nome));

    setSlogan(aiSlogan);
    setGeneratedSlides(slides);
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Configuration Column */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">1. Lista de Produtos</h3>
          <textarea
            className="w-full h-40 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            placeholder="Cole aqui a lista de produtos (ex: Arroz Tio João 5kg R$ 22,90)..."
            value={productList}
            onChange={(e) => setProductList(e.target.value)}
          ></textarea>
          <p className="text-xs text-slate-400 mt-2">Dica: Nossa IA identificará automaticamente nomes e preços.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4">2. Escolha o Tema</h3>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme)}
                className={`group relative rounded-xl overflow-hidden border-2 transition-all ${
                  selectedTheme?.id === theme.id ? 'border-indigo-600 scale-[0.98]' : 'border-transparent'
                }`}
              >
                <img src={theme.imageUrl} className="w-full h-24 object-cover" alt={theme.name} />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-white font-bold uppercase">{theme.name}</span>
                </div>
                {selectedTheme?.id === theme.id && (
                  <div className="absolute top-1 right-1 bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center">
                    <i className="fas fa-check text-[10px]"></i>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !selectedTheme || !productList}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-lg transition-all flex items-center justify-center space-x-3"
        >
          {loading ? (
            <i className="fas fa-circle-notch fa-spin"></i>
          ) : (
            <>
              <i className="fas fa-magic"></i>
              <span>Gerar Lâminas Automatizadas</span>
            </>
          )}
        </button>
      </div>

      {/* Preview Column */}
      <div className="lg:col-span-2 space-y-6">
        {generatedSlides.length > 0 ? (
          <div className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Sugestão da IA para Headline</h4>
              <p className="text-xl font-bold text-indigo-900 italic">"{slogan}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {generatedSlides.map((slide, idx) => (
                <div key={idx} className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 relative group">
                  {/* Visual Art Rendering */}
                  <div 
                    className="h-80 relative flex items-center justify-center p-8"
                    style={{ backgroundColor: selectedTheme?.colors[0] }}
                  >
                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <img src={selectedTheme?.imageUrl} className="w-full h-full object-cover" alt="bg" />
                    </div>
                    
                    <div className="relative z-10 text-center">
                       <img src={slide.image} className="h-48 w-auto mx-auto object-contain drop-shadow-2xl transition-transform group-hover:scale-110" alt={slide.nome} />
                       <div className="mt-4 bg-white/95 backdrop-blur p-4 rounded-2xl shadow-lg">
                          <p className="text-slate-800 font-bold text-sm uppercase leading-tight">{slide.nome}</p>
                          <div className="mt-2 flex items-baseline justify-center space-x-1">
                             <span className="text-xs font-medium text-slate-500">R$</span>
                             <span className="text-3xl font-black text-indigo-600">{slide.preco?.split(' ')[1] || '---'}</span>
                          </div>
                       </div>
                    </div>

                    {!slide.found && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-lg flex items-center space-x-1">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Solicitação Criada</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 bg-white flex justify-between items-center">
                    <div className="flex space-x-2">
                      <button className="text-slate-400 hover:text-indigo-600 p-2"><i className="fas fa-download"></i></button>
                      <button className="text-slate-400 hover:text-indigo-600 p-2"><i className="fas fa-share-nodes"></i></button>
                    </div>
                    <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                      Editar Manualmente
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[500px] bg-slate-100 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 p-12 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-inner mb-6">
              <i className="fas fa-wand-magic-sparkles text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-slate-600 mb-2">Aguardando Configuração</h3>
            <p className="max-w-xs">Configure a lista de produtos e escolha um tema para visualizar a mágica acontecer.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlidesGenerator;
