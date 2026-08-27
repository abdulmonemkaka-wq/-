# Meneimay Chat

A single-file Arabic/English chat interface, powered securely by Google Gemini on Vercel.

## Run locally

1. Install the [Vercel CLI](https://vercel.com/docs/cli), then run `vercel dev`.
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to your key from Google AI Studio.
3. Open the local address Vercel displays.

## Deploy on Vercel

1. Upload this project to a new GitHub repository.
2. Import that repository in Vercel.
3. In **Settings → Environment Variables**, add `GEMINI_API_KEY` with your Google AI Studio key. Optionally add `GEMINI_MODEL`.
4. Deploy.

Never place the API key in `index.html` or in a GitHub commit. The browser calls `/api/chat`; that server endpoint keeps the key private and calls Gemini with the `x-goog-api-key` header, as described in Google's Gemini API documentation.

The chat history stays only in the visitor's browser via local storage. The market-research mode asks Gemini to use Google Search grounding, when that capability is available to your Gemini account/model.
