from fastapi import APIRouter

from app.api.routers import (
    additional_works,
    auth,
    budgets,
    client_addresses,
    clients,
    daily_cash,
    dashboard,
    materials,
    measurements,
    options,
    pool_stock,
    product_photos,
    references,
    reports,
    search,
    settings,
    whatsapp,
    work_orders,
)

router = APIRouter(prefix="/api/v1")

router.include_router(dashboard.router, tags=["Dashboard"])
router.include_router(auth.router, prefix="/auth", tags=["Auth"])
router.include_router(clients.router, prefix="/clients", tags=["Clients"])
router.include_router(client_addresses.router, tags=["Client Addresses"])
router.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
router.include_router(work_orders.router, prefix="/work-orders", tags=["Work Orders"])
router.include_router(materials.router, prefix="/materials", tags=["Materials"])
router.include_router(additional_works.router, tags=["Additional Works"])
router.include_router(options.router, prefix="/options", tags=["Options"])
router.include_router(pool_stock.router, prefix="/pool-stock", tags=["Pool Stock"])
router.include_router(reports.router, prefix="/reports", tags=["Reports"])
router.include_router(settings.router, prefix="/settings", tags=["Settings"])
router.include_router(measurements.router, prefix="/measurements", tags=["Measurements"])
router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
router.include_router(search.router, prefix="/search", tags=["Search"])
router.include_router(product_photos.router, prefix="/product-photos", tags=["Product Photos"])
router.include_router(daily_cash.router)
router.include_router(references.router, prefix="/references", tags=["References"])
router.include_router(references.auth_router, prefix="/references", tags=["References"])
