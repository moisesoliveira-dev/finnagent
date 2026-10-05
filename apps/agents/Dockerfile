FROM python:3.12-slim

WORKDIR /app

COPY apps/agents /app

EXPOSE 8000

CMD ["sh", "-c", "python -m http.server \"$PORT\" --bind 0.0.0.0"]