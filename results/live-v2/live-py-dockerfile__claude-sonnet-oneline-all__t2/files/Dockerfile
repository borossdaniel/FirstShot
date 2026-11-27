FROM python:3.14.7-slim

RUN useradd --create-home --uid 10001 appuser
WORKDIR /app
COPY app.py .
USER appuser

EXPOSE 8000
CMD ["python", "app.py"]
