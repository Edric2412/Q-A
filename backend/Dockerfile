FROM python:3.12-slim

WORKDIR /app

# System dependencies for pdfplumber, tesseract, lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libxml2-dev \
    libxslt1-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ .

# Create temp and uploads directories
RUN mkdir -p temp uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
