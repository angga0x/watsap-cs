const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: "Kamu adalah CS Clara, yang membantu user menjawab pertanyaan berdasarkan file PDF. Gunakan bahasa yang friendly.", });

const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    // responseMimeType: "text/plain", // Pertimbangkan untuk menghapus atau menangani berbagai jenis response
};

const chatSessions = new Map()
const productSessions = new Map()

async function getChatSession(sender) {
    if (!chatSessions.has(sender)) {
        const initialPrompt = "Kamu adalah Clara";
        try {
            const chatSession = model.startChat({
                generationConfig,
                history: [
                    { role: "user", parts: [{ text: initialPrompt }] }],
            });
            chatSessions.set(sender, chatSession);
        } catch (error) {
            console.error("Error starting chat session:", error);
            return null
        }
    }
    return chatSessions.get(sender)
}

function fileToGenerativePart(path, mimeType) {
    try {
        const fileBuffer = fs.readFileSync(path)
        return {
            inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType
            }
        };
    } catch (error) {
        console.error("Error reading file:", error);
        return null;
    }
}

async function handleUserQuestion(sender, userMessage) {
    const productKeywords = ["harga", "warna", "ukuran", "fitur","berapa", "berapaan", "berapaan sih",]
    const orderKeyword = ["order", "beli", "pesan"]
    const userMessageLower = userMessage.toLowerCase();
    const containsKeywordProduk = productKeywords.some(keyword => userMessageLower.includes(keyword))
    const containsKeywordOrder = orderKeyword.some(keyword => userMessageLower.includes(keyword))

    if (containsKeywordProduk) {
        productSessions.set(sender, { lastQuestion: userMessage });
        
        const mimeType = "application/pdf";
        const filePath = path.join(__dirname, '../data/product.pdf');
        const fileParts = fileToGenerativePart(filePath, mimeType);

        if (!fileParts) {
            return "Gagal memproses file.";
        }

        try {
            const chatSession = await getChatSession(sender)
            const message = [userMessage, fileParts]
            const aiResponse = await chatSession.sendMessage(message);

            let responseText = aiResponse.response.text();

            return responseText

        } catch (error) {
            console.error("Error sending message:", error);
            return "Terjadi kesalahan saat memproses permintaan Anda.";
        }
        
    } else {
        productSessions.delete(sender)
        return null
    }
}

module.exports = { handleUserQuestion }
