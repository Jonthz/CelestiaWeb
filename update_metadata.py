#!/usr/bin/env python3
"""
Update data_metadata.json with current timestamp and planet count.
Run this script after generating new koiData.json from the Colab notebook.
"""

import json
from datetime import datetime
import os

def update_metadata():
    """Update metadata file with current information"""

    # Count planets in koiData.json
    koi_file = 'koiData.json'
    planet_count = 0

    try:
        with open(koi_file, 'r') as f:
            planets = json.load(f)
            planet_count = len(planets)
        print(f"✅ Found {planet_count} planets in {koi_file}")
    except FileNotFoundError:
        print(f"⚠️  Warning: {koi_file} not found, using 0 as planet count")
    except json.JSONDecodeError as e:
        print(f"❌ Error: Could not parse {koi_file}: {e}")
        return False

    # Create metadata object
    metadata = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "dataSource": "NASA Kepler Mission Archive",
        "totalPlanets": planet_count,
        "updateFrequency": "Weekly",
        "dataVersion": "1.0",
        "generatedBy": "Kepler Data Processing Pipeline"
    }

    # Write metadata file
    metadata_file = 'data_metadata.json'
    try:
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"✅ Successfully updated {metadata_file}")
        print(f"   Last Updated: {metadata['lastUpdated']}")
        print(f"   Total Planets: {metadata['totalPlanets']}")
        return True
    except Exception as e:
        print(f"❌ Error writing {metadata_file}: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Updating data metadata...")
    success = update_metadata()
    exit(0 if success else 1)
