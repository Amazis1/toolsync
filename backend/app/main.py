from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.utils.database import engine, Base, get_db
from app.middleware.session import sliding_session_middleware

from .routers import (
    auth,
    users,
    tools,
    locations,
    movements,
    serial_articles,
    data_sheets,
    spare_parts,
    master_data,
    roles,
    transport,
    stats,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("ToolSync API startet...")
    # Tabellen beim Start automatisch erstellen (falls noch nicht vorhanden)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    print("ToolSync API wird beendet...")


app = FastAPI(
    title="ToolSync API",
    version="1.0.0",
    description="Werkzeugverwaltung für Industrieunternehmen",
    lifespan=lifespan,
)


@app.get("/")
async def root():
    return {"message": "ToolSync Backend läuft!"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Ohne expose_headers sind die Antwort-Header fuer JS im Cross-Origin-Fall
    # unsichtbar (Entwicklungsbetrieb laeuft ueber den Vite-Proxy, dort egal).
    expose_headers=["X-New-Token", "X-Token-Expires-At"],
)

# Rollierende Sitzung: haengt bei gueltigem Bearer-Token einen frischen Token
# mit voller Laufzeit an die Antwort an (siehe app/middleware/session.py).
app.middleware("http")(sliding_session_middleware)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(movements.router, prefix="/api/movements", tags=["Movements"])
app.include_router(
    serial_articles.router, prefix="/api/serial-articles", tags=["Serial Articles"]
)
# Datenblätter (DEC-065): Einstellwerte eines Werkzeugs für eine Maschine.
app.include_router(
    data_sheets.router, prefix="/api/data-sheets", tags=["Data Sheets"]
)
# Ersatzteile (DEC-064): eigener Bereich. Die frühere Route /api/storage und die
# Tabelle storage_items sind entfallen – Ersatzteile sind jetzt `spare_parts`.
app.include_router(spare_parts.router, prefix="/api/spare-parts", tags=["Spare Parts"])
app.include_router(master_data.router, prefix="/api", tags=["Master Data"])
app.include_router(roles.router, prefix="/api/roles", tags=["Roles"])
# Werkzeug-Logistik zwischen Werken (DEC-072): Aufträge, Senden, Empfangen, Rückweg.
app.include_router(transport.router, prefix="/api/transport", tags=["Transport"])
app.include_router(stats.router, prefix="/api/stats", tags=["Stats"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ToolSync API"}
