from datetime import date
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.budget import Budget
from app.models.client import Client
from app.models.material import Material
from app.models.online_budget import OnlineBudget
from app.models.pool_stock import PoolStock
from app.models.work_order import WorkOrder


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def budgets_by_status(self, status: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> list[dict[str, Any]]:
        query = self.db.query(Budget).filter(Budget.status == status)
        if date_from:
            query = query.filter(Budget.created_at >= date_from)
        if date_to:
            query = query.filter(Budget.created_at <= date_to)
        results = query.all()
        return [
            {
                "id": b.id,
                "number": b.number,
                "client_id": b.client_id,
                "total": b.total,
                "total_usd": b.total_usd,
                "created_at": b.created_at,
                "status": b.status,
            }
            for b in results
        ]

    def budgets_by_date_range(self, start: date, end: date) -> list[dict[str, Any]]:
        results = self.db.query(Budget).filter(Budget.created_at.between(start, end)).all()
        return [
            {
                "id": b.id,
                "number": b.number,
                "status": b.status,
                "total": b.total,
                "total_usd": b.total_usd,
            }
            for b in results
        ]

    def work_orders_by_status(self, status: str, date_from: Optional[date] = None, date_to: Optional[date] = None) -> list[dict[str, Any]]:
        query = self.db.query(WorkOrder).filter(WorkOrder.status == status)
        if date_from:
            query = query.filter(WorkOrder.created_at >= date_from)
        if date_to:
            query = query.filter(WorkOrder.created_at <= date_to)
        results = query.all()
        return [
            {
                "id": o.id,
                "number": o.number,
                "client_id": o.client_id,
                "status": o.status,
                "total": o.total,
                "total_usd": o.total_usd,
            }
            for o in results
        ]

    def monthly_sales(self, year: int, date_from: Optional[date] = None, date_to: Optional[date] = None) -> list[dict[str, Any]]:
        from sqlalchemy import extract
        query = self.db.query(
            extract("month", Budget.created_at).label("month"),
            func.sum(Budget.total).label("total"),
            func.sum(Budget.total_usd).label("total_usd"),
        ).filter(Budget.status == "APPROVED", extract("year", Budget.created_at) == year)
        if date_from:
            query = query.filter(Budget.created_at >= date_from)
        if date_to:
            query = query.filter(Budget.created_at <= date_to)
        results = query.group_by("month").all()
        return [
            {
                "month": int(r.month) if r.month else 0,
                "total": float(r.total) if r.total else 0,
                "total_usd": float(r.total_usd) if r.total_usd else 0,
            }
            for r in results
        ]

    def most_used_materials(self, limit: int = 10) -> list[dict[str, Any]]:
        results = (
            self.db.query(Material, func.count(Budget.id).label("usage_count"))
            .join(Budget, Budget.material == Material.name)
            .group_by(Material.id)
            .order_by(func.count(Budget.id).desc())
            .limit(limit)
            .all()
        )
        return [{"name": r.Material.name, "usage_count": r.usage_count} for r in results]

    def dashboard_stats(self) -> dict[str, Any]:
        return {
            "pending_budgets": self.db.query(Budget).filter(Budget.status == "PENDING").count(),
            "approved_budgets": self.db.query(Budget).filter(Budget.status == "APPROVED").count(),
            "rejected_budgets": self.db.query(Budget).filter(Budget.status == "REJECTED").count(),
            "workshop_orders": self.db.query(WorkOrder).filter(WorkOrder.status == "WORKSHOP").count(),
            "finished_orders": self.db.query(WorkOrder).filter(WorkOrder.status == "FINISHED").count(),
            "delivered_orders": self.db.query(WorkOrder).filter(WorkOrder.status == "DELIVERED").count(),
            "pool_stock_total": self.db.query(func.sum(PoolStock.quantity)).scalar() or 0,
            "total_clients": self.db.query(Client).count(),
            "online_budgets": self.db.query(OnlineBudget).count(),
            "recent_budgets": self._recent_budgets(5),
            "recent_orders": self._recent_orders(5),
        }

    def _recent_budgets(self, limit: int) -> list[dict[str, Any]]:
        results = self.db.query(Budget).order_by(Budget.created_at.desc()).limit(limit).all()
        return [
            {
                "id": b.id,
                "number": b.number,
                "client_id": b.client_id,
                "total": b.total,
                "status": b.status,
                "created_at": b.created_at,
            }
            for b in results
        ]

    def _recent_orders(self, limit: int) -> list[dict[str, Any]]:
        results = self.db.query(WorkOrder).order_by(WorkOrder.created_at.desc()).limit(limit).all()
        return [
            {
                "id": o.id,
                "number": o.number,
                "client_id": o.client_id,
                "total": o.total,
                "status": o.status,
                "created_at": o.created_at,
            }
            for o in results
        ]
