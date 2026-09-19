from sqlalchemy import ForeignKey, String, Boolean, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, AuditMixin

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

class Role(Base, AuditMixin):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    permissions: Mapped[list["Permission"]] = relationship(secondary=role_permissions, back_populates="roles")
    users: Mapped[list["User"]] = relationship(back_populates="role")

class Permission(Base, AuditMixin):
    __tablename__ = "permissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    codename: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    roles: Mapped[list["Role"]] = relationship(secondary=role_permissions, back_populates="permissions")

class User(Base, AuditMixin):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    personal_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    role_id: Mapped[int | None] = mapped_column(ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    role: Mapped["Role | None"] = relationship(back_populates="users")
    movements: Mapped[list["ToolMovement"]] = relationship(back_populates="user")