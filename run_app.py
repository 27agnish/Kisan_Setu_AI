#!/usr/bin/env python3
"""
Root entrypoint forwarder for Kisan Setu master runner.
Delegates to scripts/run_app.py while preserving root-level CLI command compatibility.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scripts.run_app import main

if __name__ == "__main__":
    main()
