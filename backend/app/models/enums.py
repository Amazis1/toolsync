from enum import Enum

class ToolCategory(str, Enum):
    STEMPEL = "Stempel"
    ABSTREIFER = "Abstreifer"
    MATRIZE = "Matrize"

class ToolStatus(str, Enum):
    AVAILABLE = "available"
    LENT = "lent"
    IN_TRANSIT = "in_transit"
    DEFECTIVE = "defective"
    MAINTENANCE = "maintenance"

class MovementType(str, Enum):
    LEND = "lend"
    RETURN = "return"
    TRANSFER = "transfer"
    RELOCATE = "relocate"
    STATUS_CHANGE = "status_change"

class MovementStatus(str, Enum):
    OPEN = "open"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class TransportStatus(str, Enum):
    """Zustand eines Logistik-Auftrags (DEC-072).

    Ein Auftrag ist **eine Richtung**; der Rückweg ist ein eigener Auftrag mit
    `parent_order_id`. `draft`, `sent` und `partly_received` gelten als **offen**:
    sie belegen das Werkzeug, ein zweiter Auftrag darauf ist nicht erlaubt.
    """

    DRAFT = "draft"
    SENT = "sent"
    PARTLY_RECEIVED = "partly_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"


# Offene Aufträge belegen das Werkzeug (DEC-072 Punkt 6)
OPEN_TRANSPORT_STATUSES = (
    TransportStatus.DRAFT,
    TransportStatus.SENT,
    TransportStatus.PARTLY_RECEIVED,
)

# „Unterwegs": verschickt, aber noch nicht vollständig bestätigt
SHIPPED_TRANSPORT_STATUSES = (
    TransportStatus.SENT,
    TransportStatus.PARTLY_RECEIVED,
)