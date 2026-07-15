from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.client import Client
from app.repositories.client import ClientRepository


class ClientService:
    def __init__(self, db: Session):
        self.repo = ClientRepository(db)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Client]:
        return self.repo.get_all(skip, limit)

    def get_by_id(self, client_id: int) -> Optional[Client]:
        return self.repo.get_by_id(client_id)

    def get_history(self, client_id: int) -> dict:
        return self.repo.get_history(client_id)

    def search(self, term: str) -> List[Client]:
        return self.repo.search(term)

    def get_with_history(self, client_id: int) -> Optional[dict]:
        """Return the client enriched with aggregated history (budget/order
        counts, last order number, recent orders/budgets) AND the full list
        of alternative delivery addresses. Powers the edit page
        (`/admin/clients/{id}`), which renders a side panel of stats and
        recent orders next to the form fields.

        Reuses `repo.get_history` so the aggregate queries aren't
        duplicated — same cost as a separate `/history` request, but in
        one round trip.
        """
        from app.schemas.client_address import ClientAddressResponse

        client = self.get_by_id(client_id)
        if not client:
            return None
        history = self.repo.get_history(client_id)
        # Serialize the addresses inline so the front-end can render the
        # list in one round-trip alongside the rest of the form.
        addresses = [
            ClientAddressResponse.model_validate(a).model_dump(mode="json")
            for a in client.addresses
        ]
        return {
            "id": client.id,
            "name": client.name,
            "phone": client.phone,
            "email": client.email,
            "address": client.address,
            "notes": client.notes,
            "total_purchased": client.total_purchased or 0.0,
            "created_at": client.created_at,
            "updated_at": client.updated_at,
            "total_budgets": history["total_budgets"],
            "total_orders": history["total_orders"],
            "last_order_number": history["last_order_number"],
            "orders": history["recent_orders"],
            "budgets": history["recent_budgets"],
            "addresses": addresses,
        }

    def list_with_stats(self, skip: int = 0, limit: int = 100) -> List[dict]:
        """Paginated client list enriched with per-client aggregates:
        `total_budgets`, `total_orders`, `last_order_number`.

        Uses three extra aggregate queries (one each for budgets, work-orders,
        and the latest order number) instead of a correlated subquery per row,
        so the cost is constant regardless of page size.
        """
        from app.models.budget import Budget
        from app.models.work_order import WorkOrder

        clients: List[Client] = self.repo.get_all(skip, limit)
        ids = [c.id for c in clients]
        if not ids:
            return []

        budget_counts: dict[int, int] = dict(
            self.repo.db.query(Budget.client_id, func.count(Budget.id))
            .filter(Budget.client_id.in_(ids))
            .group_by(Budget.client_id)
            .all()
        )

        work_order_counts: dict[int, int] = dict(
            self.repo.db.query(WorkOrder.client_id, func.count(WorkOrder.id))
            .filter(WorkOrder.client_id.in_(ids))
            .group_by(WorkOrder.client_id)
            .all()
        )

        # `last_order_number` — fetch all work orders for the page, sorted
        # newest-first by client, then keep the first per client_id.
        last_orders: dict[int, str] = {}
        for o in (
            self.repo.db.query(WorkOrder)
            .filter(WorkOrder.client_id.in_(ids))
            .order_by(WorkOrder.client_id, WorkOrder.created_at.desc())
            .all()
        ):
            if o.client_id not in last_orders:
                last_orders[o.client_id] = o.number

        from app.schemas.client_address import ClientAddressResponse

        results: List[dict] = []
        for c in clients:
            addresses = [
                ClientAddressResponse.model_validate(a).model_dump(mode="json")
                for a in c.addresses
            ]
            results.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "phone": c.phone,
                    "email": c.email,
                    "address": c.address,
                    "notes": c.notes,
                    "total_purchased": c.total_purchased or 0.0,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                    "total_budgets": budget_counts.get(c.id, 0),
                    "total_orders": work_order_counts.get(c.id, 0),
                    "last_order_number": last_orders.get(c.id),
                    "addresses": addresses,
                }
            )
        return results

    def create(self, data: dict) -> Client:
        # If the legacy `address` field is set, peel it off before creating
        # the Client row so we can use it to seed the default
        # `ClientAddress` row afterwards (keeps the two in sync).
        seed_address = (data.get("address") or "").strip()
        data = {k: v for k, v in data.items() if k != "address"}
        if seed_address:
            data["address"] = seed_address
        client = self.repo.create(data)
        if seed_address:
            from app.models.client_address import ClientAddress
            self.repo.db.add(
                ClientAddress(
                    client_id=client.id,
                    address=seed_address,
                    label="Principal",
                    is_default=True,
                )
            )
        self.repo.db.commit()
        self.repo.db.refresh(client)
        return client

    def update(self, client_id: int, data: dict) -> Optional[Client]:
        client = self.repo.get_by_id(client_id)
        if not client:
            return None
        result = self.repo.update(client, data)
        self.repo.db.commit()
        self.repo.db.refresh(result)
        return result

    def delete(self, client_id: int) -> bool:
        client = self.repo.get_by_id(client_id)
        if not client:
            return False
        self.repo.delete(client)
        self.repo.db.commit()
        return True

    def count_dependent_records(self, client_id: int) -> dict:
        """Return counts of records that reference this client. Used by the
        delete endpoint to refuse the operation when there are linked budgets
        or work orders — FK constraints would otherwise surface as a 500.
        """
        from app.models.budget import Budget
        from app.models.work_order import WorkOrder

        budgets = (
            self.repo.db.query(Budget).filter(Budget.client_id == client_id).count()
        )
        work_orders = (
            self.repo.db.query(WorkOrder).filter(WorkOrder.client_id == client_id).count()
        )
        return {"budgets": budgets, "work_orders": work_orders}
