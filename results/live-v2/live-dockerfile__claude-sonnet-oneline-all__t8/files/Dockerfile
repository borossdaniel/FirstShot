FROM node:26.13.1-alpine3.24

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

CMD ["node", "server.js"]
