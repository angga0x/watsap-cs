# WhatsApp Bot with Gemini AI

This is a WhatsApp bot that uses Gemini AI to process messages. The bot listens for messages, checks if there's a user interaction handler, and if not, uses AI to generate a response.

## Features

- Processes text messages using Gemini AI
- Handles user interactions
- Can process image messages with captions

## Setup

1.  Install dependencies:

    ```bash
    npm install
    ```

2.  Set up the .env file with the necessary environment variables, including the Gemini API key.

3.  Run the bot:

    ```bash
    node main.js
    ```

## Usage

Send messages to the WhatsApp bot, and it will respond using Gemini AI. You can also send image messages with captions.

## Important Files

- `.env`: This file contains the environment variables, including the Gemini API key.
- `main.js`: This is the main file that runs the bot.
- `helpers/helpers.js`: This file contains helper functions.
- `Middleware/gemini.js`: This file contains the Gemini AI middleware.
- `data/chat_history.json`: This file contains the chat history.

## Author

Angga0x
