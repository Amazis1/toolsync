"""Test: Warum liefert /api/locations/drawers? 500?"""
import asyncio
from fastapi.testclient import TestClient

from app.main import app

with TestClient(app) as client:
    r = client.get("/api/locations/drawers?cabinet_id=1")
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text[:500]}")
