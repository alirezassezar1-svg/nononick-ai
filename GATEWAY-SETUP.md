# NONONICK AI — Secure Gateway

The frontend is static HTML. The AI key stays server-side.

## Architecture

Browser → /api/chat → OpenRouter

The OpenRouter key is read only from `process.env.OPENROUTER_API_KEY`.

## Deploy

This repository is currently also published through GitHub Pages. GitHub Pages can serve the static `index.html`, but it does not execute the Node/Vercel API function.

For the real AI gateway, import this repository into Vercel and deploy it. Vercel automatically exposes `api/chat.js` as `/api/chat`.

Then add these environment variables in Vercel:

- `OPENROUTER_API_KEY` — your secret OpenRouter key
- `NONONICK_MODEL` — optional; defaults to `openrouter/free`
- `ALLOWED_ORIGIN` — set to the exact frontend origin

After deployment, if the frontend remains on GitHub Pages, set the gateway URL in the browser console once:

`localStorage.setItem("nononick-ai-gateway","https://YOUR-VERCEL-DOMAIN.vercel.app/api/chat")`

Then reload NONONICK AI.

For a final production setup, host the frontend and gateway under the same Vercel project/domain so the frontend can use the default relative `/api/chat` endpoint and no cross-origin configuration is needed.

## Security

Never put `OPENROUTER_API_KEY` inside HTML, JavaScript, GitHub Pages, or any `NEXT_PUBLIC_` variable.
