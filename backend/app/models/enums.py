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