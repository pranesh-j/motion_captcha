from flask import Flask, render_template, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
import logging
import os

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__,
            template_folder='templates',
            static_folder='static')

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8080')


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/proxy/generate', methods=['GET'])
@limiter.limit("30 per minute")
def generate_proxy():
    try:
        logger.debug("Sending generate request to backend")
        response = requests.get(f"{BACKEND_URL}/generate")
        logger.debug(f"Generate response: {response.text}")
        return jsonify(response.json()), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Generate error: {str(e)}")
        return jsonify({"error": str(e)}), 503

@app.route('/proxy/validate', methods=['POST', 'OPTIONS'])
@limiter.limit("30 per minute")
def validate_proxy():
    if request.method == 'OPTIONS':
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    try:
        logger.debug(f"Validate request data: {request.get_json()}")

        response = requests.post(f"{BACKEND_URL}/validate", json=request.get_json())

        logger.debug(f"Validate response: Status {response.status_code}, Body: {response.text}")
        
        return jsonify(response.json()), response.status_code
    except requests.exceptions.RequestException as e:
        logger.error(f"Validate error: {str(e)}")
        return jsonify({"error": str(e)}), 503

if __name__ == '__main__':
    app.run(debug=True)