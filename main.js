// Import necessary modules
const { DisconnectReason, makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai")
const { handleUserInteraction } = require('./Middleware/gemini')
const { createWriteStream, unlinkSync } = require('fs');
const fs = require('fs');
const path = require('path')
require('dotenv').config()

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fileToGenerativePart(path, mimeType) {
    // Function to convert file to generative part
    try {
        const fileBuffer = fs.readFileSync(path);
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

// AI configuration
const generationConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

// Chat sessions map
const chatSessions = new Map();

// Connect to WhatsApp function
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        // logger: pino({ level: 'silent' }) // Opsi untuk menonaktifkan log yang berlebihan
    });

    // Connection update listener
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
        }
    });

    // Get chat session function
    async function getChatSession(sender) {
        if (!chatSessions.has(sender)) {
            const initialPrompt = `Kamu adalah CS Clara. Setiap pertanyaan atau input dari user, jawab sebagai CS Ara. Gunakan bahasa yang Friendly. Gunakan penyebutan aku dan kamu, dan panggilan kak kepada customer.`;
            const chatSession = model.startChat({
                generationConfig,
                history: [{ role: "user", parts: [{ text: initialPrompt }] }]
            });
            chatSessions.set(sender, chatSession);
        }
        return chatSessions.get(sender);
    }

    // Function to count tokens before sending message
    async function countTokens(chat) {
        try {
            const countResult = await model.countTokens({
                generateContentRequest: { contents: await chat.getHistory() }
            })
            console.log(`Total token saat ini: ${countResult.totalTokens}`);
            return countResult.totalTokens;
        } catch (error) {
            console.error("Error menghitung token:", error);
            return null;
        }
    }

    // Process message function
    async function processMessage(message, sender, quotedMsg) {
        try {

            const chatSession = await getChatSession(sender)
            await countTokens(chatSession)

            const result = await chatSession.sendMessage(message, { useCache: true });
            const responseText = (await result.response.text())?.replaceAll('**', '') || "Maaf, aku belum paham maksud kamu.";
            console.log("Penggunaan Token:", result.response.usageMetadata.totalTokenCount);

            if (quotedMsg) {
                await sock.sendMessage(sender, { text: responseText }, { quoted: quotedMsg });
            } else {
                await sock.sendMessage(sender, { text: responseText });
            }

        } catch (err) {
            console.error("Error processing message:", err);
            await sock.sendMessage(sender, { text: 'Terima kasih, mohon menunggu update selanjutnya..' });
        }
    }

    // creds.update listener
    sock.ev.on('creds.update', saveCreds);

    // messages.upsert listener
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg?.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        const quotedMsg = msg.quoted ? msg.quoted : null;

        console.log(`Sender: ${sender.replace('@s.whatsapp.net', '')}`);
        console.log(`Message Type: ${messageType}`);

        if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            //await delay(2000);
            await sock.readMessages([msg.key]);
            //await delay(2000);
            const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
            console.log('Pesan :', messageContent)
        
            // Check handleUserInteraction to determine response
            const response = await handleUserInteraction(sender, messageContent)
            // console.log(response)
        
            if (response) {
                // If handleUserInteraction handles the message, use its response
                await sock.sendMessage(sender, { text: response });
            } else {
                // If there is no ongkir session, use AI as fallback
                await processMessage(messageContent, sender, quotedMsg);
            }
        } else if (messageType === 'imageMessage' && sender !== 'status@broadcast') {
            console.log('Cek sender', sender)

            // Function to read message
            await sock.readMessages([msg.key])

            const mimeType = msg.message.imageMessage.mimetype;
            const caption = msg.message.imageMessage.caption;
            const filePath = path.join(__dirname, 'wa.jpg');

            try {
                const stream = await downloadMediaMessage(msg, 'stream', {}, { sock });
                const writeMedia = createWriteStream(filePath);

                await new Promise((resolve, reject) => {
                    stream.pipe(writeMedia);
                    stream.on("end", resolve);
                    stream.on("error", reject);
                });

                console.log("Image saved as wa.jpg");
                const imageParts = fileToGenerativePart(filePath, mimeType);

                if (imageParts) {
                    const message = caption ? [caption, imageParts] : imageParts;
                    await processMessage(message, sender, quotedMsg);
                } else {
                    await sock.sendMessage(sender, { text: "Gagal memproses gambar." });
                }

            } catch (error) {
                console.error("Error downloading or processing image:", error);
                await sock.sendMessage(sender, { text: "Gagal mengunduh atau memproses gambar." });
            } finally {
                try {
                    unlinkSync(filePath);
                    console.log("Image file deleted.");
                } catch (deleteError) {
                    console.error("Error deleting image file:", deleteError);
                }
            }
        } // ... (Tambahkan penanganan untuk audioMessage jika diperlukan)
    });
}

// Connect to WhatsApp
connectToWhatsApp();
