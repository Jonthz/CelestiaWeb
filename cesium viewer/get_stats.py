import pandas as pd
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import json

filename_true = 'cumulative_2025.10.01_20.20.34.csv'
filename_pred = 'results.csv'

# Load data
df_true = pd.read_csv(filename_true, comment='#')
df_pred = pd.read_csv(filename_pred, comment='#')

# Merge true labels with predictions
df = pd.merge(
    df_true[['kepid', 'koi_disposition']], 
    df_pred[['kepid', 'koi_disposition_pred']],
    on='kepid', how='inner'
)

# Map labels to 0/1
df['y_true'] = df['koi_disposition'].map({'FALSE POSITIVE': 0, 'CONFIRMED': 1})
df['y_pred'] = df['koi_disposition_pred'].map({'FALSE POSITIVE': 0, 'CONFIRMED': 1})

# Count rows with missing labels
num_missing = df['y_true'].isna().sum() + df['y_pred'].isna().sum()
if num_missing > 0:
    print(f"Warning: {num_missing} rows have missing labels and will be excluded from metrics.")

# Remove rows with NaN in y_true or y_pred
df = df.dropna(subset=['y_true', 'y_pred'])

# Calculate metrics
acc = accuracy_score(df['y_true'], df['y_pred'])
prec = precision_score(df['y_true'], df['y_pred'])
rec = recall_score(df['y_true'], df['y_pred'])
f1 = f1_score(df['y_true'], df['y_pred'])

metrics = {"accuracy": acc, "precision": prec, "recall": rec, "f1_score": f1}
with open("metrics.json", "w") as f:
    json.dump(metrics, f, indent=4)

print("Metrics saved to metrics.json")
print(f"Evaluation performed on {len(df)} rows.")
