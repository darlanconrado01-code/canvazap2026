
export interface VoiceSettings {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
}

export const generateAudio = async (
    text: string,
    voiceId: string,
    modelId: string = 'eleven_multilingual_v2',
    settings?: VoiceSettings
) => {
    const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;

    if (!ELEVENLABS_API_KEY) {
        throw new Error("Eleven Labs API Key (VITE_ELEVENLABS_API_KEY) não configurada no .env.local");
    }

    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text,
                model_id: modelId,
                voice_settings: settings || {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0,
                    use_speaker_boost: true
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || "Falha na comunicação com Eleven Labs");
        }

        const blob = await response.blob();
        return blob;
    } catch (error: any) {
        console.error("Eleven Labs Service Error:", error);
        throw error;
    }
};
