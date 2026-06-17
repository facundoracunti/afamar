import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.presupuesto import Presupuesto, PresupuestoItem, PresupuestoAdicional
from app.models.cliente import Cliente
from app.models.stock_pileta import StockPileta, MovimientoPileta
from app.schemas.presupuesto import (
    PresupuestoCreate, PresupuestoUpdate, Presupuesto as PresupuestoSchema,
    PresupuestoItemSchema, PresupuestoAdicionalSchema, FabricacionDetalle
)
from app.utils.numeracion import generar_numero_presupuesto
from app.services.pdf_generator import PDFGenerator
from app.services.whatsapp_service import enviar_whatsapp, generar_mensaje_presupuesto
from app.services.email_service import enviar_email
from app.config import get_settings

router = APIRouter()


def _find_or_create_cliente(db, nombre=None, telefono=None, email=None, domicilio=None):
    q = db.query(Cliente)
    cliente = None
    if telefono:
        cliente = q.filter(Cliente.telefono == telefono).first()
    if not cliente and email:
        cliente = q.filter(Cliente.email == email).first()
    if not cliente and nombre:
        cliente = q.filter(Cliente.nombre == nombre).first()
    if cliente:
        if telefono: cliente.telefono = telefono
        if email: cliente.email = email
        if domicilio: cliente.direccion = domicilio
        cliente.updated_at = datetime.utcnow()
        db.flush()
        return cliente.id
    nuevo = Cliente(
        nombre=nombre or "Sin nombre",
        telefono=telefono,
        email=email,
        direccion=domicilio
    )
    db.add(nuevo)
    db.flush()
    return nuevo.id

@router.get("/", response_model=List[PresupuestoSchema])
def listar_presupuestos(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Presupuesto).options(
        joinedload(Presupuesto.cliente),
        joinedload(Presupuesto.items),
        joinedload(Presupuesto.adicionales),
        joinedload(Presupuesto.orden_trabajo)
    )
    if estado:
        query = query.filter(Presupuesto.estado == estado)
    else:
        query = query.filter(Presupuesto.estado != "CONVERTIDO A OT")
    if material:
        query = query.filter(Presupuesto.material.ilike(f"%{material}%"))
    if fecha_desde:
        query = query.filter(Presupuesto.created_at >= datetime.fromisoformat(fecha_desde))
    if fecha_hasta:
        query = query.filter(Presupuesto.created_at <= datetime.fromisoformat(fecha_hasta))
    if search:
        query = query.outerjoin(Cliente).filter(
            Presupuesto.numero.ilike(f"%{search}%") |
            Cliente.nombre.ilike(f"%{search}%") |
            Cliente.telefono.ilike(f"%{search}%") |
            Presupuesto.cliente_telefono_orden.ilike(f"%{search}%") |
            Presupuesto.material.ilike(f"%{search}%")
        )
    query = query.order_by(Presupuesto.id.desc())
    
    resultados = query.offset(skip).limit(limit).all()
    # deduplicate due to joinedload
    vistos = set()
    unicos = []
    for p in resultados:
        if p.id not in vistos:
            vistos.add(p.id)
            unicos.append(p)
    return [_presupuesto_to_schema(p) for p in unicos]

@router.get("/unificados")
def listar_unificados(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    from app.models.presupuesto_online import PresupuestoOnline
    locales = db.query(Presupuesto).options(
        joinedload(Presupuesto.cliente), joinedload(Presupuesto.orden_trabajo)
    )
    onlines = db.query(PresupuestoOnline).all()

    if estado:
        locales = locales.filter(Presupuesto.estado == estado)
    else:
        locales = locales.filter(Presupuesto.estado != "CONVERTIDO A OT")
    if search:
        locales = locales.outerjoin(Cliente).filter(
            Presupuesto.numero.ilike(f"%{search}%") |
            Cliente.nombre.ilike(f"%{search}%") |
            Cliente.telefono.ilike(f"%{search}%") |
            Presupuesto.cliente_telefono_orden.ilike(f"%{search}%") |
            Presupuesto.material.ilike(f"%{search}%")
        )
        onlines = [o for o in onlines if search.lower() in (o.numero or '').lower() or search.lower() in (o.cliente or '').lower()]

    locales = locales.order_by(Presupuesto.id.desc()).all()
    locales = list({p.id: p for p in locales}.values())

    result = []
    for p in locales:
        result.append({
            "id": p.id, "tipo": "local", "numero": p.numero, "fecha": p.fecha,
            "cliente_nombre": p.cliente_nombre or (p.cliente.nombre if p.cliente else None),
            "cliente_telefono": p.cliente_telefono_orden or (p.cliente.telefono if p.cliente else None),
            "material": p.material, "total": p.total or 0, "total_usd": p.total_usd or 0,
            "estado": p.estado, "orden_trabajo_numero": p.orden_trabajo.numero if p.orden_trabajo else None,
            "created_at": p.created_at, "sena_recibida": p.sena_recibida or 0, "saldo_pendiente": p.saldo_pendiente or 0,
            "observaciones_diseno": p.observaciones_diseno or "",
            "materiales": [{"nombre": m.get("nombre")} for m in (p.materiales or [])] if p.materiales else [],
        })
    for o in onlines:
        if estado == "CONVERTIDO A OT" and o.estado != "CONVERTIDO A OT":
            continue
        result.append({
            "id": o.id, "tipo": "online", "numero": o.numero, "fecha": o.fecha,
            "cliente_nombre": o.cliente, "cliente_telefono": None, "material": None,
            "total": o.total_neto_ars or 0, "total_usd": 0, "estado": o.estado or "ONLINE",
            "orden_trabajo_numero": None, "created_at": o.created_at,
            "sena_recibida": 0, "saldo_pendiente": 0,
        })
    result.sort(key=lambda x: x.get("created_at") or datetime.min, reverse=True)
    return result

@router.get("/next-numero")
def next_numero(db: Session = Depends(get_db)):
    numero = generar_numero_presupuesto(db)
    return {"numero": numero}

@router.get("/{presupuesto_id}", response_model=PresupuestoSchema)
def obtener_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).options(
        joinedload(Presupuesto.cliente),
        joinedload(Presupuesto.items),
        joinedload(Presupuesto.adicionales)
    ).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")
    return _presupuesto_to_schema(presupuesto)

@router.post("/", response_model=PresupuestoSchema, status_code=201)
def crear_presupuesto(data: PresupuestoCreate, db: Session = Depends(get_db)):
    raw = data.model_dump()

    cliente_id = _find_or_create_cliente(
        db,
        nombre=raw.get("cliente_nombre"),
        telefono=raw.get("cliente_telefono_orden"),
        email=raw.get("email"),
        domicilio=raw.get("domicilio"),
    )
    raw["cliente_id"] = cliente_id

    items_data = raw.pop("items", None) or []
    adics_data = raw.pop("adicionales", None) or []

    presupuesto = Presupuesto(**raw)
    presupuesto.numero = generar_numero_presupuesto(db)

    for item_data in items_data:
        presupuesto.items.append(PresupuestoItem(**item_data))
    for adic_data in adics_data:
        presupuesto.adicionales.append(PresupuestoAdicional(**adic_data))

    db.add(presupuesto)
    db.commit()
    db.refresh(presupuesto)
    return _presupuesto_to_schema(presupuesto)

@router.put("/{presupuesto_id}", response_model=PresupuestoSchema)
def actualizar_presupuesto(presupuesto_id: int, data: PresupuestoUpdate, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).options(
        joinedload(Presupuesto.cliente),
        joinedload(Presupuesto.items),
        joinedload(Presupuesto.adicionales)
    ).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")

    update_data = data.model_dump(exclude_unset=True)
    items_data = update_data.pop("items", None)
    adics_data = update_data.pop("adicionales", None)

    if any(k in update_data for k in ("cliente_nombre", "cliente_telefono_orden", "email", "domicilio")):
        cliente_id = _find_or_create_cliente(
            db,
            nombre=update_data.get("cliente_nombre", presupuesto.cliente_nombre),
            telefono=update_data.get("cliente_telefono_orden", presupuesto.cliente_telefono_orden),
            email=update_data.get("email", presupuesto.email),
            domicilio=update_data.get("domicilio", presupuesto.domicilio),
        )
        update_data["cliente_id"] = cliente_id

    for key, value in update_data.items():
        setattr(presupuesto, key, value)

    if items_data is not None:
        presupuesto.items.clear()
        for item_data in items_data:
            presupuesto.items.append(PresupuestoItem(**item_data))

    if adics_data is not None:
        presupuesto.adicionales.clear()
        for adic_data in adics_data:
            presupuesto.adicionales.append(PresupuestoAdicional(**adic_data))

    db.commit()
    db.refresh(presupuesto)
    return _presupuesto_to_schema(presupuesto)

@router.delete("/{presupuesto_id}", status_code=204)
def eliminar_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")

    if presupuesto.pileta_id and presupuesto.stock_descontado:
        pileta = db.query(StockPileta).filter(StockPileta.id == presupuesto.pileta_id).first()
        if pileta:
            pileta.cantidad = (pileta.cantidad or 0) + 1
            movimiento = MovimientoPileta(
                pileta_id=presupuesto.pileta_id,
                tipo="Ingreso",
                cantidad=1,
                descripcion=f"Restauración por eliminación de presupuesto {presupuesto.numero}"
            )
            db.add(movimiento)

    db.delete(presupuesto)
    db.commit()

@router.get("/{presupuesto_id}/pdf")
def descargar_pdf_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).options(
        joinedload(Presupuesto.cliente),
        joinedload(Presupuesto.items),
        joinedload(Presupuesto.adicionales)
    ).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")

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
            } for i in (presupuesto.items or [])
        ],
        "adicionales": [
            {
                "concepto": a.concepto,
                "detalle": a.detalle,
                "cantidad": a.cantidad,
                "precio_unitario": a.precio_unitario,
                "subtotal": a.subtotal,
            } for a in (presupuesto.adicionales or [])
        ],
        "condiciones_comerciales": presupuesto.condiciones_comerciales,
        "forma_pago": presupuesto.forma_pago,
        "fecha_estimada_entrega": presupuesto.fecha_estimada_entrega,
        "observaciones": presupuesto.observaciones,
    }

    buffer = PDFGenerator.generar_presupuesto(data, logo_path)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=presupuesto_{presupuesto.numero}.pdf"}
    )

@router.post("/{presupuesto_id}/convertir-orden")
def convertir_a_orden(presupuesto_id: int, db: Session = Depends(get_db)):
    from app.models.orden_trabajo import OrdenTrabajo
    from app.utils.numeracion import generar_numero_orden

    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")
    if presupuesto.estado == "CONVERTIDO A OT":
        raise HTTPException(400, "Este presupuesto ya fue convertido a una orden de trabajo")
    if presupuesto.estado != "APROBADO":
        raise HTTPException(400, "El presupuesto debe estar APROBADO para convertirse en orden")

    # Verificar si ya existe una orden vinculada
    orden_existente = db.query(OrdenTrabajo).filter(OrdenTrabajo.presupuesto_id == presupuesto_id).first()
    if orden_existente:
        raise HTTPException(400, f"Ya existe la orden {orden_existente.numero} vinculada a este presupuesto")

    orden = OrdenTrabajo(
        numero=generar_numero_orden(db),
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

        detalles_fabricacion=(presupuesto.detalles_fabricacion or []) + [
            {"concepto": i.sector, "detalle": "", "cantidad": i.cantidad or 1, "precio": i.subtotal or (i.m2 or 0) * (i.precio_m2 or 0), "moneda": "ARS", "m2": i.m2 or 0, "largo": i.largo or 0, "ancho": i.ancho or 0, "material": "", "material_precio_m2": 0}
            for i in (presupuesto.items or [])
        ] + [
            {"concepto": a.concepto, "detalle": a.detalle or "", "cantidad": a.cantidad or 1, "precio": a.subtotal or (a.precio_unitario or 0), "moneda": "ARS", "m2": 0, "largo": 0, "ancho": 0, "material": "", "material_precio_m2": 0}
            for a in (presupuesto.adicionales or [])
        ],
        detalles_presupuestados=presupuesto.detalles_fabricacion or [],
        materiales=presupuesto.materiales or [],
        piletas=presupuesto.piletas or [],
        adicionales=[{"concepto": a.concepto, "detalle": a.detalle or "", "cantidad": a.cantidad or 1, "precio_unitario": a.precio_unitario or 0, "subtotal": a.subtotal or 0} for a in (presupuesto.adicionales or [])],

        pileta_id=presupuesto.pileta_id,
        pileta_precio=presupuesto.pileta_precio or 0,
        pileta_moneda=presupuesto.pileta_moneda,
        pileta_imagen=presupuesto.pileta_imagen,

        prioridad=presupuesto.prioridad or "Normal",
        subtotal=presupuesto.subtotal or 0,
        traslado=presupuesto.traslado or 0,
        instalacion=presupuesto.instalacion or 0,
        descuento=presupuesto.descuento or 0,
        total=presupuesto.total or 0,
        sena_recibida=presupuesto.sena_recibida or 0,
        sena_moneda=presupuesto.sena_moneda,
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

        estado="EN MEDICIÓN",
    )
    presupuesto.estado = "CONVERTIDO A OT"
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return {
        "message": "Orden de trabajo creada",
        "orden_id": orden.id,
        "numero": orden.numero,
        "presupuesto_numero": presupuesto.numero
    }

@router.post("/{presupuesto_id}/enviar-whatsapp")
def enviar_whatsapp_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")
    cliente = presupuesto.cliente
    if not cliente:
        raise HTTPException(400, "El presupuesto no tiene un cliente asociado")
    if not cliente.telefono:
        raise HTTPException(400, "El cliente no tiene teléfono registrado")
    mensaje = generar_mensaje_presupuesto(presupuesto.numero, cliente.nombre, presupuesto.total)
    resultado = enviar_whatsapp(cliente.telefono, mensaje)
    if "error" in resultado:
        raise HTTPException(400, resultado["error"])
    return resultado

@router.post("/{presupuesto_id}/enviar-email")
def enviar_email_presupuesto(presupuesto_id: int, db: Session = Depends(get_db)):
    presupuesto = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not presupuesto:
        raise HTTPException(404, "Presupuesto no encontrado")
    cliente = presupuesto.cliente
    if not cliente:
        raise HTTPException(400, "El presupuesto no tiene un cliente asociado")
    if not cliente.email:
        raise HTTPException(400, "El cliente no tiene email registrado")
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
        raise HTTPException(400, resultado["error"])
    return resultado

def _presupuesto_to_schema(p):
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
        total=p.total,
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
        items=[PresupuestoItemSchema(
            id=i.id, sector=i.sector,
            unidad_largo=i.unidad_largo, unidad_ancho=i.unidad_ancho,
            largo=i.largo, ancho=i.ancho,
            m2=i.m2, cantidad=i.cantidad, precio_m2=i.precio_m2,
            subtotal=i.subtotal
        ) for i in (p.items or [])],
        adicionales=[PresupuestoAdicionalSchema(
            id=a.id, concepto=a.concepto, detalle=a.detalle, cantidad=a.cantidad,
            precio_unitario=a.precio_unitario, subtotal=a.subtotal
        ) for a in (p.adicionales or [])],
        cliente_telefono_orden=p.cliente_telefono_orden,
        email=p.email,
        domicilio=p.domicilio,
        fecha=p.fecha,
        prioridad=p.prioridad,
        subtotal=p.subtotal,
        traslado=p.traslado,
        instalacion=p.instalacion,
        descuento=p.descuento,
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
        observaciones_diseno=p.observaciones_diseno,
        observaciones_importantes=p.observaciones_importantes,
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
