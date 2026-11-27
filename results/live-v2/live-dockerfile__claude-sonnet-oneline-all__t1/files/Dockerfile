# syntax=docker/dockerfile:1
FROM node:26-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
