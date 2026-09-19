from pathlib import Path

from pydantic_settings import BaseSettings

# backend/app/core/config.py -> parents[2] = backend/
BACKEND_DIR = Path(__file__).resolve().parents[2]

class Settings(BaseSettings):
    # Datenbank
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/toolsync"

    # JWT
    # PFLICHTFELD - bewusst OHNE Default.
    # Ein fest eingebauter Default waere gefaehrlich: wer ihn kennt, kann gueltige
    # Tokens fuer jede Personalnummer erzeugen, auch fuer Admins.
    # Fehlt der Wert in der Umgebung oder in backend/.env, bricht der Start mit
    # einem Validierungsfehler ab. Ein lauter Startfehler ist besser als ein
    # stiller unsicherer Fallback.
    # Erzeugen mit: python -c "import secrets; print(secrets.token_urlsafe(48))"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30

    # App
    app_name: str = "ToolSync API"
    app_version: str = "1.0.0"
    debug: bool = True

    model_config = {
        # Absoluter Pfad: die .env wird unabhaengig vom aktuellen Arbeitsverzeichnis
        # gefunden. Vorher stand hier ".env", was nur funktionierte, wenn der Prozess
        # aus backend/ gestartet wurde.
        "env_file": str(BACKEND_DIR / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

settings = Settings()