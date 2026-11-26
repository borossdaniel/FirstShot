FROM python:3.15-slim
WORKDIR /app
COPY app.py .
RUN useradd -m app
USER app
EXPOSE 8000
CMD ["python", "app.py"]
