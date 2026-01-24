
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = import.meta.env.VITE_R2_ENDPOINT;
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

const s3Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export const uploadToR2 = async (file: File, path: string): Promise<string> => {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET_NAME) {
        throw new Error("Configuração do R2 ausente no .env.local");
    }

    const key = `${path}/${Date.now()}_${file.name}`;

    // Convertendo o arquivo para Uint8Array para evitar o erro de readableStream no navegador
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileData,
        ContentType: file.type,
    });

    try {
        await s3Client.send(command);

        // Retorna a URL pública configurada
        if (R2_PUBLIC_URL) {
            const baseUrl = R2_PUBLIC_URL.endsWith('/') ? R2_PUBLIC_URL.slice(0, -1) : R2_PUBLIC_URL;
            return `${baseUrl}/${key}`;
        }

        return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
    } catch (error: any) {
        console.error("R2 Upload Error Detailed:", error);
        throw new Error(error.message || "Falha no upload para o R2");
    }
};

export const deleteFromR2 = async (key: string): Promise<void> => {
    const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });

    try {
        await s3Client.send(command);
    } catch (error) {
        console.error("R2 Delete Error:", error);
        throw error;
    }
};
