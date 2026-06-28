#!/usr/bin/env python3
"""Run during Render pre-deploy when the managed database is still empty."""

from app.services.bootstrap import bootstrap_ndw_data

if __name__ == "__main__":
    bootstrap_ndw_data(strict=True)
