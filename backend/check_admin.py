from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User

DATABASE_URL = "sqlite:///./toolsync.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

admin = db.query(User).filter(User.personal_number == "admin1").first()
if admin:
    print(f"Admin gefunden: {admin.personal_number}")
    print(f"hashed_password: {admin.hashed_password}")
    print(f"is_admin: {admin.is_admin}")
    print(f"is_active: {admin.is_active}")
else:
    print("Admin NICHT gefunden!")

db.close()