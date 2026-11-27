# syntax=docker/dockerfile:1
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

# The official node image already ships an unprivileged "node" user (uid/gid 1000).
USER node

EXPOSE 3000

CMD ["node", "server.js"]
