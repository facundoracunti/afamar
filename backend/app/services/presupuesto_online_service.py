from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.presupuesto_online import PresupuestoOnlineRepository
from app.models.orden_trabajo import OrdenTrabajo
from app.models.stock_pileta import StockPileta
from app.repositories.stock_pileta import descontar_stock_piletas
from app.utils.numeracion import generar_numero_orden
from app.services.exceptions import NotFoundError, ConflictError
from datetime import datetime


class PresupuestoOnlineService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PresupuestoOnlineRepository(db)

    def listar(self) -> list:
        return self.db.query(self.repo.model).order_by(self.repo.model.id.desc()).all()

    def obtener(self, id: int):
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)
        return p

    def crear(self, data: dict):
        return self.repo.create_with_numero(**data)

    def actualizar(self, id: int, data: dict):
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)
        for key, value in data.items():
            if value is not None:
                setattr(p, key, value)
        self.repo.db.commit()
        self.repo.db.refresh(p)
        return p

    def eliminar(self, id: int):
        if not self.repo.delete(id):
            raise NotFoundError("Presupuesto online", id)

    def convertir_a_orden(self, id: int) -> dict:
        p = self.repo.get(id)
        if not p:
            raise NotFoundError("Presupuesto online", id)

        print(f"[convertir_a_orden] PresupuestoOnline #{id}: pileta_id={p.pileta_id}, estado={p.estado}, items_count={len(p.items or [])}")

        fecha_dt = None
        if p.fecha:
            try:
                fecha_dt = datetime.strptime(p.fecha[:10], "%Y-%m-%d")
            except (ValueError, TypeError):
                pass

        items = p.items or []
        materiales = []
        piletas = []
        detalles_fabricacion = []

        for i, item in enumerate(items):
            detalle_str = item.get("detalle", "LONGITUD") if isinstance(item, dict) else (item.detalle if hasattr(item, 'detalle') else "LONGITUD")
            es_unidad = item.get("es_unidad", False) if isinstance(item, dict) else (item.es_unidad if hasattr(item, 'es_unidad') else False)
            largo = float(item.get("largo", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'largo', 0) or 0)
            ancho = float(item.get("ancho", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'ancho', 0) or 0)
            m2 = float(item.get("m2", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'm2', 0) or 0)
            moneda = item.get("moneda", "ARS") if isinstance(item, dict) else (item.moneda if hasattr(item, 'moneda') else "ARS")
            cantidad = int(item.get("cantidad", 1) or 1) if isinstance(item, dict) else int(getattr(item, 'cantidad', 1) or 1)
            precio_unitario = float(item.get("precio_unitario", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'precio_unitario', 0) or 0)
            subtotal = float(item.get("subtotal", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'subtotal', 0) or 0)
            mano_de_obra = float(item.get("mano_de_obra", 0) or 0) if isinstance(item, dict) else float(getattr(item, 'mano_de_obra', 0) or 0)
            material = item.get("material", "") if isinstance(item, dict) else (item.material if hasattr(item, 'material') else "")

            # Scan ALL items for pileta_id
            raw_pid = item.get("pileta_id", 0) if isinstance(item, dict) else getattr(item, 'pileta_id', 0)
            item_pileta_id = int(raw_pid) if raw_pid else 0
            if item_pileta_id and not any(pl.get("pileta_id") == item_pileta_id for pl in piletas):
                pt = self.db.query(StockPileta).filter(StockPileta.id == item_pileta_id).first()
                if pt:
                    print(f"[convertir_a_orden] Item #{i} pileta_id={item_pileta_id} ({pt.marca} {pt.modelo}) cant={cantidad}")
                    piletas.append({
                        "pileta_id": item_pileta_id, "marca": pt.marca, "modelo": pt.modelo,
                        "precio": precio_unitario, "moneda": moneda, "imagen": "", "cantidad": cantidad,
                    })

            if es_unidad:
                if detalle_str == "PILETA MOD":
                    pass  # pileta_id already handled above
                else:
                    TRAFORO_MAP = {
                        "APERTURA + PEGADO PILETA": "TRAFORO DE PILETA",
                        "APERTURA PILETA APOYO": "TRAFORO DE PILETA DE APOYO",
                        "APERTURA ANAFE": "TRAFORO DE ANAFE",
                    }
                    detalles_fabricacion.append({
                        "concepto": TRAFORO_MAP.get(detalle_str, "OTRA"),
                        "detalle": detalle_str,
                        "material": material,
                        "material_precio_m2": precio_unitario,
                        "largo": largo if largo else None,
                        "ancho": ancho if ancho else None,
                        "m2": m2,
                        "mano_de_obra": mano_de_obra if mano_de_obra else None,
                        "moneda": moneda,
                        "cantidad": cantidad,
                        "precio": subtotal if subtotal else precio_unitario * cantidad,
                    })
            elif detalle_str in ("ZOCALOS", "ZÓCALO"):
                detalles_fabricacion.append({
                    "concepto": "ZÓCALO",
                    "detalle": material,
                    "material": material,
                    "material_precio_m2": precio_unitario,
                    "largo": largo if largo else None,
                    "ancho": ancho if ancho else None,
                    "m2": m2,
                    "mano_de_obra": mano_de_obra if mano_de_obra else None,
                    "moneda": moneda,
                    "cantidad": cantidad,
                    "precio": subtotal if subtotal else precio_unitario * cantidad,
                })
            elif detalle_str == "FRENTE":
                detalles_fabricacion.append({
                    "concepto": "FRENTE",
                    "detalle": material,
                    "material": material,
                    "material_precio_m2": precio_unitario,
                    "largo": largo if largo else None,
                    "ancho": ancho if ancho else None,
                    "m2": m2,
                    "mano_de_obra": mano_de_obra if mano_de_obra else None,
                    "moneda": moneda,
                    "cantidad": cantidad,
                    "precio": subtotal if subtotal else precio_unitario * cantidad,
                })
            elif detalle_str in ("TERMINACION",):
                detalles_fabricacion.append({
                    "concepto": "OTRA",
                    "detalle": "TERMINACION",
                    "material": "",
                    "material_precio_m2": precio_unitario,
                    "largo": largo if largo else None,
                    "ancho": ancho if ancho else None,
                    "m2": m2,
                    "mano_de_obra": mano_de_obra if mano_de_obra else None,
                    "moneda": moneda,
                    "cantidad": cantidad,
                    "precio": subtotal if subtotal else precio_unitario * cantidad,
                })
            elif detalle_str != "LONGITUD":
                materiales.append({
                    "nombre": detalle_str,
                    "categoria": "",
                    "color": "",
                    "precio_m2": precio_unitario if moneda == "ARS" else 0,
                    "precio_m2_usd": precio_unitario if moneda == "USD" else 0,
                    "moneda": moneda,
                    "cantidad": cantidad,
                    "m2_utilizados": 0,
                    "m2_presupuestado": m2 * cantidad,
                    "largo": largo,
                    "ancho": ancho,
                    "es_alternativa": False,
                })

        # Top-level pileta_id fallback (if not already from items)
        if p.pileta_id and not any(pl.get("pileta_id") == p.pileta_id for pl in piletas):
            pt = self.db.query(StockPileta).filter(StockPileta.id == p.pileta_id).first()
            if pt:
                print(f"[convertir_a_orden] Top-level fallback pileta_id={p.pileta_id} ({pt.marca} {pt.modelo})")
            piletas.append({
                "pileta_id": p.pileta_id,
                "marca": pt.marca if pt else "",
                "modelo": pt.modelo if pt else "",
                "precio": p.pileta_precio or 0,
                "moneda": "ARS",
                "imagen": "",
                "cantidad": 1,
            })

        print(f"[convertir_a_orden] piletas final={piletas}")

        orden = OrdenTrabajo(
            numero=generar_numero_orden(self.db),
            origen="Desde presupuesto online",
            cliente_nombre=p.cliente,
            fecha=fecha_dt,
            materiales=materiales,
            piletas=piletas,
            detalles_fabricacion=detalles_fabricacion,
            total=p.total_consolidado or p.total_neto_ars or 0,
            subtotal=p.total_neto_ars or 0,
            dolar_dia=p.dolar_dia or 1000,
            total_usd=p.total_neto_usd or 0,
            subtotal_usd=p.total_neto_usd or 0,
            estado="EN MEDICIÓN",
            observaciones=f"Convertido desde presupuesto online {p.numero}",
        )
        p.estado = "CONVERTIDO A OT"
        orden.stock_descontado = True
        self.db.add(orden)
        self.db.flush()

        descontar_stock_piletas(self.db, piletas, orden.numero)
        print(f"[convertir_a_orden] Stock deducted for orden {orden.numero}")
        self.db.commit()
        self.db.refresh(orden)

        return {
            "message": "Orden creada",
            "orden_id": orden.id,
            "numero": orden.numero,
        }
