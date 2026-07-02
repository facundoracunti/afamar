from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.budget import Budget
from app.models.work_order import WorkOrder
from app.models.pool_stock import PoolStock
from app.schemas.dashboard import DashboardData, BudgetSummary, OrderSummary, PoolSummary
import datetime


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self) -> DashboardData:
        now = datetime.datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        two_months_ago = now - datetime.timedelta(days=60)

        pending_budgets = self.db.query(Budget).filter(Budget.status == "PENDING").count()
        orders_in_measurement = self.db.query(WorkOrder).filter(WorkOrder.status == "MEASUREMENT").count()
        orders_in_workshop = self.db.query(WorkOrder).filter(WorkOrder.status == "WORKSHOP").count()
        pools_in_stock = self.db.query(func.sum(PoolStock.quantity)).scalar() or 0
        upcoming_deliveries = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.status.in_(["MEASUREMENT", "WORKSHOP"]))
            .count()
        )
        total_active_orders = self.db.query(WorkOrder).filter(WorkOrder.status.in_(["MEASUREMENT", "WORKSHOP"])).count()
        total_budgets = self.db.query(Budget).count()
        total_orders = self.db.query(WorkOrder).count()
        total_revenue = (
            self.db.query(func.sum(WorkOrder.total))
            .filter(WorkOrder.status == "DELIVERED")
            .scalar() or 0
        )
        total_pending_payments = (
            self.db.query(func.sum(WorkOrder.balance_due))
            .filter(WorkOrder.status.in_(["MEASUREMENT", "WORKSHOP", "FINISHED"]))
            .scalar() or 0
        )
        delivered_orders_this_month = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.status == "DELIVERED", WorkOrder.updated_at >= month_start)
            .count()
        )
        approved_budgets_this_month = (
            self.db.query(Budget)
            .filter(Budget.status == "APPROVED", Budget.updated_at >= month_start)
            .count()
        )

        recent_budgets = (
            self.db.query(Budget)
            .order_by(Budget.created_at.desc())
            .limit(10)
            .all()
        )
        recent_budgets_data = [
            BudgetSummary(
                id=b.id,
                number=b.number,
                customer_name=b.client.name if b.client else None,
                total=b.total or 0,
                status=b.status or "",
                created_at=b.created_at,
            )
            for b in recent_budgets
        ]

        recent_orders = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.status.in_(["MEASUREMENT", "WORKSHOP"]))
            .order_by(WorkOrder.created_at.desc())
            .limit(10)
            .all()
        )
        recent_orders_data = [
            OrderSummary(
                id=o.id,
                number=o.number,
                customer_name=o.client.name if o.client else None,
                total=o.total or 0,
                status=o.status or "",
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in recent_orders
        ]

        delivered_orders = (
            self.db.query(WorkOrder)
            .filter(WorkOrder.status == "DELIVERED", WorkOrder.updated_at < two_months_ago)
            .order_by(WorkOrder.updated_at.desc())
            .all()
        )
        delivered_orders_data = [
            OrderSummary(
                id=o.id,
                number=o.number,
                customer_name=o.client.name if o.client else None,
                total=o.total or 0,
                status=o.status or "",
                created_at=o.created_at,
                updated_at=o.updated_at,
            )
            for o in delivered_orders
        ]

        pools = self.db.query(PoolStock).all()
        pools_data = [
            PoolSummary(
                id=p.id,
                brand=p.brand,
                model=p.model,
                quantity=p.quantity or 0,
            )
            for p in pools
        ]

        return DashboardData(
            pending_budgets=pending_budgets,
            orders_in_measurement=orders_in_measurement,
            orders_in_workshop=orders_in_workshop,
            pools_in_stock=pools_in_stock,
            upcoming_deliveries=upcoming_deliveries,
            total_active_orders=total_active_orders,
            total_budgets=total_budgets,
            total_orders=total_orders,
            total_revenue=total_revenue,
            total_pending_payments=total_pending_payments,
            delivered_orders_this_month=delivered_orders_this_month,
            approved_budgets_this_month=approved_budgets_this_month,
            recent_budgets=recent_budgets_data,
            recent_orders=recent_orders_data,
            pools=pools_data,
            delivered_orders=delivered_orders_data,
        )