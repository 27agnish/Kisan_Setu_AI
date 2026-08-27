#!/usr/bin/env python3
"""
Root test runner forwarder for Kisan Setu test suite.
Delegates to tests/test_backend_api.py while preserving root-level test compatibility.
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from tests.test_backend_api import test_full_application_flow, run_all_tests

if __name__ == "__main__":
    test_full_application_flow()
