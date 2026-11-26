FROM python:3.15-slim

RUN useradd --create-home --shell /usr/sbin/nologin appuser
WORKDIR /app
COPY app.py .
USER appuser

EXPOSE 8000
CMD ["python", "app.py"]
