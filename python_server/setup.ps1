# Remove existing venv if it exists
if (Test-Path "venv") {
    Remove-Item -Recurse -Force "venv"
}

# Create fresh venv
python -m venv venv

# Activate venv and install dependencies
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi==0.104.1
pip install "uvicorn[standard]"==0.24.0
pip install deep-translator==1.11.4
pip install langdetect==1.0.9
pip install pydantic==2.5.1

# Run the server
python app.py
