FROM python:3.15-slim

RUN useradd --create-home --shell /usr/sbin/nologin appuser

WORKDIR /app
COPY --chown=appuser:appuser app.py .

USER appuser

EXPOSE 8000

CMD ["python3", "app.py"]
