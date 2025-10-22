from flask import Flask, request, jsonify
from flask_cors import CORS
from googletrans import Translator
import socket
import sys
import logging
import psutil
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Update port range
PORTS = list(range(5002, 5010))  # Try ports 5002-5009

def cleanup_ports():
    """Kill processes using our port range"""
    for proc in psutil.process_iter(['pid', 'name', 'connections']):
        try:
            for conn in proc.info['connections']:
                if conn.laddr.port in PORTS:
                    logger.info(f"Killing process {proc.info['pid']} using port {conn.laddr.port}")
                    psutil.Process(proc.info['pid']).kill()
                    time.sleep(0.1)  # Give OS time to release port
        except (psutil.NoSuchProcess, psutil.AccessDenied, KeyError):
            pass

# Global translator instance
translator = None

# Initialize translator with retries
def get_translator():
    for _ in range(3):
        try:
            return Translator()
        except Exception as e:
            logger.warning(f"Failed to initialize translator: {e}, retrying...")
            time.sleep(1)
    raise RuntimeError("Failed to initialize translator after 3 attempts")

def ensure_translator():
    global translator
    if translator is None:
        translator = get_translator()
    return translator

try:
    translator = get_translator()
except Exception as e:
    logger.error(f"Could not initialize translator: {e}")
    sys.exit(1)

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://localhost:3003", "http://localhost:3004"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": True
    }
})

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = request.origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.after_request
def after_request(response):
    return add_cors_headers(response)

@app.route('/', methods=['GET'])
def root():
    return jsonify({"status": "ok"})

@app.route('/detect', methods=['POST'])
def detect_language():
    try:
        data = request.get_json(force=True)
        text = data.get('q', '').strip()
        
        if not text:
            return jsonify([])
        
        logger.debug(f"Detecting language for: {text[:100]}")
        detection = translator.detect(text)
        logger.info(f"Detected language: {detection.lang}")
        
        return jsonify([{
            "language": detection.lang,
            "confidence": detection.confidence
        }])
    except Exception as e:
        logger.exception("Detection error")
        return jsonify({"error": str(e)}), 500

class TranslationError(Exception):
    pass

def translate_with_retry(text, source, target, max_retries=3):
    global translator
    last_error = None
    
    for attempt in range(max_retries):
        try:
            if translator is None:
                translator = get_translator()
                
            translation = translator.translate(
                text,
                src='auto' if source == 'auto' else source,
                dest=target
            )
            
            if translation and translation.text:
                return translation
                
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Translation attempt {attempt + 1} failed: {e}")
            translator = None  # Force reinit on next attempt
            time.sleep(1)  # Wait before retry
            
    raise TranslationError(f"Translation failed after {max_retries} attempts: {last_error}")

@app.route('/translate', methods=['POST'])
def translate():
    try:
        data = request.get_json(force=True)
        text = data.get('q', '').strip()
        source = data.get('source', 'auto')
        target = data.get('target', 'en')

        if not text:
            return jsonify({"translatedText": ""})

        logger.info(f"Translation request: {source}->{target} [{len(text)} chars]")
        
        translation = translate_with_retry(text, source, target)
        
        response = jsonify({
            "translatedText": translation.text,
            "src": translation.src,
            "dest": translation.dest
        })
        logger.info(f"Translation successful [{translation.src}->{translation.dest}]")
        return add_cors_headers(response)
        
    except TranslationError as e:
        response = jsonify({"error": "Translation service unavailable"})
        return add_cors_headers(response), 503
    except Exception as e:
        response = jsonify({"error": str(e)})
        return add_cors_headers(response), 500

if __name__ == '__main__':
    cleanup_ports()  # Clean up ports before starting
    
    # Find available port
    port = None
    for test_port in PORTS:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', test_port))
                port = test_port
                break
        except OSError as e:
            logger.warning(f"Port {test_port} is in use: {e}")
            continue
    
    if port is None:
        logger.error(f"Could not find an available port in range {PORTS}")
        sys.exit(1)
    
    logger.info(f"Starting translator server on port {port}")
    app.run(host='127.0.0.1', port=port, debug=True)
