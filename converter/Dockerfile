FROM python:3.11-slim

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY converter.py .
COPY wait-for-services.sh /wait-for-services.sh
RUN chmod +x /wait-for-services.sh

ENTRYPOINT ["/bin/bash", "/wait-for-services.sh"]
CMD ["python", "converter.py"]