const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const generationConfig = {
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
};

const chatSessions = new Map();
const ongkirSessions = new Map();

async function getChatSession(sender) {
    if (!chatSessions.has(sender)) {
        const chatSession = model.startChat({
            generationConfig,
            history: [{ role: "user", parts: [{ text: "Kamu adalah CS Clara. Gunakan bahasa yang ramah dan friendly." }] }]
        });
        chatSessions.set(sender, chatSession);
    }
    return chatSessions.get(sender);
}

async function getDistrict(keyword) {
    try {
        const response = await axios.get(`https://api.orderonline.id/shipping/complete_district`, {
            params: {
                get_complete_data: 1,
                keyword,
                page: 1
            },
            headers: { 'Accept': '*/*', 'User-Agent': 'Mozilla/5.0' }
        });

        const data = response.data.data;
        if (!data || data.length === 0) return "Data tidak ditemukan.";

        return data.map((item, index) => `${index + 1}. ${item.subdistrict_name}, ${item.city_name_with_type}, ${item.subdistrict_id}`).join("\n");
    } catch (err) {
        console.error("Error fetching district:", err);
        return "Terjadi kesalahan saat mencari kecamatan.";
    }
}

async function cekOngkir(subdistrict_id) {
    try {
        const requestData = {
            origin: JSON.stringify({ id: 6287, type: 'subdistrict', subdistrict_name: 'Pasar Kemis' }),
            destination: JSON.stringify({ id: subdistrict_id, type: 'subdistrict' }),
            couriers: JSON.stringify(['jne', 'jnt', 'idexpress']),
            product: JSON.stringify({ weight: 1000 }),
            mode: 'normal',
            payment_method: 'bank_transfer',
            volume: JSON.stringify({ width: 0, height: 0, length: 0 })
        };

        const response = await axios.post('https://api.orderonline.id/shipping/cost', querystring.stringify(requestData), {
            headers: { 'Accept': '*/*', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }
        });

        const data = response.data;
        if (!data || !data.data || data.data.length === 0) return "Tidak ada data ongkir yang ditemukan.";

        return data.data.map(courier => ({
            courier_name: courier.name,
            services: courier.costs.map(cost => ({
                service: cost.service,
                cost: cost.cost[0]?.value || 0,
                etd: cost.cost[0]?.etd || '-'
            }))
        }));
    } catch (err) {
        console.error("Error checking shipping cost:", err);
        return "Terjadi kesalahan saat cek ongkir.";
    }
}

async function formatOngkirResponse(ongkirData, sender) {
    if (!ongkirData || ongkirData.length === 0) {
        return "Maaf, tidak ada data ongkir yang tersedia.";
    }

    let response = "📦 Berikut adalah estimasi ongkir:\n";

    ongkirData.forEach(courier => {
        response += `\n🚚 ${courier.courier_name}:\n`;
        courier.services.forEach(service => {
            const price = service.cost ? `Rp${service.cost.toLocaleString()}` : "N/A";
            response += `   - ${service.service}: ${price}, Estimasi: ${service.etd} hari\n`;
        });
    });

    const chatSession = await getChatSession(sender);
    const aiResponse = await chatSession.sendMessage(`Kirim hasil cek ongkir dengan emoticon\n\n${response}`);
    return aiResponse.response.text()


}

async function handleUserInteraction(sender, userMessage) {
    const chatSession = await getChatSession(sender);
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("ongkir")) {
        ongkirSessions.set(sender, { step: 1 })

        const aiResponse = await chatSession.sendMessage("Minta user untuk memasukkan nama kecamatan")
        return aiResponse.response.text()
    }

    if (ongkirSessions.has(sender)) {
        const session = ongkirSessions.get(sender)

        if (session.step === 1) {
            // const kecamatanResponse = await chatSession.sendMessage('Tulis ulang nama kecamatan ini dan kirim ke saya lagi' + userMessage)
            // console.log(kecamatanResponse.response.text())

            // await delay(10000)

            let district_name = userMessage.trim()

            if (district_name.toLowerCase().includes('kecamatan')) {
                district_name = district_name.replace(/kecamatan\s*/i, '').trim()
            }

            const districtList = await getDistrict(district_name)
            if (districtList === "Data tidak ditemukan.") {
                const aiResponse = await chatSession.sendMessage("Kecamatan tidak ditemukan. Minta user menginput ulang");
                return aiResponse.response.text()
            }

            const districts = districtList.split("\n");

            if (districts.length === 1) {
                const subdistrictId = districts[0].split(", ").pop();
                const ongkirResult = await cekOngkir(parseInt(subdistrictId));

                ongkirSessions.delete(sender);
                return formatOngkirResponse(ongkirResult, sender);
            }

            session.step = 2;
            session.districts = districts;
            ongkirSessions.set(sender, session);

            const aiResponse = await chatSession.sendMessage(`Beri user pilhan list kecamatan dan minta untuk memilih dengan angka\n${districtList}`)
            console.log(districtList)
            return aiResponse.response.text();
        }

        if (session.step === 2) {
            if (!userMessage.match(/^\d+$/)) {
                ongkirSessions.delete(sender);
                const aiResponse = await chatSession.sendMessage("Input tidak valid. Mohon masukkan angka dari daftar.");
                return aiResponse.response.text();
            }

            const index = parseInt(userMessage) - 1;
            if (isNaN(index) || index < 0 || index >= session.districts.length) {
                const aiResponse = await chatSession.sendMessage("Pilihan tidak valid. Silakan pilih angka yang tersedia.");
                return aiResponse.response.text();
            }

            const subdistrictId = session.districts[index].split(", ").pop();
            const ongkirResult = await cekOngkir(parseInt(subdistrictId));

            ongkirSessions.delete(sender);
            return formatOngkirResponse(ongkirResult, sender);
        }
    }

    // const aiResponse = await chatSession.sendMessage(userMessage);
    // return aiResponse.response.text();
}

module.exports = { getDistrict, cekOngkir, handleUserInteraction };
