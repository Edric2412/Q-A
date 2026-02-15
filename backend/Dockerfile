FROM python:3.12-slim

WORKDIR /app

# System dependencies for pdfplumber, tesseract, lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libxml2-dev \
    libxslt1-dev \
    poppler-utils \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Pre-install CPU-only torch to save space/time
RUN pip install --default-timeout=1000 torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Copy application code
COPY app/ .

# Create temp and uploads directories
RUN mkdir -p temp uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
