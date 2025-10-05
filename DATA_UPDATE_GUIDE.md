# Data Update Guide

This guide explains how to keep the exoplanet data up-to-date in the Celestia Web application.

## Overview

The web app displays a **"📡 Live Data"** badge and **"Last Updated"** timestamp to show users that the data is current and sourced from NASA's Kepler Mission Archive.

## Current Workflow

### Manual Update Process

1. **Run the Colab Notebook**
   - Open your Google Colab notebook that fetches Kepler data
   - Run all cells to generate fresh `koiData.json` and `koi_candidates.ssc`
   - Download the generated files

2. **Update Local Files**
   - Replace `koiData.json` in the project root
   - Replace `koi_candidates.ssc` in the project root (if using)

3. **Update Metadata**
   ```bash
   python update_metadata.py
   ```
   This automatically:
   - Counts planets in `koiData.json`
   - Updates `data_metadata.json` with current timestamp
   - Shows freshness indicators in the web app

4. **Commit Changes**
   ```bash
   git add koiData.json data_metadata.json
   git commit -m "Update Kepler data - $(date +%Y-%m-%d)"
   git push
   ```

## Data Freshness Indicators

The web app automatically shows:

### Visual Indicators
- **✅ Green Badge**: Data updated within last 7 days
- **⚠️ Orange Badge**: Data updated 7-30 days ago
- **⏰ Red Badge**: Data older than 30 days

### User Interface
- **Top-right badge**: Shows "📡 Live Data" button + "Last Updated" time
- **Click badge**: Opens modal with full data source information

## Automation Options

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/update-data.yml`:

```yaml
name: Update Exoplanet Data

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday at midnight
  workflow_dispatch:  # Allow manual trigger

jobs:
  update-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'

      - name: Install dependencies
        run: |
          pip install pandas numpy requests

      - name: Run data fetch script
        run: |
          python fetch_kepler_data.py  # Your Colab notebook as Python script

      - name: Update metadata
        run: python update_metadata.py

      - name: Commit changes
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "actions@github.com"
          git add koiData.json data_metadata.json
          git diff --quiet && git diff --staged --quiet || \
            git commit -m "Auto-update Kepler data [$(date +%Y-%m-%d)]"
          git push
```

**Benefits:**
- ✅ Fully automated
- ✅ Runs on schedule
- ✅ No manual intervention needed
- ✅ Free on GitHub

### Option 2: Convert Colab to Python Script

Convert your Colab notebook to a standalone Python script:

```python
# fetch_kepler_data.py
import pandas as pd
import requests
import json

def fetch_kepler_data():
    """Fetch latest Kepler data from NASA"""
    # Your Colab code here
    # ...

    # Save to JSON
    with open('koiData.json', 'w') as f:
        json.dump(planets_data, f, indent=2)

    print(f"✅ Successfully fetched {len(planets_data)} planets")

if __name__ == "__main__":
    fetch_kepler_data()
```

Then run locally:
```bash
python fetch_kepler_data.py
python update_metadata.py
```

### Option 3: Backend API (Advanced)

Create a simple backend that:
1. Fetches Kepler data on demand
2. Caches results for 24 hours
3. Serves data via API endpoint
4. Web app fetches from API instead of static files

## Metadata File Format

`data_metadata.json` structure:

```json
{
  "lastUpdated": "2025-01-15T10:30:00Z",
  "dataSource": "NASA Kepler Mission Archive",
  "totalPlanets": 4696,
  "updateFrequency": "Weekly",
  "dataVersion": "1.0",
  "generatedBy": "Kepler Data Processing Pipeline"
}
```

## Troubleshooting

### Badge shows "Data may be outdated"
- Run `python update_metadata.py` to refresh timestamp
- Or fetch new data from Colab

### Badge not appearing
- Check that `data_metadata.json` exists
- Check browser console for errors
- Verify files are in correct directory

### Planet count mismatch
- Ensure `koiData.json` is valid JSON
- Run `python update_metadata.py` to recount

## Best Practices

1. **Update Frequency**: Weekly or bi-weekly is recommended
2. **Version Control**: Always commit data updates with descriptive messages
3. **Testing**: Test locally before pushing to production
4. **Monitoring**: Check the badge periodically to ensure freshness

## Questions?

- Check if Colab notebook is running correctly
- Verify `koiData.json` format matches expected structure
- Review browser console for JavaScript errors
