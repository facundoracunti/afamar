from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from app.database import get_db
from app.models.cliente import Cliente as ClienteModel
from app.models.presupuesto import Presupuesto
from app.models.orden_trabajo import OrdenTrabajo
from app.schemas.cliente import ClienteCreate, ClienteUpdate, Cliente as ClienteSchema, ClienteList

router = APIRouter()

@router.get("/", response_model=List[ClienteList])
def listar_clientes(
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(ClienteModel)
    if search:
        query = query.filter(
            or_(
                ClienteModel.nombre.ilike(f"%{search}%"),
                ClienteModel.telefono.ilike(f"%{search}%"),
                ClienteModel.direccion.ilike(f"%{search}%"),
                ClienteModel.email.ilike(f"%{search}%")
            )
        )
    clientes = query.offset(skip).limit(limit).all()

    result = []
    for c in clientes:
        total_ordenes = db.query(OrdenTrabajo).filter(OrdenTrabajo.cliente_id == c.id).count()
        ultima_orden = db.query(OrdenTrabajo.numero).filter(
            OrdenTrabajo.cliente_id == c.id
        ).order_by(OrdenTrabajo.id.desc()).first()
        result.append(ClienteList(
            id=c.id,
            nombre=c.nombre,
            telefono=c.telefono,
            email=c.email,
            direccion=c.direccion,
            observaciones=c.observaciones,
            total_ordenes=total_ordenes,
            ultima_orden=ultima_orden[0] if ultima_orden else None,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))
    return result

@router.get("/{cliente_id}")
def obtener_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(ClienteModel).filter(ClienteModel.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")

    total_presupuestos = db.query(Presupuesto).filter(Presupuesto.cliente_id == cliente_id).count()
    total_ordenes = db.query(OrdenTrabajo).filter(OrdenTrabajo.cliente_id == cliente_id).count()
    total_comprado = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.cliente_id == cliente_id,
        OrdenTrabajo.estado.in_(["EN EL TALLER", "ENTREGADO"])
    ).with_entities(OrdenTrabajo.total).all()
    ultima_orden = db.query(OrdenTrabajo.numero).filter(
        OrdenTrabajo.cliente_id == cliente_id
    ).order_by(OrdenTrabajo.id.desc()).first()
    ordenes = db.query(OrdenTrabajo.id, OrdenTrabajo.numero, OrdenTrabajo.estado, OrdenTrabajo.total, OrdenTrabajo.created_at).filter(
        OrdenTrabajo.cliente_id == cliente_id
    ).order_by(OrdenTrabajo.id.desc()).limit(20).all()

    return {
        "id": cliente.id,
        "nombre": cliente.nombre,
        "telefono": cliente.telefono,
        "email": cliente.email,
        "direccion": cliente.direccion,
        "observaciones": cliente.observaciones,
        "created_at": cliente.created_at,
        "updated_at": cliente.updated_at,
        "total_presupuestos": total_presupuestos,
        "total_ordenes": total_ordenes,
        "total_comprado": sum(s[0] or 0 for s in total_comprado),
        "ultima_orden": ultima_orden[0] if ultima_orden else None,
        "ordenes": [{"id": o[0], "numero": o[1], "estado": o[2], "total": o[3], "created_at": o[4]} for o in ordenes]
    }

@router.post("/", response_model=ClienteSchema, status_code=201)
def crear_cliente(data: ClienteCreate, db: Session = Depends(get_db)):
    if data.telefono:
        existente = db.query(ClienteModel).filter(ClienteModel.telefono == data.telefono).first()
        if existente:
            raise HTTPException(400, f"Ya existe un cliente con el teléfono {data.telefono}: {existente.nombre}")
    cliente = ClienteModel(**data.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.put("/{cliente_id}", response_model=ClienteSchema)
def actualizar_cliente(cliente_id: int, data: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = db.query(ClienteModel).filter(ClienteModel.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    if data.telefono and data.telefono != cliente.telefono:
        existente = db.query(ClienteModel).filter(
            ClienteModel.telefono == data.telefono,
            ClienteModel.id != cliente_id
        ).first()
        if existente:
            raise HTTPException(400, f"Ya existe otro cliente con el teléfono {data.telefono}: {existente.nombre}")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cliente, key, value)
    db.commit()
    db.refresh(cliente)
    return cliente

@router.delete("/{cliente_id}", status_code=204)
def eliminar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(ClienteModel).filter(ClienteModel.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    db.delete(cliente)
    db.commit()
