FROM python:3.15-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --no-create-home app

COPY app.py .

RUN chown -R app:app /app

USER app

EXPOSE 8000

CMD ["python", "app.py"]
