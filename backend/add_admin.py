from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User

DATABASE_URL = "sqlite:///./toolsync.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Der bereits generierte Hash für "123" (aus deinem Befehl)
hashed_password = "$2b$12$FQGG5Jjdt4zoFNa.6nAlouJhmXuKmTdVCriB/xUVAy1PMw7XJL.uC"

# Prüfen, ob Admin bereits existiert
admin = db.query(User).filter(User.personal_number == "admin1").first()
if admin:
    print("Admin existiert bereits. Überschreibe mit neuem Hash...")
    admin.hashed_password = hashed_password
else:
    admin = User(
        personal_number="admin1",
        first_name="Admin",
        last_name="User",
        display_name="Admin User",
        is_active=True,
        is_admin=True,
        hashed_password=hashed_password,
    )
    db.add(admin)

db.commit()
db.close()
print("Admin erfolgreich angelegt (oder aktualisiert).")