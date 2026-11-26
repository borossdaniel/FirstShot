FROM node:26-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./

# node:alpine ships a non-root "node" user (uid/gid 1000) out of the box.
USER node

EXPOSE 3000

CMD ["node", "server.js"]
