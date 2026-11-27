FROM node:26-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./

RUN chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "server.js"]
