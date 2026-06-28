#!/usr/bin/env bash
set -euo pipefail

alembic upgrade head
python scripts/bootstrap_data.py
