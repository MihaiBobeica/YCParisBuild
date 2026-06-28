#!/usr/bin/env bash
set -euo pipefail

alembic upgrade head
# Run from the app root so `import app` resolves. `python scripts/foo.py`
# puts /app/scripts (not /app) on sys.path, hence the explicit PYTHONPATH.
PYTHONPATH=/app python scripts/bootstrap_data.py
