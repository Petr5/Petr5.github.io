## Chess server (optional, for online turns persistence)

Local run:

1. Install deps: `npm i`
2. Run server: `npm run server` (default http://localhost:3000)
3. In `.env` set `VITE_API_BASE=http://localhost:3000`
4. Run client: `npm run dev`

Deploying client on GitHub Pages does not deploy the server. Host the server separately (VPS/Render/Fly.io/etc.) and set `VITE_API_BASE` to its URL before `npm run deploy`.

## To start the local development server:
1. npm install
2. npm run dev

## To start the production server:
1. npm run build
2. npm run preview -- --host 0.0.0.0