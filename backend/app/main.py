from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.utils.database import engine, Base, get_db

from .routers import auth, users, tools, locations, movements, serial_articles, storage_items, master_data, roles

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
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(tools.router, prefix="/api/tools", tags=["Tools"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(movements.router, prefix="/api/movements", tags=["Movements"])
app.include_router(serial_articles.router, prefix="/api/serial-articles", tags=["Serial Articles"])
app.include_router(storage_items.router, prefix="/api/storage", tags=["Storage Items"])
app.include_router(master_data.router, prefix="/api", tags=["Master Data"])
app.include_router(roles.router, prefix="/api/roles", tags=["Roles"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ToolSync API"}