FROM python:3.13-slim

RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY --chown=app:app app.py .

USER app

EXPOSE 8000

CMD ["python", "app.py"]
