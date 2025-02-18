const { DisconnectReason, makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('baileys');
const { GoogleGenerativeAI } = require("@google/generative-ai")
const { handleUserInteraction } = require('./middleware/gemini')
const { createWriteStream, unlinkSync } = require('fs');
const fs = require('fs');
const path = require('path')
require('dotenv').config()

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Fungsi Delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fileToGenerativePart(path, mimeType) {
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

// Konfigurasi AI
const generationConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const chatSessions = new Map();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        // logger: pino({ level: 'silent' }) // Opsi untuk menonaktifkan log yang berlebihan
    });

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

    async function processMessage(message, sender, quotedMsg) {
        try {
            const chatSession = await getChatSession(sender);
            const result = await chatSession.sendMessage(message, { useCache: true });
            const responseText = (await result.response.text())?.replaceAll('**', '') || "Maaf, aku belum paham maksud kamu.";

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

    sock.ev.on('creds.update', saveCreds);
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
        
            // Selalu periksa handleUserInteraction untuk menentukan respons
            const response = await handleUserInteraction(sender, messageContent);
        
            if (response) {
                // Jika handleUserInteraction menangani pesan, gunakan responsnya
                await sock.sendMessage(sender, { text: response });
            } else {
                // Jika tidak ada sesi ongkir, gunakan AI sebagai fallback
                await processMessage(messageContent, sender, quotedMsg);
            }
        } else if (messageType === 'imageMessage' && sender !== 'status@broadcast') {
            console.log('Cek sender', sender)

            // fungsi membaca pesan
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

connectToWhatsApp();