FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
