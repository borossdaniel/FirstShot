FROM node:26-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

CMD ["node", "server.js"]
