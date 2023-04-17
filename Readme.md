# OpenAI API App

This project is a chat interface that uses the OpenAI API to generate responses to user input. The project is built using React and TypeScript and supports streaming API responses. The user can input text into the chat, and the OpenAI API will generate a response to the user's message.

## Installation

1. Clone the repository.
1. Install dependencies using `npm install`.
1. Create an OpenAI account and obtain an API key.
1. Create a `.env` file and add the following line to it: `VITE_OPEN_AI_KEY=YOUR_OPEN_AI_API_KEY`.
1. Start the development server using `npm start`.

## Usage

- The project is opened automatically in your web browser with `npm start`.
- Type a message in the chat input box and press enter.
- The OpenAI API will generate a response to the user's message and display it in the chat.

## Features

- supports streaming API responses (vie `server-sent events`)
- code syntax highlighting and copy code snippets to the clipboard
- cancal the response stream
- reset the messages context
- displays additional meta data for each response

## Contributing

Contributions to this project are welcome. Please open an issue or pull request if you find a bug or have a feature request.
