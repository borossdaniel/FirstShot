# syntax=docker/dockerfile:1
FROM node:26-alpine3.24

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# node:26-alpine3.24 already ships an unprivileged "node" user (uid/gid 1000)
USER node

EXPOSE 3000

CMD ["node", "server.js"]
