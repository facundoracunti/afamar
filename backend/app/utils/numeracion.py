from sqlalchemy.orm import Session
from app.models.presupuesto import Presupuesto
from app.models.presupuesto_online import PresupuestoOnline
from app.models.orden_trabajo import OrdenTrabajo

def generar_numero_presupuesto(db: Session) -> str:
    u1 = db.query(Presupuesto).order_by(Presupuesto.id.desc()).first()
    u2 = db.query(PresupuestoOnline).order_by(PresupuestoOnline.id.desc()).first()
    num = 1
    if u1 and u1.numero:
        num = max(num, int(u1.numero.split("-")[1]) + 1)
    if u2 and u2.numero:
        num = max(num, int(u2.numero.split("-")[1]) + 1)
    return f"P-{num:06d}"

def generar_numero_orden(db: Session) -> str:
    ultimo = db.query(OrdenTrabajo).order_by(OrdenTrabajo.id.desc()).first()
    if ultimo and ultimo.numero:
        num = int(ultimo.numero.split("-")[1]) + 1
    else:
        num = 1
    return f"A-{num:06d}"
