import os
from io import BytesIO
from typing import Optional, List
from sqlalchemy.orm import Session
from app.repositories.orden_trabajo import OrdenTrabajoRepository
from app.repositories.cliente import ClienteRepository
from app.repositories.stock_pileta import descontar_stock_piletas, restaurar_stock_piletas
from app.models.stock_pileta import StockPileta, MovimientoPileta
from app.schemas.orden_trabajo import OrdenTrabajo as OrdenTrabajoSchema
from app.utils.numeracion import generar_numero_orden
from app.services.exceptions import NotFoundError, ConflictError
from app.services.pdf_html_service import generar_orden_pdf
from app.config import get_settings
from datetime import datetime


class OrdenTrabajoService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = OrdenTrabajoRepository(db)
        self.cliente_repo = ClienteRepository(db)

    def listar(self, search=None, estado=None, skip=0, limit=100) -> list:
        return [
            self._to_schema(o)
            for o in self.repo.search(search, estado, skip, limit)
        ]

    def obtener(self, orden_id: int) -> dict:
        orden = self.repo.get_loaded(orden_id)
        if not orden:
            raise NotFoundError("Orden de trabajo", orden_id)
        return self._to_schema(orden)

    def crear(self, data: dict) -> dict:
        raw = dict(data)

        cliente_id = self.cliente_repo.find_or_create(
            nombre=raw.get("cliente_nombre"),
            telefono=raw.get("cliente_telefono_orden"),
            email=raw.get("email"),
            domicilio=raw.get("domicilio"),
        )
        raw["cliente_id"] = cliente_id

        orden = self.repo.model(**raw)
        orden.numero = generar_numero_orden(self.db)
        orden.stock_descontado = True
        self.db.add(orden)
        self.db.flush()

        piletas = raw.get("piletas") or []
        descontar_stock_piletas(self.db, piletas, orden.numero)

        self.db.commit()
        self.db.refresh(orden)
        return self._to_schema(orden)

    def actualizar(self, orden_id: int, data: dict) -> dict:
        payload = dict(data)
        orden = self.repo.get_loaded(orden_id)
        if not orden:
            raise NotFoundError("Orden de trabajo", orden_id)

        if any(k in payload for k in ("cliente_nombre", "cliente_telefono_orden", "email", "domicilio")):
            cliente_id = self.cliente_repo.find_or_create(
                nombre=payload.get("cliente_nombre", orden.cliente_nombre),
                telefono=payload.get("cliente_telefono_orden", orden.cliente_telefono_orden),
                email=payload.get("email", orden.email),
                domicilio=payload.get("domicilio", orden.domicilio),
            )
            payload["cliente_id"] = cliente_id

        nuevo_estado = payload.get("estado", orden.estado)
        piletas = payload.get("piletas", orden.piletas or [])

        if not orden.stock_descontado and piletas:
            descontar_stock_piletas(self.db, piletas, orden.numero)
            orden.stock_descontado = True

        if nuevo_estado != orden.estado:
            if nuevo_estado == "CANCELADO" and orden.stock_descontado:
                restaurar_stock_piletas(self.db, piletas, orden.numero)
                orden.stock_descontado = False

        for key, value in payload.items():
            setattr(orden, key, value)
        self.db.commit()
        self.db.refresh(orden)
        return self._to_schema(orden)

    def eliminar(self, orden_id: int) -> None:
        orden = self.repo.get(orden_id)
        if not orden:
            raise NotFoundError("Orden de trabajo", orden_id)
        if orden.stock_descontado:
            piletas = orden.piletas or []
            if piletas:
                restaurar_stock_piletas(self.db, piletas, orden.numero)
            elif orden.pileta_id:
                pileta = (
                    self.db.query(StockPileta)
                    .filter(StockPileta.id == orden.pileta_id)
                    .first()
                )
                if pileta:
                    pileta.cantidad = (pileta.cantidad or 0) + 1
                    movimiento = MovimientoPileta(
                        pileta_id=orden.pileta_id,
                        tipo="Ingreso",
                        cantidad=1,
                        descripcion=f"Restauración por eliminación de orden {orden.numero}",
                    )
                    self.db.add(movimiento)
        self.repo.delete(orden_id)

    def generar_pdf(self, orden_id: int) -> BytesIO:
        orden = self.repo.get_loaded(orden_id)
        if not orden:
            raise NotFoundError("Orden de trabajo", orden_id)

        settings = get_settings()
        logo_path = None
        logo_file = os.path.join(settings.UPLOAD_DIR, "logo.png")
        if os.path.exists(logo_file):
            logo_path = logo_file

        c = orden.cliente
        data = {
            "numero": orden.numero,
            "estado": orden.estado,
            "fecha": orden.fecha.isoformat() if orden.fecha else None,
            "prioridad": orden.prioridad or "",
            "cliente_nombre": orden.cliente_nombre or (c.nombre if c else None),
            "cliente_telefono": orden.cliente_telefono_orden or (c.telefono if c else None),
            "domicilio": orden.domicilio or (c.direccion if c else None),
            "email": orden.email or (c.email if c else None),
            "material": orden.material,
            "color_tipo": orden.color_tipo,
            "espesor": orden.espesor,
            "acabado": orden.acabado,
            "fecha_entrega": orden.fecha_entrega.isoformat() if orden.fecha_entrega else None,
            "detalles_fabricacion": orden.detalles_fabricacion or [],
            "materiales": orden.materiales or [],
            "piletas": orden.piletas or [],
            "croquis": orden.croquis or [],
            "subtotal": orden.subtotal or 0,
            "traslado": orden.traslado or 0,
            "total": orden.total or 0,
            "total_usd": orden.total_usd or 0,
            "dolar_dia": orden.dolar_dia or 1,
            "sena_recibida": orden.sena_recibida or 0,
            "saldo_pendiente": orden.saldo_pendiente or 0,
            "sena_moneda": orden.sena_moneda or "ARS",
            "descuento_porcentaje": orden.descuento_porcentaje or 0,
            "descuento_monto_fijo": orden.descuento_monto_fijo or 0,
            "forma_pago": orden.forma_pago or "",
            "cuotas": orden.cuotas or 1,
            "observaciones": orden.observaciones or "",
            "observaciones_importantes": orden.observaciones_importantes or "",
            "firma_cliente": orden.firma_cliente,
        }
        return generar_orden_pdf(data, logo_path)

    def _to_schema(self, o) -> OrdenTrabajoSchema:
        c = o.cliente
        p = o.presupuesto
        return OrdenTrabajoSchema(
            id=o.id,
            numero=o.numero,
            estado=o.estado,
            cliente_id=o.cliente_id,
            presupuesto_id=o.presupuesto_id,
            origen=o.origen,
            fecha=o.fecha,
            domicilio=o.domicilio,
            email=o.email,
            croquis=o.croquis,
            material=o.material,
            material_precio_m2=o.material_precio_m2,
            tipo_cambio=o.tipo_cambio,
            color_tipo=o.color_tipo,
            espesor=o.espesor,
            acabado=o.acabado,
            bacha=o.bacha,
            anafe=o.anafe,
            observaciones_diseno=o.observaciones_diseno or "",
            detalles_fabricacion=o.detalles_fabricacion,
            detalles_presupuestados=o.detalles_presupuestados,
            materiales=o.materiales,
            pileta_id=o.pileta_id,
            pileta_precio=o.pileta_precio,
            pileta_moneda=o.pileta_moneda,
            pileta_imagen=o.pileta_imagen,
            stock_descontado=o.stock_descontado,
            piletas=o.piletas,
            adicionales=o.adicionales,
            subtotal=o.subtotal,
            traslado=o.traslado,
            instalacion=o.instalacion,
            descuento=o.descuento,
            descuento_porcentaje=o.descuento_porcentaje,
            descuento_monto_fijo=o.descuento_monto_fijo,
            total=o.total,
            sena_recibida=o.sena_recibida,
            sena_moneda=o.sena_moneda,
            saldo_pendiente=o.saldo_pendiente,
            saldo_pagado=o.saldo_pagado,
            fecha_pago_saldo=o.fecha_pago_saldo,
            dolar_dia=o.dolar_dia,
            subtotal_usd=o.subtotal_usd,
            traslado_usd=o.traslado_usd,
            total_usd=o.total_usd,
            sena_usd=o.sena_usd,
            saldo_pendiente_usd=o.saldo_pendiente_usd,
            forma_pago=o.forma_pago,
            cuotas=o.cuotas,
            fecha_entrega=o.fecha_entrega,
            prioridad=o.prioridad,
            firma_cliente=o.firma_cliente,
            fecha_aprobacion=o.fecha_aprobacion,
            observaciones=o.observaciones or "",
            observaciones_importantes=o.observaciones_importantes or "",
            created_at=o.created_at,
            updated_at=o.updated_at,
            cliente_nombre=o.cliente_nombre or (c.nombre if c else None),
            cliente_telefono_orden=o.cliente_telefono_orden,
            presupuesto_numero=p.numero if p else None,
        )
