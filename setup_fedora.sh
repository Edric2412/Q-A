#!/bin/bash
set -e

echo "Starting project setup for Fedora 43..."

# 1. Install System Dependencies required for compiling some python packages
# requires sudo privileges
echo "Installing system dependencies (gcc-c++, libxml2-devel, python3-devel)..."
sudo dnf install -y gcc-c++ libxml2-devel python3-devel

# 2. Create Virtual Environment
echo "Creating virtual environment 'venv_fedora'..."
python3 -m venv venv_fedora

# 3. Activate and Install Python Dependencies
echo "Activating virtual environment and installing dependencies..."
source venv_fedora/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "Setup complete! You can run the project using:"
echo "source venv_fedora/bin/activate"
echo "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
