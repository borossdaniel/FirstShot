FROM python:3.14-slim

RUN useradd --create-home --shell /usr/sbin/nologin appuser

WORKDIR /app

COPY app.py .

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["python3", "app.py"]
