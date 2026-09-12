from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StockAdjustmentCreate(BaseModel):
    user_name: str
    action_type: str  # "ARTTIR" veya "AZALT"
    quantity: int
    description: Optional[str] = None

class StockMovementResponse(BaseModel):
    id: int
    user_name: str
    action_type: str
    quantity: int
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True