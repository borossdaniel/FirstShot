FROM node:26-alpine

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
