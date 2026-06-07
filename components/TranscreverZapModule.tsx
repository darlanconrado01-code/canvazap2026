import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Mic, 
  Upload, 
  FileAudio, 
  Trash2, 
  Copy, 
  Download, 
  Sparkles, 
  AlertTriangle, 
  Settings, 
  Check, 
  Loader2 
} from 'lucide-react';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export default function TranscreverZapModule() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  
  const companyId = userData?.companyId || '';
  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

  // Firestore Keys state
  const [dbGroqKey, setDbGroqKey] = useState<string>('');
  const [dbGeminiKey, setDbGeminiKey] = useState<string>('');
  const [isLoadingKeys, setIsLoadingKeys] = useState<boolean>(true);

  // Load keys directly from Firestore to bypass AuthContext cache lags
  useEffect(() => {
    const fetchKeys = async () => {
      if (companyId) {
        try {
          const cSnap = await getDoc(doc(db, 'companies', companyId));
          if (cSnap.exists()) {
            const data = cSnap.data();
            setDbGroqKey(data.groqApiKey || '');
            setDbGeminiKey(data.geminiApiKey || '');
          }
        } catch (e) {
          console.error("Erro ao buscar chaves da empresa no Firestore:", e);
        }
      }
      setIsLoadingKeys(false);
    };
    fetchKeys();
  }, [companyId]);

  const groqApiKey = dbGroqKey || userData?.groqApiKey || '';
  const geminiApiKey = dbGeminiKey || userData?.geminiApiKey || '';

  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionResult, setTranscriptionResult] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'ok' | 'err' | 'inf' } | null>(null);
  const [copied, setCopied] = useState(false);

  // Gemini State
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState('');
  const [geminiToast, setGeminiToast] = useState<{ text: string; type: 'ok' | 'err' | 'inf' } | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Helper formatting
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const showToast = (text: string, type: 'ok' | 'err' | 'inf', isGemini = false) => {
    if (isGemini) {
      setGeminiToast({ text, type });
      if (type === 'ok') {
        setTimeout(() => setGeminiToast(null), 3000);
      }
    } else {
      setToastMessage({ text, type });
      if (type === 'ok') {
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Limits size to 25MB (Groq Whisper limit)
    if (file.size > 26214400) {
      showToast('Arquivo muito grande. Limite: 25 MB.', 'err');
      return;
    }
    setSelectedFile(file);
    showToast(`Arquivo selecionado: ${file.name}`, 'ok');
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Transcribe API Call
  const handleTranscribe = async () => {
    if (!selectedFile) return;
    if (!groqApiKey) {
      showToast('Chave API Groq não configurada. Configure no Perfil da Empresa.', 'err');
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress(25);
    showToast('Enviando áudio para Groq Whisper...', 'inf');
    setTranscriptionResult('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('model', 'whisper-large-v3');
    if (language) {
      formData.append('language', language);
    }
    formData.append('response_format', 'text');

    setTranscriptionProgress(55);

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: formData
      });

      setTranscriptionProgress(85);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Erro HTTP ${response.status}`);
      }

      const textResult = await response.text();
      setTranscriptionProgress(100);
      setTranscriptionResult(textResult.trim());
      showToast('Transcrição concluída com sucesso!', 'ok');
    } catch (error: any) {
      console.error(error);
      showToast(`Erro na transcrição: ${error.message}`, 'err');
    } finally {
      setTimeout(() => {
        setIsTranscribing(false);
        setTranscriptionProgress(0);
      }, 600);
    }
  };

  // Copy Clipboard
  const copyToClipboard = async () => {
    if (!transcriptionResult) return;
    try {
      await navigator.clipboard.writeText(transcriptionResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('Erro ao copiar texto.', 'err');
    }
  };

  // Download File
  const downloadTxt = () => {
    if (!transcriptionResult) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'transcricao';
    const blob = new Blob([transcriptionResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_transcricao.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    setTranscriptionResult('');
    setAnalysisResult('');
    setSelectedPrompt('');
    setCustomPrompt('');
    setToastMessage(null);
    setGeminiToast(null);
  };

  // Prompt Chips
  const promptChips = [
    { label: 'Resumo', prompt: 'Faça um resumo detalhado deste texto:' },
    { label: 'Pontos-chave', prompt: 'Liste os pontos principais e tópicos abordados neste texto:' },
    { label: 'Ações', prompt: 'Extraia todos os itens de ação e tarefas mencionados neste texto:' },
    { label: 'Tom & Sentimento', prompt: 'Identifique o tom, sentimento geral e contexto deste texto:' }
  ];

  const handleChipClick = (prompt: string) => {
    setSelectedPrompt(prompt);
    setCustomPrompt(prompt + '\n\n');
  };

  // Gemini API Call
  const handleAnalyze = async () => {
    if (!transcriptionResult || !geminiApiKey) return;

    setIsAnalyzing(true);
    setAnalysisProgress(30);
    showToast('Consultando Google Gemini...', 'inf', true);
    setAnalysisResult('');

    const promptText = (customPrompt.trim() || 'Faça um resumo detalhado deste texto:') + '\n\n' + transcriptionResult;

    try {
      setAnalysisProgress(60);
      const response = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      });

      setAnalysisProgress(85);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      setAnalysisProgress(100);
      const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta obtida do modelo.';
      setAnalysisResult(outputText);
      showToast('Análise concluída com sucesso!', 'ok', true);
    } catch (error: any) {
      console.error(error);
      showToast(`Erro na análise: ${error.message}`, 'err', true);
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 600);
    }
  };

  if (isLoadingKeys) {
    return (
      <div style={{ display: 'flex', height: '300px', width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--primary-color)' }}></div>
      </div>
    );
  }

  // Render Keys Missing warning
  if (!groqApiKey || !geminiApiKey) {
    return (
      <div className="fade-in" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px solid var(--border-color)' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: 'rgba(238, 93, 80, 0.1)', 
            color: 'var(--error-color)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 1.5rem' 
          }}>
            <AlertTriangle size={32} />
          </div>
          
          <h2 style={{ color: 'var(--text-color)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Configuração Necessária
          </h2>
          
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            A ferramenta <strong>Transcrever do Zap</strong> necessita das chaves API do Groq e Google Gemini para funcionar corretamente. 
            {isAdmin 
              ? ' Adicione as chaves de acesso na página de Perfil da Empresa para liberar este recurso.' 
              : ' Solicite ao administrador da empresa para configurar as chaves de API nas configurações.'}
          </p>

          {isAdmin ? (
            <button 
              onClick={() => navigate('/company-profile')} 
              className="btn btn-primary"
              style={{ width: 'auto', display: 'inline-flex', padding: '0.8rem 2rem' }}
            >
              <Settings size={18} />
              Configurar Chaves de API
            </button>
          ) : (
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-secondary"
              style={{ width: 'auto', display: 'inline-flex', padding: '0.8rem 2rem' }}
            >
              Voltar ao Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '720px', margin: '0 auto' }}>
      
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          width: '56px', 
          height: '56px', 
          background: 'var(--primary-color)', 
          borderRadius: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 12px', 
          color: '#fff',
          boxShadow: '0 8px 16px rgba(67, 24, 255, 0.2)'
        }}>
          <Mic size={28} />
        </div>
        <h1 className="title" style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '4px' }}>Transcrever do Zap</h1>
        <p className="subtitle">Groq Whisper Large v3 · Análise Inteligente com Gemini</p>
      </div>

      {/* Upload Box */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileAudio size={18} style={{ color: 'var(--primary-color)' }} />
          Arquivo de Áudio
        </div>

        {!selectedFile ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--primary-color)' : 'var(--border-color)'}`,
              borderRadius: '14px',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'var(--primary-light)' : 'rgba(0,0,0,0.01)',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }}
              accept="audio/*,video/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,.flac,.aac,.opus,.wma,.aiff,.amr" 
            />
            <Upload size={36} style={{ color: 'var(--primary-color)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-color)' }}>Clique ou arraste o arquivo de áudio aqui</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              MP3, WAV, M4A, WEBM, FLAC, OGG, AAC, OPUS, AMR e outros (Máx. 25 MB)
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '12px 16px', 
            background: 'var(--primary-light)', 
            border: '1px solid rgba(67, 24, 255, 0.1)', 
            borderRadius: '12px' 
          }}>
            <FileAudio size={22} style={{ color: 'var(--primary-color)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {formatBytes(selectedFile.size)}
              </div>
            </div>
            <button 
              onClick={clearFile}
              className="btn-secondary" 
              style={{ width: 'auto', padding: '6px', borderRadius: '8px', border: 'none' }}
              title="Remover arquivo"
            >
              <Trash2 size={16} style={{ color: 'var(--error-color)' }} />
            </button>
          </div>
        )}

        {/* Language Selection & Action Button */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem', alignItems: 'center' }}>
          <select 
            className="form-input" 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">Detectar idioma automaticamente</option>
            <option value="pt">Português</option>
            <option value="en">Inglês</option>
            <option value="es">Espanhol</option>
            <option value="fr">Francês</option>
            <option value="de">Alemão</option>
            <option value="it">Italiano</option>
            <option value="ja">Japonês</option>
            <option value="zh">Chinês</option>
            <option value="ko">Coreano</option>
            <option value="ru">Russo</option>
            <option value="ar">Árabe</option>
          </select>
          
          <button 
            onClick={handleTranscribe} 
            disabled={!selectedFile || isTranscribing}
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0 24px', height: '46px', whiteSpace: 'nowrap' }}
          >
            {isTranscribing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Transcrevendo...
              </>
            ) : (
              <>
                <Mic size={16} />
                Transcrever
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {isTranscribing && (
          <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '1.25rem', overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              background: 'var(--primary-color)', 
              width: `${transcriptionProgress}%`, 
              transition: 'width 0.3s ease' 
            }} />
          </div>
        )}

        {/* Toast notifications */}
        {toastMessage && (
          <div style={{
            fontSize: '0.8rem',
            marginTop: '1rem',
            padding: '10px 14px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: toastMessage.type === 'err' ? 'rgba(238, 93, 80, 0.1)' : toastMessage.type === 'ok' ? 'rgba(5, 205, 153, 0.1)' : 'rgba(67, 24, 255, 0.05)',
            color: toastMessage.type === 'err' ? 'var(--error-color)' : toastMessage.type === 'ok' ? 'var(--success-color)' : 'var(--primary-color)',
            border: `1px solid ${toastMessage.type === 'err' ? 'rgba(238, 93, 80, 0.2)' : toastMessage.type === 'ok' ? 'rgba(5, 205, 153, 0.2)' : 'rgba(67, 24, 255, 0.1)'}`
          }}>
            {toastMessage.type === 'err' && <AlertTriangle size={14} />}
            {toastMessage.type === 'ok' && <Check size={14} />}
            {toastMessage.type === 'inf' && <Loader2 size={14} className="animate-spin" />}
            {toastMessage.text}
          </div>
        )}
      </div>

      {/* Transcription Results */}
      {transcriptionResult && (
        <div className="glass-card fade-in" style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-color)' }}>
              Transcrição Concluída
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={copyToClipboard} 
                className="btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--success-color)' }} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <button 
                onClick={downloadTxt} 
                className="btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              >
                <Download size={14} />
                Baixar .txt
              </button>
              <button 
                onClick={clearAll} 
                className="btn-secondary" 
                style={{ width: 'auto', padding: '6px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                title="Limpar resultados"
              >
                <Trash2 size={14} style={{ color: 'var(--error-color)' }} />
              </button>
            </div>
          </div>
          
          <div style={{
            background: 'var(--bg-color)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.25rem',
            fontSize: '0.95rem',
            lineHeight: '1.6',
            color: 'var(--text-color)',
            minHeight: '120px',
            whiteSpace: 'pre-wrap',
            maxHeight: '320px',
            overflowY: 'auto'
          }}>
            {transcriptionResult}
          </div>
        </div>
      )}

      {/* Analysis Section */}
      {transcriptionResult && (
        <div className="glass-card fade-in" style={{ border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--primary-color)' }} />
            Análise com Gemini IA
          </div>
          <div style={{ height: '1px', background: 'var(--border-color)', marginBottom: '1rem' }} />

          {/* Quick prompt chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '1rem' }}>
            {promptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleChipClick(chip.prompt)}
                className={`btn-secondary ${selectedPrompt === chip.prompt ? 'active' : ''}`}
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.8rem', 
                  borderRadius: '10px',
                  fontWeight: 600,
                  border: `1px solid ${selectedPrompt === chip.prompt ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: selectedPrompt === chip.prompt ? 'var(--primary-light)' : 'transparent',
                  color: selectedPrompt === chip.prompt ? 'var(--primary-color)' : 'var(--text-color)'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Custom Instruction Box */}
          <textarea
            className="form-input"
            rows={3}
            placeholder="Instrução customizada para o Gemini analisar o áudio..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{ resize: 'vertical', fontSize: '0.9rem', marginBottom: '1rem' }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !customPrompt.trim()}
              className="btn btn-primary"
              style={{ width: 'auto', padding: '0 24px', display: 'inline-flex' }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analisar
                </>
              )}
            </button>
          </div>

          {/* Gemini Progress bar */}
          {isAnalyzing && (
            <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
              <div style={{ 
                height: '100%', 
                background: 'var(--primary-color)', 
                width: `${analysisProgress}%`, 
                transition: 'width 0.3s ease' 
              }} />
            </div>
          )}

          {/* Gemini Toast */}
          {geminiToast && (
            <div style={{
              fontSize: '0.8rem',
              marginTop: '1rem',
              padding: '10px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: geminiToast.type === 'err' ? 'rgba(238, 93, 80, 0.1)' : geminiToast.type === 'ok' ? 'rgba(5, 205, 153, 0.1)' : 'rgba(67, 24, 255, 0.05)',
              color: geminiToast.type === 'err' ? 'var(--error-color)' : geminiToast.type === 'ok' ? 'var(--success-color)' : 'var(--primary-color)',
              border: `1px solid ${geminiToast.type === 'err' ? 'rgba(238, 93, 80, 0.2)' : geminiToast.type === 'ok' ? 'rgba(5, 205, 153, 0.2)' : 'rgba(67, 24, 255, 0.1)'}`
            }}>
              {geminiToast.type === 'err' && <AlertTriangle size={14} />}
              {geminiToast.type === 'ok' && <Check size={14} />}
              {geminiToast.type === 'inf' && <Loader2 size={14} className="animate-spin" />}
              {geminiToast.text}
            </div>
          )}

          {/* Gemini output results */}
          {analysisResult && (
            <div className="fade-in" style={{ marginTop: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-color)', marginBottom: '0.5rem' }}>
                Resultado da Análise IA
              </div>
              <div style={{
                background: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.25rem',
                fontSize: '0.95rem',
                lineHeight: '1.6',
                color: 'var(--text-color)',
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {analysisResult}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
