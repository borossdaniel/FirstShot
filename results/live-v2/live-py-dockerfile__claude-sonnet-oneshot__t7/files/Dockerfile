FROM python:3.15-slim

RUN useradd --create-home --uid 1000 appuser
WORKDIR /app
COPY app.py .
USER appuser

EXPOSE 8000
CMD ["python", "app.py"]
