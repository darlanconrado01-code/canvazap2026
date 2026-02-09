
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from './AuthContext';

const VoiceAssistant: React.FC = () => {
    const { userData } = useAuth();
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [showTranscription, setShowTranscription] = useState(false);
    const [copied, setCopied] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);

                // Stop all tracks to release the microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setTranscription('');
            setShowTranscription(false);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Não foi possível acessar o microfone. Verifique as permissões.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const processAudio = async (blob: Blob) => {
        setIsProcessing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];

                const response = await fetch('https://n8n.canvazap.com.br/webhook/ASSISTENTE-VOZ', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        data: {
                            base64: base64Audio,
                            userId: userData?.uid,
                            userName: userData?.displayName,
                            companyId: userData?.companyId
                        }
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    // Assuming n8n returns something like { text: "..." } or similar
                    // Based on Whisper output in n8n, it usually returns { text: "..." }
                    const text = result.text || result.transcription || result.data?.text || JSON.stringify(result);
                    setTranscription(text);
                    setShowTranscription(true);

                    // Automatically copy to clipboard as requested
                    try {
                        await navigator.clipboard.writeText(text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                        console.error("Failed to copy automatically:", err);
                    }
                } else {
                    alert("Erro ao processar áudio no servidor.");
                }
            };
        } catch (err) {
            console.error("Error processing audio:", err);
            alert("Erro ao converter áudio.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input/textarea to avoid accidental triggers
            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if (e.key.toLowerCase() === 'g' && !isTyping) {
                e.preventDefault();
                if (isRecording) {
                    stopRecording();
                } else {
                    startRecording();
                }
            }

            if (e.key === 'Escape') {
                if (isRecording) {
                    // Cancel recording (don't process results)
                    if (mediaRecorderRef.current) {
                        mediaRecorderRef.current.onstop = null; // Remove the processing listener
                        mediaRecorderRef.current.stop();
                        setIsRecording(false);
                        // Stop all tracks
                        const stream = mediaRecorderRef.current.stream;
                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                        }
                    }
                }
                setShowTranscription(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording]); // Re-bind when isRecording changes to have fresh state in closure

    const copyToClipboard = () => {
        navigator.clipboard.writeText(transcription);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                style={{
                    background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'none',
                    border: 'none',
                    color: isRecording ? '#ef4444' : 'var(--text-secondary)',
                    padding: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                }}
                title={isRecording ? "Parar Gravação" : "Assistente de Voz"}
            >
                {isProcessing ? (
                    <Loader2 size={18} className="animate-spin" />
                ) : isRecording ? (
                    <>
                        <Square size={18} fill="#ef4444" />
                        <span style={{
                            position: 'absolute',
                            top: '-2px',
                            right: '-2px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            animation: 'pulse 1.5s infinite'
                        }} />
                    </>
                ) : (
                    <Mic size={18} />
                )}
            </button>

            {showTranscription && (
                <div className="glass-card" style={{
                    position: 'absolute',
                    top: '120%',
                    right: 0,
                    width: '300px',
                    padding: '1rem',
                    zIndex: 2000,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    border: '1px solid var(--border-color)',
                    animation: 'slideDown 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Transcrição</span>
                        <button
                            onClick={() => setShowTranscription(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
                        >×</button>
                    </div>

                    <div style={{
                        background: 'rgba(0,0,0,0.03)',
                        padding: '0.8rem',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        color: 'var(--text-color)',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        lineHeight: '1.4',
                        marginBottom: '1rem'
                    }}>
                        {transcription}
                    </div>

                    <button
                        onClick={copyToClipboard}
                        style={{
                            width: '100%',
                            padding: '0.6rem',
                            background: copied ? '#22c55e' : 'var(--primary-color)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {copied ? (
                            <>
                                <Check size={16} /> Copiado!
                            </>
                        ) : (
                            <>
                                <Copy size={16} /> Copiar Texto
                            </>
                        )}
                    </button>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes slideDown {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default VoiceAssistant;
