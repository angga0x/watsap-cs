# WhatsApp Customer Service Bot

A WhatsApp bot powered by Google's Gemini AI that helps manage customer service interactions, including:
- Product inquiries
- Order processing
- Payment confirmations
- Shipping cost calculations

## Features

- 🤖 AI-powered responses using Gemini AI
- 💬 Natural conversation handling
- 💳 Automatic bank transfer information
- 📦 Shipping cost calculator
- 🖼️ Image processing capability
- 💾 Chat history tracking

## Prerequisites

- Node.js v14 or higher
- WhatsApp account
- Google Gemini API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/angga0x/whatsai-cs.git
cd whatsai-cs
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
GEMINI_API=your_gemini_api_key
```

4. Configure bank information in `data/bank.json`

## Usage

Start the bot:
```bash
node main.js
```

Scan the QR code with WhatsApp to connect.

## Configuration

- Edit `bank.json` to update payment information
- Modify keywords in `main.js` to customize trigger words
- Adjust AI prompt in system instructions for different responses

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Angga0x
