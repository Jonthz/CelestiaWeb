import pandas as pd
import numpy as np
import urllib.parse
import os
import pickle
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
from sklearn.model_selection import train_test_split

# ==========================================
# CONSTANTS
# ==========================================
MODEL_DIR = os.path.join(os.path.dirname(__file__), '..', 'model')
MODEL_PATH = os.path.join(MODEL_DIR, 'habitable_model.keras')
DATA_PATH = os.path.join(MODEL_DIR, 'planet_features.pkl')
RAW_DATA_PATH = os.path.join(MODEL_DIR, 'kepler_raw.csv')

def set_global_seed(seed=42):
    os.environ['PYTHONHASHSEED'] = str(seed)
    import random
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)
    print(f"Global seed set to: {seed}")

def download_data():
    print("=" * 80)
    print("DOWNLOADING NASA DATASET")
    print("=" * 80)
    
    # Query from the notebook
    query = """
    SELECT
        kepid, kepoi_name, koi_disposition, koi_period, koi_time0bk, koi_time0, koi_impact, koi_duration, 
        koi_depth, koi_ror, koi_srho, koi_fittype, koi_prad, koi_sma, koi_incl, koi_teq, koi_insol, 
        koi_dor, koi_ldm_coeff1, koi_ldm_coeff2, koi_parm_prov, koi_period_err1, koi_period_err2, 
        koi_time0bk_err1, koi_time0bk_err2, koi_impact_err1, koi_impact_err2, koi_duration_err1, 
        koi_duration_err2, koi_depth_err1, koi_depth_err2, koi_ror_err1, koi_ror_err2, koi_srho_err1, 
        koi_srho_err2, koi_prad_err1, koi_prad_err2, koi_dor_err1, koi_dor_err2, koi_max_sngle_ev, 
        koi_max_mult_ev, koi_model_snr, koi_count, koi_num_transits, koi_steff, koi_slogg, koi_smet, 
        koi_srad, koi_smass, koi_sparprov, koi_steff_err1, koi_steff_err2, koi_slogg_err1, koi_slogg_err2, 
        koi_smet_err1, koi_smet_err2, koi_srad_err1, koi_srad_err2, koi_smass_err1, koi_smass_err2, 
        ra, dec, koi_kepmag, koi_gmag, koi_rmag, koi_imag, koi_zmag, koi_jmag, koi_hmag, koi_kmag, 
        ra_err, dec_err, koi_kepmag_err, koi_gmag_err, koi_rmag_err, koi_imag_err, koi_zmag_err, 
        koi_jmag_err, koi_hmag_err, koi_kmag_err, koi_fwm_sra, koi_fwm_sdec, koi_fwm_srao, 
        koi_fwm_sdeco, koi_fwm_prao, koi_fwm_pdeco, koi_fwm_stat_sig, koi_dicco_mra, koi_dicco_mdec, 
        koi_dicco_msky, koi_dikco_mra, koi_dikco_mdec, koi_dikco_msky
    FROM cumulative
    """
    
    query_encoded = urllib.parse.quote(query)
    base_url = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query="
    full_url = f"{base_url}{query_encoded}&format=csv"
    
    try:
        if os.path.exists(RAW_DATA_PATH):
            print(f"Loading cached data from {RAW_DATA_PATH}")
            df = pd.read_csv(RAW_DATA_PATH)
        else:
            print("Downloading from NASA Exoplanet Archive...")
            df = pd.read_csv(full_url)
            if not os.path.exists(MODEL_DIR):
                os.makedirs(MODEL_DIR)
            df.to_csv(RAW_DATA_PATH, index=False)
            
        print(f"Data loaded! Shape: {df.shape}")
        return df
    except Exception as e:
        print(f"Error downloading data: {e}")
        return None

def process_data(df):
    print("\nPROCESSING DATA")
    
    # Redundant columns identified in the notebook analysis
    cols_redundant = [
        'koi_time0', 'koi_ror', 'koi_dor',
        'koi_period_err2', 'koi_time0bk_err2', 'koi_duration_err2',
        'koi_depth_err2', 'koi_ror_err1', 'koi_ror_err2',
        'koi_prad_err2', 'koi_dor_err1', 'koi_dor_err2',
        'koi_rmag', 'koi_hmag', 'koi_kmag'
    ]
    
    # Keep ID for lookups later, but drop for X
    # We will index by kepoi_name to retrieve features later
    
    # 1. Clean Target
    # Map disposition: CONFIRMED/CANDIDATE = 1 (Planet), FALSE POSITIVE = 0 (Not Planet)
    # The notebook mapped CANDIDATE=1 as well in block 2, though block 1 output showed it only mapping CONFIRMED.
    # Let's follow the notebook's Logic Regression block style which might be more permissive or strict? 
    # Actually cell 2 says: y = df['koi_disposition'].map({'FALSE POSITIVE': 0, 'CONFIRMED': 1, 'CANDIDATE': 1})
    # This treats candidates as planets for training.
    
    df['target'] = df['koi_disposition'].map({'FALSE POSITIVE': 0, 'CONFIRMED': 1, 'CANDIDATE': 1})
    
    # Drop rows where target is NaN (if any)
    df = df.dropna(subset=['target'])
    
    # 2. Prepare Feature Lookup Dataframe (include ID)
    # We remove 'koi_disposition', 'kepid' (use name as ID), and redundant cols
    cols_to_drop = ['kepid', 'koi_disposition'] + cols_redundant
    
    # Drop columns that are not in df (safety check)
    cols_to_drop = [c for c in cols_to_drop if c in df.columns]
    
    df_clean = df.drop(columns=cols_to_drop)
    
    # Set Index to kepoi_name for easy lookup
    if 'kepoi_name' in df_clean.columns:
        df_clean.set_index('kepoi_name', inplace=True)
    
    # Fill NAs
    df_clean = df_clean.fillna(0)
    
    # One-Hot Encoding for categorical columns
    # The notebook finds: koi_fittype, koi_parm_prov, koi_sparprov
    df_encoded = pd.get_dummies(df_clean, drop_first=True)
    
    print(f"Processed data shape: {df_encoded.shape}")
    
    # Verify we have the target separate
    Y = df['target']
    # Align Y with df_encoded (in case indexing changed order, though it shouldn't)
    # Y needs to correspond to the rows in df_encoded
    # Since we set index on df_clean, we should verify index alignment
    Y.index = df['kepoi_name']
    
    return df_encoded, Y

def build_model(input_shape):
    print(f"\nBUILDING MODEL (Input Shape: {input_shape})")
    
    model = keras.Sequential([
        keras.Input(shape=(input_shape,)),
        
        # Consistent with notebook architecture
        layers.Dense(512),
        layers.BatchNormalization(),
        layers.Activation('relu'),
        
        layers.Dense(256),
        layers.BatchNormalization(),
        layers.Activation('relu'),
        layers.Dropout(0.3),
        
        layers.Dense(128),
        layers.BatchNormalization(),
        layers.Activation('relu'),
        layers.Dropout(0.4),
        
        layers.Dense(64),
        layers.BatchNormalization(),
        layers.Activation('relu'),
        layers.Dropout(0.5),
        
        layers.Dense(1, activation='sigmoid')
    ])
    
    optimizer = keras.optimizers.Adam(learning_rate=0.001)
    
    model.compile(
        loss='binary_crossentropy',
        optimizer=optimizer,
        metrics=['accuracy', keras.metrics.Precision(name='precision'), keras.metrics.Recall(name='recall')]
    )
    
    return model

def main():
    set_global_seed()
    
    # 1. Get Data
    df_raw = download_data()
    if df_raw is None:
        return
    
    # 2. Process
    X, y = process_data(df_raw)
    
    # 3. Save Feature Database (X) for Server Lookup
    # This allows server to look up X.loc["K00753.01"] -> get feature vector -> predict
    print(f"Saving feature database to {DATA_PATH}...")
    with open(DATA_PATH, 'wb') as f:
        pickle.dump(X, f)
    
    # 4. Train Model
    print("\nTRAINING MODEL")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = build_model(X_train.shape[1])
    
    early_stopping = callbacks.EarlyStopping(
        monitor='val_loss', 
        patience=10, 
        restore_best_weights=True,
        verbose=1
    )
    
    history = model.fit(
        X_train, y_train,
        epochs=50, # Notebook used 100, 50 is likely enough for quick demo
        batch_size=32,
        validation_split=0.2,
        callbacks=[early_stopping],
        verbose=1
    )
    
    # 5. Evaluate
    print("\nEVALUATION")
    loss, acc, prec, rec = model.evaluate(X_test, y_test)
    print(f"Test Accuracy: {acc:.4f}")
    print(f"Test Precision: {prec:.4f}")
    print(f"Test Recall: {rec:.4f}")
    
    # 6. Save Model
    print(f"Saving model to {MODEL_PATH}...")
    model.save(MODEL_PATH)
    print("DONE")

if __name__ == "__main__":
    main()
