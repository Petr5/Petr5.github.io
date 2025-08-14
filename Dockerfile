FROM node:20-alpine

WORKDIR /app

# Copy and install only server deps to avoid frontend peer conflicts
COPY server/package.json ./server/package.json
RUN cd server && npm ci --omit=dev || npm install --production

# Copy server source
COPY server ./server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]


