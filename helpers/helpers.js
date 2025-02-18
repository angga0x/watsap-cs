function formatOngkirResponse(ongkirData) {
    if (!ongkirData || ongkirData.length === 0) {
        return "Maaf, tidak ada data ongkir yang tersedia.";
    }

    let response = "Berikut adalah estimasi ongkir:\n";
    ongkirData.forEach((item, index) => {
        response += `${index + 1}. ${item.courier}: Rp${item.price.toLocaleString()} (${item.service})\n`;
    });

    return response;
}
