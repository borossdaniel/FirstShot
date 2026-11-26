FROM node:26.13.1-slim

WORKDIR /app

COPY package.json ./
COPY server.js ./

RUN groupadd --system app && useradd --system --gid app --no-create-home app \
    && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "server.js"]
