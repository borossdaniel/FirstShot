FROM node:26.13.1-alpine3.24

WORKDIR /app

COPY package.json ./
COPY server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
