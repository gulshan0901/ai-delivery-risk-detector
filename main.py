from pathlib import Path
import sys


# Deployment entrypoint for root-level Procfile: expose backend/main.py as main:app.
BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.main import app  # noqa: E402
