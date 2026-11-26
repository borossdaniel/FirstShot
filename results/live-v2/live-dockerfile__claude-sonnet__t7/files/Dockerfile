FROM node:24-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

RUN groupadd --system app && useradd --system --gid app --no-create-home app \
    && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "server.js"]
