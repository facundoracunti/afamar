import os
from io import BytesIO
from typing import Optional, List
from sqlalchemy.orm import Session
from datetime import datetime

from app.repositories.presupuesto import PresupuestoRepository
from app.repositories.cliente import ClienteRepository
from app.models.orden_trabajo import OrdenTrabajo
from app.models.stock_pileta import StockPileta, MovimientoPileta
from app.schemas.presupuesto import (
    Presupuesto as PresupuestoSchema,
    PresupuestoItemSchema,
    PresupuestoAdicionalSchema,
)
from app.utils.numeracion import generar_numero_presupuesto, generar_numero_orden
from app.services.exceptions import NotFoundError, ConflictError
from app.services.pdf_generator import PDFGenerator
from app.services.whatsapp_service import enviar_whatsapp, generar_mensaje_presupuesto
from app.services.email_service import enviar_email
from app.config import get_settings


class PresupuestoService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PresupuestoRepository(db)
        self.cliente_repo = ClienteRepository(db)

    def listar(self, search=None, estado=None, material=None,
               fecha_desde=None, fecha_hasta=None, skip=0, limit=100) -> list:
        return [
            self._to_schema(p)
            for p in self.repo.search(
                search, estado, material, fecha_desde, fecha_hasta, skip, limit
            )
        ]

    def listar_unificados(self, search=None, estado=None) -> list:
        return self.repo.get_unificados(search, estado)

    def obtener(self, presupuesto_id: int) -> dict:
        presupuesto = self.repo.get_loaded(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)
        return self._to_schema(presupuesto)

    def crear(self, data: dict) -> dict:
        raw = dict(data)
        items = raw.pop("items", None) or []
        adics = raw.pop("adicionales", None) or []

        cliente_id = self.cliente_repo.find_or_create(
            nombre=raw.get("cliente_nombre"),
            telefono=raw.get("cliente_telefono_orden"),
            email=raw.get("email"),
            domicilio=raw.get("domicilio"),
        )
        raw["cliente_id"] = cliente_id

        presupuesto = self.repo.create_with_relations(raw, items, adics)
        return self._to_schema(presupuesto)

    def actualizar(self, presupuesto_id: int, data: dict) -> dict:
        update_data = dict(data)
        items = update_data.pop("items", None)
        adics = update_data.pop("adicionales", None)

        presupuesto = self.repo.get_loaded(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)

        if any(k in update_data for k in ("cliente_nombre", "cliente_telefono_orden", "email", "domicilio")):
            cliente_id = self.cliente_repo.find_or_create(
                nombre=update_data.get("cliente_nombre", presupuesto.cliente_nombre),
                telefono=update_data.get("cliente_telefono_orden", presupuesto.cliente_telefono_orden),
                email=update_data.get("email", presupuesto.email),
                domicilio=update_data.get("domicilio", presupuesto.domicilio),
            )
            update_data["cliente_id"] = cliente_id

        updated = self.repo.update_with_relations(presupuesto_id, update_data, items, adics)
        if not updated:
            raise NotFoundError("Presupuesto", presupuesto_id)
        return self._to_schema(updated)

    def eliminar(self, presupuesto_id: int) -> None:
        presupuesto = self.repo.get(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)
        self.repo.restore_stock(presupuesto)
        self.repo.delete(presupuesto_id)

    def convertir_a_orden(self, presupuesto_id: int) -> dict:
        presupuesto = self.repo.get(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)
        if presupuesto.estado == "CONVERTIDO A OT":
            raise ConflictError("Este presupuesto ya fue convertido a una orden de trabajo")
        if presupuesto.estado != "APROBADO":
            raise ConflictError("El presupuesto debe estar APROBADO para convertirse en orden")

        orden_existente = (
            self.db.query(OrdenTrabajo)
            .filter(OrdenTrabajo.presupuesto_id == presupuesto_id)
            .first()
        )
        if orden_existente:
            raise ConflictError(
                f"Ya existe la orden {orden_existente.numero} vinculada a este presupuesto"
            )

        from app.repositories.stock_pileta import descontar_stock_piletas

        orden = OrdenTrabajo(
            numero=generar_numero_orden(self.db),
            presupuesto_id=presupuesto.id,
            origen="Desde presupuesto",
            cliente_id=presupuesto.cliente_id,
            cliente_nombre=presupuesto.cliente_nombre,
            cliente_telefono_orden=presupuesto.cliente_telefono_orden,
            fecha=presupuesto.fecha,
            domicilio=presupuesto.domicilio,
            email=presupuesto.email,
            croquis=presupuesto.croquis,
            material=presupuesto.material,
            material_precio_m2=presupuesto.material_precio_m2,
            tipo_cambio=presupuesto.tipo_cambio or 1000,
            color_tipo=presupuesto.color_tipo,
            espesor=presupuesto.espesor,
            acabado=presupuesto.acabado,
            bacha=presupuesto.bacha,
            anafe=presupuesto.anafe,
            observaciones_diseno=presupuesto.observaciones_diseno,
            detalles_fabricacion=(presupuesto.detalles_fabricacion or [])
            + [
                {
                    "concepto": i.sector,
                    "detalle": "",
                    "cantidad": i.cantidad or 1,
                    "precio": (i.m2 or 0) * (i.precio_m2 or 0),
                    "moneda": "ARS",
                    "m2": i.m2 or 0,
                    "largo": i.largo or 0,
                    "ancho": i.ancho or 0,
                    "material": "",
                    "material_precio_m2": 0,
                }
                for i in (presupuesto.items or [])
            ]
            + [
                {
                    "concepto": a.concepto,
                    "detalle": a.detalle or "",
                    "cantidad": a.cantidad or 1,
                    "precio": (a.precio_unitario or 0),
                    "moneda": "ARS",
                    "m2": 0,
                    "largo": 0,
                    "ancho": 0,
                    "material": "",
                    "material_precio_m2": 0,
                }
                for a in (presupuesto.adicionales or [])
            ],
            detalles_presupuestados=presupuesto.detalles_fabricacion or [],
            materiales=presupuesto.materiales or [],
            piletas=presupuesto.piletas or [],
            adicionales=[
                {
                    "concepto": a.concepto,
                    "detalle": a.detalle or "",
                    "cantidad": a.cantidad or 1,
                    "precio_unitario": a.precio_unitario or 0,
                    "subtotal": a.subtotal or 0,
                }
                for a in (presupuesto.adicionales or [])
            ],
            pileta_id=presupuesto.pileta_id,
            pileta_precio=presupuesto.pileta_precio or 0,
            pileta_moneda=presupuesto.pileta_moneda,
            pileta_imagen=presupuesto.pileta_imagen,
            prioridad=presupuesto.prioridad or "Normal",
            subtotal=presupuesto.subtotal or 0,
            traslado=presupuesto.traslado or 0,
            instalacion=presupuesto.instalacion or 0,
            descuento=presupuesto.descuento or 0,
            descuento_porcentaje=presupuesto.descuento_porcentaje or 0,
            descuento_monto_fijo=presupuesto.descuento_monto_fijo or 0,
            total=presupuesto.total or 0,
            sena_recibida=presupuesto.sena_recibida or 0,
            sena_moneda=presupuesto.sena_moneda or "ARS",
            saldo_pendiente=presupuesto.saldo_pendiente or 0,
            saldo_pagado=presupuesto.saldo_pagado or False,
            fecha_pago_saldo=presupuesto.fecha_pago_saldo,
            forma_pago=presupuesto.forma_pago,
            cuotas=presupuesto.cuotas or 1,
            dolar_dia=presupuesto.dolar_dia or 1000,
            subtotal_usd=presupuesto.subtotal_usd or 0,
            traslado_usd=presupuesto.traslado_usd or 0,
            total_usd=presupuesto.total_usd or 0,
            sena_usd=presupuesto.sena_usd or 0,
            saldo_pendiente_usd=presupuesto.saldo_pendiente_usd or 0,
            fecha_entrega=presupuesto.fecha_entrega,
            firma_cliente=presupuesto.firma_cliente,
            fecha_aprobacion=presupuesto.fecha_aprobacion,
            observaciones=presupuesto.observaciones,
            observaciones_importantes=presupuesto.observaciones_importantes,
            estado="MEDICION",
        )
        presupuesto.estado = "CONVERTIDO A OT"
        orden.stock_descontado = True
        self.db.add(orden)
        self.db.flush()

        descontar_stock_piletas(self.db, orden.piletas or [], orden.numero)
        self.db.commit()
        self.db.refresh(orden)

        return {
            "message": "Orden de trabajo creada",
            "orden_id": orden.id,
            "numero": orden.numero,
            "presupuesto_numero": presupuesto.numero,
        }

    def convertir_alternativa_a_orden(self, presupuesto_id: int, idx: int) -> dict:
        presupuesto = self.repo.get(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)

        materiales = presupuesto.materiales or []
        if idx < 0 or idx >= len(materiales):
            raise ConflictError("Índice de alternativa inválido")

        alt = materiales[idx]
        if not alt.get("es_alternativa"):
            raise ConflictError("El material seleccionado no es una alternativa")

        from app.repositories.stock_pileta import descontar_stock_piletas

        dd = float(presupuesto.dolar_dia or 1000)
        dd = dd if dd > 0 else 1000
        m2 = float(alt.get("largo", 0) or 0) * float(alt.get("ancho", 0) or 0)
        cantidad = float(alt.get("cantidad", 1) or 1)
        area = m2 * cantidad

        if alt.get("moneda") == "USD":
            costo_mat_usd = round(area * float(alt.get("precio_m2_usd", 0) or 0), 2)
            costo_mat_ars = round(costo_mat_usd * dd, 2)
        else:
            costo_mat_ars = round(area * float(alt.get("precio_m2", 0) or 0), 2)
            costo_mat_usd = round(costo_mat_ars / dd, 2) if dd > 0 else 0

        total_detalles_ars = 0.0
        total_detalles_usd = 0.0
        for d in (presupuesto.detalles_fabricacion or []):
            p = float(d.get("precio", 0) or 0)
            c = float(d.get("cantidad", 1) or 1)
            if d.get("moneda") == "USD":
                total_detalles_usd += p * c
            else:
                total_detalles_ars += p * c

        total_piletas_ars = 0.0
        total_piletas_usd = 0.0
        for pt in (presupuesto.piletas or []):
            p = float(pt.get("precio", 0) or 0)
            c = float(pt.get("cantidad", 1) or 1)
            if pt.get("moneda") == "USD":
                total_piletas_usd += p * c
            else:
                total_piletas_ars += p * c

        traslado = float(presupuesto.traslado or 0)

        subtotal_ars = costo_mat_ars + total_detalles_ars + total_piletas_ars
        subtotal_usd = costo_mat_usd + total_detalles_usd + total_piletas_usd
        total_final = round(subtotal_ars + (subtotal_usd * dd) + traslado)

        orden = OrdenTrabajo(
            numero=generar_numero_orden(self.db),
            presupuesto_id=presupuesto.id,
            origen="Desde alternativa",
            cliente_id=presupuesto.cliente_id,
            cliente_nombre=presupuesto.cliente_nombre,
            cliente_telefono_orden=presupuesto.cliente_telefono_orden,
            fecha=presupuesto.fecha,
            domicilio=presupuesto.domicilio,
            email=presupuesto.email,
            croquis=presupuesto.croquis,
            material=alt.get("nombre", ""),
            material_precio_m2=alt.get("precio_m2", 0),
            tipo_cambio=presupuesto.tipo_cambio or 1000,
            color_tipo=alt.get("color", ""),
            acabado=presupuesto.acabado or "",
            observaciones_diseno=presupuesto.observaciones_diseno or "",
            detalles_fabricacion=presupuesto.detalles_fabricacion or [],
            detalles_presupuestados=[
                {
                    "concepto": alt.get("nombre", "Alternativa"),
                    "detalle": "",
                    "material": alt.get("nombre", ""),
                    "material_precio_m2": alt.get("precio_m2", 0),
                    "m2": round(m2, 5),
                    "cantidad": int(cantidad),
                    "precio": costo_mat_ars,
                    "moneda": "ARS",
                },
                *[
                    {
                        "concepto": d.get("concepto", ""),
                        "detalle": d.get("detalle", ""),
                        "material": d.get("material", ""),
                        "material_precio_m2": d.get("material_precio_m2", 0),
                        "m2": d.get("m2", 0),
                        "cantidad": d.get("cantidad", 1),
                        "precio": d.get("precio", 0),
                        "moneda": d.get("moneda", "ARS"),
                    }
                    for d in (presupuesto.detalles_fabricacion or [])
                ],
            ],
            materiales=[alt],
            piletas=presupuesto.piletas or [],
            pileta_id=presupuesto.pileta_id,
            pileta_precio=presupuesto.pileta_precio or 0,
            pileta_moneda=presupuesto.pileta_moneda or "ARS",
            pileta_imagen=presupuesto.pileta_imagen or "",
            prioridad=presupuesto.prioridad or "Normal",
            subtotal=round(subtotal_ars),
            traslado=traslado,
            descuento=0,
            total=total_final,
            dolar_dia=presupuesto.dolar_dia or 1000,
            subtotal_usd=round(subtotal_usd, 2),
            traslado_usd=round(traslado / dd, 2) if dd > 0 else 0,
            total_usd=round(total_final / dd, 2) if dd > 0 else 0,
            observaciones=presupuesto.observaciones or "",
            observaciones_importantes=presupuesto.observaciones_importantes or "",
            estado="MEDICION",
        )
        orden.stock_descontado = True
        self.db.add(orden)
        self.db.flush()
        descontar_stock_piletas(self.db, orden.piletas or [], orden.numero)
        self.db.commit()
        self.db.refresh(orden)

        return {
            "message": "Orden de trabajo creada desde alternativa",
            "orden_id": orden.id,
            "numero": orden.numero,
            "alternativa_nombre": alt.get("nombre", ""),
        }

    def generar_pdf(self, presupuesto_id: int) -> BytesIO:
        presupuesto = self.repo.get_loaded(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)

        settings = get_settings()
        logo_path = None
        logo_file = os.path.join(settings.UPLOAD_DIR, "logo.png")
        if os.path.exists(logo_file):
            logo_path = logo_file

        c = presupuesto.cliente
        data = {
            "numero": presupuesto.numero,
            "estado": presupuesto.estado,
            "cliente_nombre": c.nombre if c else presupuesto.cliente_nombre,
            "cliente_telefono": c.telefono if c else presupuesto.cliente_telefono_orden,
            "cliente_email": c.email if c else presupuesto.email,
            "cliente_direccion": c.direccion if c else presupuesto.domicilio,
            "material": presupuesto.material,
            "material_precio_m2": presupuesto.material_precio_m2,
            "color_tipo": presupuesto.color_tipo,
            "espesor": presupuesto.espesor,
            "acabado": presupuesto.acabado,
            "bacha": presupuesto.bacha,
            "anafe": presupuesto.anafe,
            "detalles_fabricacion": presupuesto.detalles_fabricacion or [],
            "subtotal": presupuesto.subtotal or 0,
            "traslado": presupuesto.traslado or 0,
            "total": presupuesto.total or 0,
            "total_usd": presupuesto.total_usd or 0,
            "validez": presupuesto.validez or "7 días",
            "entrega_aproximada": presupuesto.entrega_aproximada or "7 a 10 días hábiles",
            "items": [
                {
                    "sector": i.sector,
                    "largo": i.largo,
                    "ancho": i.ancho,
                    "m2": i.m2,
                    "cantidad": i.cantidad,
                    "precio_m2": i.precio_m2,
                    "subtotal": i.subtotal,
                }
                for i in (presupuesto.items or [])
            ],
            "adicionales": [
                {
                    "concepto": a.concepto,
                    "detalle": a.detalle,
                    "cantidad": a.cantidad,
                    "precio_unitario": a.precio_unitario,
                    "subtotal": a.subtotal,
                }
                for a in (presupuesto.adicionales or [])
            ],
            "condiciones_comerciales": presupuesto.condiciones_comerciales,
            "forma_pago": presupuesto.forma_pago,
            "fecha_estimada_entrega": presupuesto.fecha_estimada_entrega,
            "observaciones": presupuesto.observaciones,
        }
        return PDFGenerator.generar_presupuesto(data, logo_path)

    def enviar_whatsapp(self, presupuesto_id: int) -> dict:
        presupuesto = self.repo.get(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)
        cliente = presupuesto.cliente
        if not cliente:
            raise ConflictError("El presupuesto no tiene un cliente asociado")
        if not cliente.telefono:
            raise ConflictError("El cliente no tiene teléfono registrado")
        mensaje = generar_mensaje_presupuesto(
            presupuesto.numero, cliente.nombre, presupuesto.total
        )
        resultado = enviar_whatsapp(cliente.telefono, mensaje)
        if "error" in resultado:
            raise ConflictError(resultado["error"])
        return resultado

    def enviar_email(self, presupuesto_id: int) -> dict:
        presupuesto = self.repo.get(presupuesto_id)
        if not presupuesto:
            raise NotFoundError("Presupuesto", presupuesto_id)
        cliente = presupuesto.cliente
        if not cliente:
            raise ConflictError("El presupuesto no tiene un cliente asociado")
        if not cliente.email:
            raise ConflictError("El cliente no tiene email registrado")
        asunto = f"Presupuesto {presupuesto.numero} - AFAMAR Mármoles & Granitos"
        cuerpo = (
            f"Hola {cliente.nombre},\n\n"
            f"Te enviamos el presupuesto {presupuesto.numero}.\n\n"
            f"Material: {presupuesto.material}\n"
            f"Total: ${presupuesto.total:.2f}\n\n"
            f"Podés consultar y descargar el PDF desde nuestro sistema.\n\n"
            f"Quedamos a tu disposición.\n"
            f"AFAMAR Mármoles & Granitos"
        )
        resultado = enviar_email(cliente.email, asunto, cuerpo)
        if "error" in resultado:
            raise ConflictError(resultado["error"])
        return resultado

    @staticmethod
    def _compute_total(p) -> float:
        ars = 0.0
        usd = 0.0

        for d in (p.detalles_fabricacion or []):
            precio = float(d.get("precio", 0) or 0)
            cantidad = float(d.get("cantidad", 1) or 1)
            if d.get("moneda") == "USD":
                usd += precio * cantidad
            else:
                ars += precio * cantidad

        for m in (p.materiales or []):
            if m.get("es_alternativa"):
                continue
            largo = float(m.get("largo", 0) or 0)
            ancho = float(m.get("ancho", 0) or 0)
            cantidad = float(m.get("cantidad", 1) or 1)
            m2 = round(largo * ancho, 5)
            area = m2 * cantidad
            if m.get("moneda") == "USD":
                usd += round(area * float(m.get("precio_m2_usd", 0) or 0), 2)
            else:
                ars += round(area * float(m.get("precio_m2", 0) or 0), 2)

        for pt in (p.piletas or []):
            moneda = pt.get("moneda", "ARS") or "ARS"
            precio = float(pt.get("precio", 0) or 0)
            cantidad = float(pt.get("cantidad", 1) or 1)
            if moneda == "USD":
                usd += precio * cantidad
            else:
                ars += precio * cantidad

        dd = float(p.dolar_dia or 1000)
        dd = dd if dd > 0 else 1000
        subtotal = ars + (usd * dd) + 0.0
        tr = float(p.traslado or 0)
        total_base = max(0.0, subtotal + tr)

        pct = 0
        if p.forma_pago == "TARJETA DE CRÉDITO":
            cuotas = int(p.cuotas or 1)
            pct = 0 if cuotas <= 2 else cuotas * 5

        recargo = round(total_base * pct / 100)
        return round(total_base + recargo)

    def _to_schema(self, p) -> PresupuestoSchema:
        c = p.cliente
        ot = p.orden_trabajo
        return PresupuestoSchema(
            id=p.id,
            numero=p.numero,
            estado=p.estado,
            cliente_id=p.cliente_id,
            croquis=p.croquis,
            material=p.material,
            material_precio_m2=p.material_precio_m2,
            material_precio_m2_usd=p.material_precio_m2_usd,
            color_tipo=p.color_tipo,
            espesor=p.espesor,
            frente=p.frente,
            terminacion=p.terminacion,
            bacha=p.bacha,
            anafe=p.anafe,
            moneda=p.moneda,
            tipo_cambio=p.tipo_cambio,
            subtotal_materiales=p.subtotal_materiales,
            subtotal_servicios=p.subtotal_servicios,
            total=self._compute_total(p),
            forma_pago=p.forma_pago,
            cuotas=p.cuotas,
            validez=p.validez,
            entrega_aproximada=p.entrega_aproximada,
            fecha_estimada_entrega=p.fecha_estimada_entrega,
            condiciones_comerciales=p.condiciones_comerciales,
            observaciones=p.observaciones,
            created_at=p.created_at,
            updated_at=p.updated_at,
            cliente_nombre=p.cliente_nombre or (c.nombre if c else None),
            cliente_telefono=c.telefono if c else None,
            cliente_email=c.email if c else None,
            cliente_direccion=c.direccion if c else None,
            orden_trabajo_numero=ot.numero if ot else None,
            items=[
                PresupuestoItemSchema(
                    id=i.id, sector=i.sector,
                    unidad_largo=i.unidad_largo, unidad_ancho=i.unidad_ancho,
                    largo=i.largo, ancho=i.ancho,
                    m2=i.m2, cantidad=i.cantidad, precio_m2=i.precio_m2,
                    subtotal=i.subtotal,
                )
                for i in (p.items or [])
            ],
            adicionales=[
                PresupuestoAdicionalSchema(
                    id=a.id, concepto=a.concepto, detalle=a.detalle,
                    cantidad=a.cantidad, precio_unitario=a.precio_unitario,
                    subtotal=a.subtotal,
                )
                for a in (p.adicionales or [])
            ],
            cliente_telefono_orden=p.cliente_telefono_orden,
            email=p.email,
            domicilio=p.domicilio,
            fecha=p.fecha,
            prioridad=p.prioridad,
            subtotal=p.subtotal,
            traslado=p.traslado,
            instalacion=p.instalacion,
            descuento=p.descuento,
            descuento_porcentaje=p.descuento_porcentaje,
            descuento_monto_fijo=p.descuento_monto_fijo,
            sena_recibida=p.sena_recibida,
            sena_moneda=p.sena_moneda,
            saldo_pendiente=p.saldo_pendiente,
            saldo_pagado=p.saldo_pagado,
            fecha_pago_saldo=p.fecha_pago_saldo,
            dolar_dia=p.dolar_dia,
            subtotal_usd=p.subtotal_usd,
            traslado_usd=p.traslado_usd,
            total_usd=p.total_usd,
            sena_usd=p.sena_usd,
            saldo_pendiente_usd=p.saldo_pendiente_usd,
            fecha_entrega=p.fecha_entrega,
            firma_cliente=p.firma_cliente,
            fecha_aprobacion=p.fecha_aprobacion,
            observaciones_diseno=p.observaciones_diseno or "",
            observaciones_importantes=p.observaciones_importantes or "",
            detalles_fabricacion=p.detalles_fabricacion,
            materiales=p.materiales,
            pileta_id=p.pileta_id,
            pileta_precio=p.pileta_precio,
            pileta_moneda=p.pileta_moneda,
            pileta_imagen=p.pileta_imagen,
            stock_descontado=p.stock_descontado,
            piletas=p.piletas,
            acabado=p.acabado,
        )
