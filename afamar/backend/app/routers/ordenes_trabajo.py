import os
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.orden_trabajo import OrdenTrabajo
from app.models.cliente import Cliente
from app.models.presupuesto import Presupuesto
from app.models.stock_pileta import StockPileta, MovimientoPileta
from app.schemas.orden_trabajo import OrdenTrabajoCreate, OrdenTrabajoUpdate, OrdenTrabajo as OrdenTrabajoSchema
from app.utils.numeracion import generar_numero_orden
from app.services.pdf_generator import PDFGenerator
from app.config import get_settings

router = APIRouter()


def _find_or_create_cliente(db, nombre, telefono, email, domicilio):
    if not nombre:
        return None

    cliente = None

    # Priority 1: Search by phone
    if telefono:
        cliente = db.query(Cliente).filter(Cliente.telefono == telefono).first()

    # Priority 2: Search by email
    if not cliente and email:
        cliente = db.query(Cliente).filter(Cliente.email == email).first()

    # Priority 3: Search by exact name
    if not cliente:
        cliente = db.query(Cliente).filter(Cliente.nombre == nombre).first()

    if cliente:
        changed = False
        if telefono and cliente.telefono != telefono:
            cliente.telefono = telefono
            changed = True
        if domicilio and cliente.direccion != domicilio:
            cliente.direccion = domicilio
            changed = True
        if email and cliente.email != email:
            cliente.email = email
            changed = True
        if changed:
            cliente.updated_at = datetime.utcnow()
        db.flush()
        return cliente.id
    else:
        nuevo = Cliente(
            nombre=nombre,
            telefono=telefono,
            email=email,
            direccion=domicilio,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(nuevo)
        db.flush()
        return nuevo.id


@router.get("/", response_model=List[OrdenTrabajoSchema])
def listar_ordenes(
    search: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(OrdenTrabajo).options(joinedload(OrdenTrabajo.cliente), joinedload(OrdenTrabajo.presupuesto))
    if estado:
        query = query.filter(OrdenTrabajo.estado == estado)
    else:
        query = query.filter(OrdenTrabajo.estado != "ENTREGADO")
    if search:
        query = query.filter(
            OrdenTrabajo.numero.ilike(f"%{search}%") |
            OrdenTrabajo.cliente_nombre.ilike(f"%{search}%") |
            OrdenTrabajo.cliente_telefono_orden.ilike(f"%{search}%") |
            OrdenTrabajo.email.ilike(f"%{search}%")
        )
    query = query.order_by(OrdenTrabajo.id.desc())

    resultados = query.offset(skip).limit(limit).all()
    return [_orden_to_schema(o) for o in resultados]


@router.get("/next-numero")
def next_numero(db: Session = Depends(get_db)):
    return {"numero": generar_numero_orden(db)}


@router.get("/{orden_id}", response_model=OrdenTrabajoSchema)
def obtener_orden(orden_id: int, db: Session = Depends(get_db)):
    orden = db.query(OrdenTrabajo).options(
        joinedload(OrdenTrabajo.cliente), joinedload(OrdenTrabajo.presupuesto)
    ).filter(OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden de trabajo no encontrada")
    return _orden_to_schema(orden)


@router.get("/{orden_id}/pdf")
def descargar_pdf_orden(orden_id: int, db: Session = Depends(get_db)):
    orden = db.query(OrdenTrabajo).options(
        joinedload(OrdenTrabajo.cliente)
    ).filter(OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden de trabajo no encontrada")

    settings = get_settings()
    logo_path = None
    logo_file = os.path.join(settings.UPLOAD_DIR, "logo.png")
    if os.path.exists(logo_file):
        logo_path = logo_file

    c = orden.cliente
    data = {
        "numero": orden.numero,
        "estado": orden.estado,
        "cliente_nombre": orden.cliente_nombre or (c.nombre if c else None),
        "cliente_telefono": orden.cliente_telefono_orden or (c.telefono if c else None),
        "material": orden.material,
        "color_tipo": orden.color_tipo,
        "espesor": orden.espesor,
        "sena_recibida": orden.sena_recibida,
        "saldo_pendiente": orden.saldo_pendiente,
        "prioridad": orden.prioridad,
        "fecha_entrega": orden.fecha_entrega,
        "fecha_aprobacion": orden.fecha_aprobacion,
        "firma_cliente": orden.firma_cliente,
    }

    buffer = PDFGenerator.generar_orden_trabajo(data, logo_path)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=orden_{orden.numero}.pdf"}
    )

@router.post("/", response_model=OrdenTrabajoSchema, status_code=201)
def crear_orden(data: OrdenTrabajoCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()

    cliente_id = _find_or_create_cliente(
        db,
        nombre=payload.get("cliente_nombre"),
        telefono=payload.get("cliente_telefono_orden"),
        email=payload.get("email"),
        domicilio=payload.get("domicilio")
    )
    payload["cliente_id"] = cliente_id

    orden = OrdenTrabajo(**payload)
    orden.numero = generar_numero_orden(db)
    db.add(orden)
    db.commit()
    db.refresh(orden)
    return _orden_to_schema(orden)


@router.put("/{orden_id}", response_model=OrdenTrabajoSchema)
def actualizar_orden(orden_id: int, data: OrdenTrabajoUpdate, db: Session = Depends(get_db)):
    orden = db.query(OrdenTrabajo).options(
        joinedload(OrdenTrabajo.cliente), joinedload(OrdenTrabajo.presupuesto)
    ).filter(OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden de trabajo no encontrada")

    payload = data.model_dump(exclude_unset=True)

    if any(k in payload for k in ("cliente_nombre", "cliente_telefono_orden", "email", "domicilio")):
        cliente_id = _find_or_create_cliente(
            db,
            nombre=payload.get("cliente_nombre", orden.cliente_nombre),
            telefono=payload.get("cliente_telefono_orden", orden.cliente_telefono_orden),
            email=payload.get("email", orden.email),
            domicilio=payload.get("domicilio", orden.domicilio)
        )
        payload["cliente_id"] = cliente_id

    # Stock de pileta: descontar al pasar a EN EL TALLER, reponer al cancelar
    nuevo_estado = payload.get("estado", orden.estado)
    if nuevo_estado != orden.estado:
        pileta_id = payload.get("pileta_id", orden.pileta_id)
        if pileta_id:
            pileta = db.query(StockPileta).filter(StockPileta.id == pileta_id).first()
            if pileta:
                if nuevo_estado == "EN EL TALLER" and not orden.stock_descontado:
                    pileta.cantidad = max(0, (pileta.cantidad or 0) - 1)
                    orden.stock_descontado = True
                    movimiento = MovimientoPileta(
                        pileta_id=pileta_id,
                        tipo="Egreso",
                        cantidad=1,
                        descripcion=f"SALIDA POR PRODUCCIÓN - Orden {orden.numero}"
                    )
                    db.add(movimiento)
                elif nuevo_estado in ("CANCELADO", "ENTREGADO") and orden.stock_descontado:
                    if nuevo_estado == "CANCELADO":
                        pileta.cantidad = (pileta.cantidad or 0) + 1
                        orden.stock_descontado = False
                        movimiento = MovimientoPileta(
                            pileta_id=pileta_id,
                            tipo="Ingreso",
                            cantidad=1,
                            descripcion=f"ENTRADA POR CANCELACIÓN - Orden {orden.numero}"
                        )
                        db.add(movimiento)

    for key, value in payload.items():
        setattr(orden, key, value)
    db.commit()
    db.refresh(orden)
    return _orden_to_schema(orden)


@router.delete("/{orden_id}", status_code=204)
def eliminar_orden(orden_id: int, db: Session = Depends(get_db)):
    from app.models.stock_pileta import StockPileta, MovimientoPileta
    orden = db.query(OrdenTrabajo).filter(OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(404, "Orden de trabajo no encontrada")
    if orden.pileta_id and orden.stock_descontado:
        pileta = db.query(StockPileta).filter(StockPileta.id == orden.pileta_id).first()
        if pileta:
            pileta.cantidad = (pileta.cantidad or 0) + 1
            movimiento = MovimientoPileta(
                pileta_id=orden.pileta_id,
                tipo="Ingreso",
                cantidad=1,
                descripcion=f"Restauración por eliminación de orden {orden.numero}"
            )
            db.add(movimiento)
    db.delete(orden)
    db.commit()


def _orden_to_schema(o):
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
        observaciones_diseno=o.observaciones_diseno,
        detalles_fabricacion=o.detalles_fabricacion,
        detalles_presupuestados=o.detalles_presupuestados,
        materiales=o.materiales,
        pileta_id=o.pileta_id,
        pileta_precio=o.pileta_precio,
        pileta_moneda=o.pileta_moneda,
        pileta_imagen=o.pileta_imagen,
        stock_descontado=o.stock_descontado,
        piletas=o.piletas,
        subtotal=o.subtotal,
        traslado=o.traslado,
        instalacion=o.instalacion,
        descuento=o.descuento,
        total=o.total,
        sena_recibida=o.sena_recibida,
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
        observaciones=o.observaciones,
        observaciones_importantes=o.observaciones_importantes,
        created_at=o.created_at,
        updated_at=o.updated_at,
        cliente_nombre=o.cliente_nombre or (c.nombre if c else None),
        cliente_telefono_orden=o.cliente_telefono_orden,
        presupuesto_numero=p.numero if p else None
    )
