from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.dependencies.permissions import require_active, require_admin
from app.models.user import User
from app.utils.database import get_db
from app.models.master_data import Customer, Machine, Plant
from app.schemas.master_data import (
    CustomerCreate,
    CustomerUpdate,
    CustomerRead,
    MachineCreate,
    MachineUpdate,
    MachineRead,
)

router = APIRouter()


# --------------------------------------------------------------
# CUSTOMER – Admin-CRUD
# --------------------------------------------------------------
@router.get("/customers", response_model=List[CustomerRead])
async def get_customers(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Alle Kunden auflisten (Lesezugriff fuer alle aktiven Benutzer)."""
    query = select(Customer).order_by(Customer.name).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/customers", response_model=CustomerRead, status_code=201)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Kunde anlegen (nur Admin)."""
    existing = await db.execute(select(Customer).where(Customer.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kunde existiert bereits")
    customer = Customer(name=data.name, color=data.color)
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.put("/customers/{id}", response_model=CustomerRead)
async def update_customer(
    id: int,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Kunde bearbeiten (nur Admin)."""
    customer = await db.get(Customer, id)
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    if data.name != customer.name:
        existing = await db.execute(select(Customer).where(Customer.name == data.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Kunde existiert bereits")
    customer.name = data.name
    customer.color = data.color
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/customers/{id}", status_code=204)
async def delete_customer(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Kunde löschen (nur Admin)."""
    customer = await db.get(Customer, id)
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    await db.delete(customer)
    await db.commit()
    return None


# --------------------------------------------------------------
# MACHINE – Admin-CRUD
# --------------------------------------------------------------
@router.get("/machines", response_model=List[MachineRead])
async def get_machines(
    plant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_active),
):
    """Maschinen auflisten, optional nach Werk gefiltert (Lesen fuer alle)."""
    query = select(Machine)
    if plant_id is not None:
        query = query.where(Machine.plant_id == plant_id)
    query = query.order_by(Machine.name).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/machines", response_model=MachineRead, status_code=201)
async def create_machine(
    data: MachineCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Maschine anlegen (nur Admin)."""
    machine = Machine(name=data.name, plant_id=data.plant_id)
    db.add(machine)
    await db.commit()
    await db.refresh(machine)
    return machine


@router.put("/machines/{id}", response_model=MachineRead)
async def update_machine(
    id: int,
    data: MachineUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Maschine bearbeiten (nur Admin)."""
    machine = await db.get(Machine, id)
    if not machine:
        raise HTTPException(status_code=404, detail="Maschine nicht gefunden")
    machine.name = data.name
    machine.plant_id = data.plant_id
    await db.commit()
    await db.refresh(machine)
    return machine


@router.delete("/machines/{id}", status_code=204)
async def delete_machine(
    id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Maschine löschen (nur Admin)."""
    machine = await db.get(Machine, id)
    if not machine:
        raise HTTPException(status_code=404, detail="Maschine nicht gefunden")
    await db.delete(machine)
    await db.commit()
    return None
