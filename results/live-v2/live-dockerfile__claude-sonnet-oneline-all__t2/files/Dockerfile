FROM node:26.13.1-alpine3.24

ENV NODE_ENV=production

WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./

USER node

EXPOSE 3000

CMD ["node", "server.js"]
