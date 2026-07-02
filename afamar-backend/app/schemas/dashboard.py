from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class BudgetSummary(BaseModel):
    id: int
    number: str
    customer_name: Optional[str] = None
    total: float = 0
    status: str = ""
    created_at: Optional[datetime] = None

class OrderSummary(BaseModel):
    id: int
    number: str
    customer_name: Optional[str] = None
    total: float = 0
    status: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PoolSummary(BaseModel):
    id: int
    brand: str
    model: str
    quantity: int = 0

class DashboardData(BaseModel):
    pending_budgets: int = 0
    orders_in_measurement: int = 0
    orders_in_workshop: int = 0
    pools_in_stock: int = 0
    upcoming_deliveries: int = 0
    total_active_orders: int = 0
    total_budgets: int = 0
    total_orders: int = 0
    total_revenue: float = 0
    total_pending_payments: float = 0
    delivered_orders_this_month: int = 0
    approved_budgets_this_month: int = 0
    recent_budgets: List[BudgetSummary] = []
    recent_orders: List[OrderSummary] = []
    pools: List[PoolSummary] = []
    delivered_orders: List[OrderSummary] = []