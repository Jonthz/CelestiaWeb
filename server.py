#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import os
import json
import pickle
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras

# ==========================================
# CONFIGURATION
# ==========================================
PORT = 8094
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'habitable_model.keras')
DATA_PATH = os.path.join(MODEL_DIR, 'planet_features.pkl')

# Global variables for model and data
model = None
planet_features = None

def load_ai_assets():
    global model, planet_features
    print("Loading AI Assets...")
    
    # Load Model
    if os.path.exists(MODEL_PATH):
        try:
            model = keras.models.load_model(MODEL_PATH)
            print(f"Model loaded from {MODEL_PATH}")
        except Exception as e:
            print(f"Error loading model: {e}")
    else:
        print(f"Model file not found at {MODEL_PATH}. Prediction API will fail.")

    # Load Data
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, 'rb') as f:
                planet_features = pickle.load(f)
            print(f"Feature database loaded from {DATA_PATH} ({len(planet_features)} planets)")
        except Exception as e:
            print(f"Error loading data: {e}")
    else:
        print(f"Data file not found at {DATA_PATH}. Prediction API will fail.")

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        if self.path == '/list_planets':
            self.handle_list_planets()
        else:
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        # Handle API requests
        if self.path == '/predict':
            self.handle_predict()
        else:
            self.send_error(404, "Not Found")

    def handle_predict(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            planet_id = data.get('planet_id')
            
            if not planet_id:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing planet_id'}).encode())
                return

            if model is None or planet_features is None:
                self.send_response(503)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'AI Model not ready'}).encode())
                return

            # Lookup Planet Features
            # Try exact match first, then fuzzy?
            # The visualization might use "Kepler-22b" but the index is "K00087.01" (for example)
            # Or visualization uses KOI IDs?
            # 
            # If the visualization sends the Name ("Kepler-22b") and our index is by KOI Name ("K00087.01"), 
            # we might have a mismatch.
            # However, `train_model.py` saved the index as `kepoi_name`.
            # Let's hope the frontend sends the kepoi_name or we might need a mapping.
            # For now, assume exact ID match or frontend handles mapping.
            
            if planet_id not in planet_features.index:
                # Try adding 'K' preamble if missing e.g. "00753.01" -> "K00753.01"
                alt_id = f"K{planet_id}" if not planet_id.startswith('K') else planet_id
                if alt_id not in planet_features.index:
                     self.send_response(404)
                     self.end_headers()
                     self.wfile.write(json.dumps({'error': f'Planet {planet_id} not found in database'}).encode())
                     return
                planet_id = alt_id

            # Get features
            features = planet_features.loc[[planet_id]]
            
            # Predict
            # Keras model expects numpy array or dataframe.
            # features is a DataFrame with 1 row.
            prediction = model.predict(features, verbose=0)
            score = float(prediction[0][0])
            
            # Get key feature values for display
            # We'll pick a few interesting ones available in the dataframe
            # insol = insolation flux? (koi_insol)
            # prad = radius? (koi_prad)
            # teq = equilibrium temp? (koi_teq)
            
            # Need to check if they exist in encoded df.
            # train_model.py dropped redundant cols but kept most.
            # One-hot encoding might have shifted names but numericals stay.
            
            feature_summary = {}
            for col in ['koi_insol', 'koi_prad', 'koi_teq', 'koi_period']:
                if col in features.columns:
                    feature_summary[col] = float(features[col].iloc[0])

            response = {
                'planet_id': planet_id,
                'habitability_score': score,
                'is_habitable_candidate': score > 0.5,
                'features': feature_summary
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error processing prediction: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def handle_list_planets(self):
        if planet_features is None:
            self.send_response(503)
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Data not loaded'}).encode())
            return
            
        try:
            # Get a sample of 50 planets to list
            # We want to return ID and some basic cols if available
            sample = planet_features.sample(50) if len(planet_features) > 50 else planet_features
            
            planets_list = []
            for idx, row in sample.iterrows():
                # idx is kepoi_name (e.g., K00753.01)
                
                # Extract some info for the table
                insol = row.get('koi_insol', 0)
                prad = row.get('koi_prad', 0)
                teq = row.get('koi_teq', 0)
                period = row.get('koi_period', 0)
                
                planets_list.append({
                    'id': idx,
                    'insol': float(insol),
                    'prad': float(prad),
                    'teq': float(teq),
                    'period': float(period)
                })
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(planets_list).encode())
            
        except Exception as e:
            print(f"Error listing planets: {e}")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

def start_server():
    load_ai_assets()
    
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Celestia Web Server running at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        
        # Open browser automatically
        # webbrowser.open(f'http://localhost:{PORT}')
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    start_server()