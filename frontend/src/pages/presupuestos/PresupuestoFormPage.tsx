import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History, Plus, X, FileOutput, Check, Send } from 'lucide-react';
import { getPresupuesto, createPresupuesto, updatePresupuesto, deletePresupuesto, getNextPresupuestoNumero, getMateriales, getPiletas, getClientes, convertirAOrden, getPresupuestoPdf } from '../../services/api';
import { formatCurrency, conceptosFabricacion } from '../../utils/formatters';
import EstadoBadge from '../../components/ui/EstadoBadge';
import useEntityForm from '../../hooks/useEntityForm';
import CroquisEditor from '../../components/croquis/CroquisEditor';
import PresupuestoPanel from '../../components/presupuesto/PresupuestoPanel';
import Loading from '../../components/common/Loading';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import MaterialCard from '../../components/materiales/MaterialCard';
import PiletaCard from '../../components/materiales/PiletaCard';
import FabricacionTable from '../../components/presupuesto/FabricacionTable';
import OpcionesCotizacionGrid from '../../components/presupuesto/OpcionesCotizacionGrid';
import ClienteSection from '../../components/ordenes/ClienteSection';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import ObservacionesSection from '../../components/ordenes/ObservacionesSection';
import FormHeader from '../../components/ordenes/FormHeader';
import FormFooter from '../../components/ordenes/FormFooter';
import type { PresupuestoPayload, MaterialEnForm, EntityFormState, EntityServices } from '../../types';

const presupuestoServices: EntityServices = {
  getById: getPresupuesto as EntityServices['getById'],
  create: createPresupuesto as EntityServices['create'],
  update: updatePresupuesto as EntityServices['update'],
  delete: deletePresupuesto as EntityServices['delete'],
  getNextNumero: getNextPresupuestoNumero as EntityServices['getNextNumero'],
  getMateriales: getMateriales as EntityServices['getMateriales'],
  getPiletas: getPiletas as EntityServices['getPiletas'],
  getClientes: getClientes as EntityServices['getClientes'],
  getPdfUrl: getPresupuestoPdf,
  listPath: '/admin/presupuestos',
};

export default function PresupuestoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ordenTrabajoNumero, setOrdenTrabajoNumero] = useState<string | null>(null);
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const {
    form, loading, saving, materiales, piletas, logoUrl,
    showClienteDropdown, menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, clientesFiltrados, isEdit,
    modoUSD, toggleModoUSD,
    menuRef, clienteRef,
    setForm, setSaving,
    setMenuOpen, setDeleteConfirm, setShowClienteDropdown, setShowCroquis,
    update, buildPayload,
    handleClienteSelect, handleTrasladoChange,
    handleSenaMonedaChange, handleSenaMontoChange, handleDolarDiaChange,
    handleDetalleChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit, handleDelete, handlePrint,
    CONCEPTOS_M2,
  } = useEntityForm({
    entityType: 'presupuesto',
    services: presupuestoServices,
    defaultEstado: 'PENDIENTE',
    id,
    navigate,
    onLoaded: (data: Record<string, unknown>) => {
      setOrdenTrabajoNumero((data.orden_trabajo_numero as string) || null);
    },
  });

  const handleConvertirGuardar = async () => {
    if (!window.confirm('¿Convertir este presupuesto en Orden de Trabajo?\n\nSe guardará y copiará toda la información: croquis, material, detalles de fabricación, pileta, firma, precios y condiciones comerciales.')) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      await updatePresupuesto(id as string, payload);
      const res = await convertirAOrden(id as string);
      setOrdenTrabajoNumero(res.data.numero);
      setForm((prev) => ({ ...prev, estado: 'CONVERTIDO A OT' }));
      alert(`¡Orden ${res.data.numero} creada exitosamente!`);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al convertir');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertirAlternativa = async (idx: number) => {
    if (!id) { alert('Primero guardá el presupuesto para poder convertir una alternativa.'); return; }
    if (!window.confirm('¿Convertir esta alternativa en Orden de Trabajo? Se creará una nueva OT con el material de esta opción más los trabajos comunes.')) return;
    setSaving(true);
    try {
      const { convertirAlternativaAOrden } = await import('../../services/api');
      const res = await convertirAlternativaAOrden(id as string, idx);
      if (res.status === 201) {
        alert(`¡Orden ${res.data.numero} creada exitosamente desde alternativa "${res.data.alternativa_nombre}"!`);
      }
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Error al convertir la alternativa');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await updatePresupuesto(id as string, payload);
    } catch {
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAprobar = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      const aprobado = { ...payload, estado: 'APROBADO' as const } as PresupuestoPayload;
      if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.forma_pago)) {
        aprobado.sena_recibida = Number(form.total);
        aprobado.saldo_pendiente = 0;
        aprobado.saldo_pagado = true;
        aprobado.sena_usd = Number(form.total_usd);
        aprobado.saldo_pendiente_usd = 0;
        aprobado.fecha_pago_saldo = new Date().toISOString().split('T')[0];
      }
      await updatePresupuesto(id as string, aprobado as unknown as Record<string, unknown>);
      setForm((prev) => ({ ...prev, ...aprobado, estado: 'APROBADO' }) as EntityFormState);
    } catch {
      alert('Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarWhatsApp = () => {
    const telefono = (form.cliente_telefono_orden || '').replace(/[^\d]/g, '');
    const nombre = form.cliente_nombre || '';
    const pdfUrl = getPresupuestoPdf(id as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Mármoles & Granitos. Podés revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) return <Loading />;

  const dd2 = Number(form.dolar_dia) || 1;
  let sumatoriaAdicionalesARS = Number(form.traslado || 0);
  const detalleTrabajosComunes: { concepto: string; cant: number; total: number }[] = [];
  if (Number(form.traslado || 0) > 0) {
    detalleTrabajosComunes.push({ concepto: 'Traslado', cant: 1, total: Number(form.traslado) });
  }
  (form.detalles_fabricacion || []).forEach((item) => {
    const totalItem = Number(item.precio || 0) * Number(item.cantidad || 1);
    const totalItemARS = item.moneda === 'USD' ? (dd2 > 0 ? totalItem * dd2 : 0) : totalItem;
    if (totalItemARS > 0) {
      sumatoriaAdicionalesARS += totalItemARS;
      detalleTrabajosComunes.push({ concepto: (item.concepto as string) + (item.detalle ? ` - ${item.detalle as string}` : ''), cant: Number(item.cantidad || 1), total: totalItemARS });
    }
  });
  (form.piletas || []).forEach((pil) => {
    const totalPil = Number(pil.precio || 0) * Number(pil.cantidad || 1);
    const totalPilARS = pil.moneda === 'USD' ? (dd2 > 0 ? totalPil * dd2 : 0) : totalPil;
    if (totalPilARS > 0) {
      sumatoriaAdicionalesARS += totalPilARS;
      detalleTrabajosComunes.push({ concepto: `Pileta ${(pil.marca as string) || ''} ${(pil.modelo as string) || ''}`.trim(), cant: Number(pil.cantidad || 1), total: totalPilARS });
    }
  });
  const matsMain = hayAlternativas ? (form.materiales || []).filter((m) => !m.es_alternativa) : (form.materiales || []);
  const matsAlt = (form.materiales || []).filter((m) => m.es_alternativa);

  const alternativasTop = hayAlternativas ? (
    <div style={{ marginTop: 0 }}>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              DETALLE DE FABRICACI&Oacute;N Y ACCESORIOS COMUNES
            </h3>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
              Estos trabajos se aplican y ya est&aacute;n sumados en cada una de las opciones de abajo.
            </p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: 6, textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>D&oacute;lar Ref.</span>
            <input type="number" style={{ width: 100, fontSize: 12, fontWeight: 900, color: '#334155', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', textAlign: 'center', background: '#fff' }} value={form.dolar_dia || ''} onChange={(e) => setForm({ ...form, dolar_dia: Number(e.target.value) || 0 })} />
          </div>
        </div>
        {detalleTrabajosComunes.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '4px 16px', fontSize: 12, fontWeight: 500, color: '#475569' }}>
            {detalleTrabajosComunes.map((job, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span>&#10003; {job.concepto} ({job.cant > 1 ? `x${job.cant}` : 'x1'})</span>
                <span style={{ color: '#1e293b', fontWeight: 700 }}>$ {job.total.toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No hay trabajos adicionales comunes configurados.</p>
        )}
      </div>
    </div>
  ) : null;

  const alternativasGrid = hayAlternativas && materiales ? (
    <OpcionesCotizacionGrid
      alternativas={matsAlt.map((mat: MaterialEnForm, altIdx: number) => {
        const ddLocal = Number(form.dolar_dia) || 1;
        const m2 = Number(mat.largo || 0) * Number(mat.ancho || 0) * (mat.cantidad || 1);
        const costoMat = mat.moneda === 'USD' ? m2 * (mat.precio_m2_usd || 0) : m2 * (mat.precio_m2 || 0);
        const costoMatArs = mat.moneda === 'USD' ? (ddLocal > 0 ? costoMat * ddLocal : 0) : costoMat;
        const totalFinalARS = costoMatArs + sumatoriaAdicionalesARS;
        return { nombre: mat.nombre || '', categoria: mat.categoria || '', moneda: mat.moneda || 'ARS', costoMaterialBase: costoMat, totalFinalARS, largo: Number(mat.largo || 0), ancho: Number(mat.ancho || 0), cant: mat.cantidad || 1 };
      })}
      detalleTrabajosComunes={detalleTrabajosComunes}
      tipoCambio={Number(form.dolar_dia) || 1}
      presupuestoId={id}
      onConvertirAlternativa={handleConvertirAlternativa}
      modoUSD={modoUSD}
    />
  ) : null;

  const descuentoBlock = form.forma_pago === 'EFECTIVO' ? (
    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        &#128274; Descuento Comercial (Solo Vendedor)
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>%</span>
          <input type="number" className="input" style={{ width: 70, textAlign: 'right' }}
            placeholder="0" min="0" max="100"
            value={form.descuento_porcentaje || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              setForm({ ...form, descuento_porcentaje: val, descuento_monto_fijo: val > 0 ? 0 : form.descuento_monto_fijo });
            }}
            disabled={readOnly} />
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>o</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>$</span>
          <input type="number" className="input" style={{ width: 100, textAlign: 'right' }}
            placeholder="Monto fijo"
            value={form.descuento_monto_fijo || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              setForm({ ...form, descuento_monto_fijo: val, descuento_porcentaje: val > 0 ? 0 : form.descuento_porcentaje });
            }}
            disabled={readOnly} />
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
        Este descuento modifica el TOTAL ARS final pero no se muestra en el PDF del cliente.
      </div>
    </div>
  ) : null;

  const handleConfirmarPago = async () => {
    if (!id) return;
    const nuevo = !form.saldo_pagado;
    const hoy = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = {
      saldo_pagado: nuevo,
      fecha_pago_saldo: nuevo ? hoy : null,
    };
    if (nuevo) {
      payload.sena_recibida = Number(form.total);
      payload.sena_moneda = 'ARS';
      payload.saldo_pendiente = 0;
      payload.sena_usd = Number(form.total_usd);
      payload.saldo_pendiente_usd = 0;
    }
    await updatePresupuesto(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' } as EntityFormState));
  };

  return (
    <div className="presupuesto-form">
        <FormHeader
          className="presupuesto-header"
          title={`Presupuesto N° ${form.numero || 'P-_____'}`}
          badge={!['PENDIENTE'].includes(form.estado) ? <EstadoBadge estado={form.estado} style={{ fontSize: 13, padding: '4px 14px' }} /> : undefined}
          logoUrl={logoUrl}
          menuOpen={menuOpen}
          menuRef={menuRef}
          setMenuOpen={setMenuOpen}
          menuItems={[
            { label: 'Duplicar', icon: <Copy size={16} />, onClick: () => { setMenuOpen(false); alert('Duplicar presupuesto'); } },
            { label: 'Exportar PDF', icon: <FileDown size={16} />, onClick: () => { setMenuOpen(false); window.open(getPresupuestoPdf(id as string), '_blank'); } },
            { label: 'Guardar', icon: <Save size={16} />, onClick: () => { setMenuOpen(false); handleGuardar(); } },
            { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => { setMenuOpen(false); setDeleteConfirm(true); }, danger: true },
            { label: 'Historial', icon: <History size={16} />, onClick: () => { setMenuOpen(false); alert('Historial de cambios'); } },
          ]}
        >
          <button className="btn btn-outline" onClick={() => window.open(getPresupuestoPdf(id as string), '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={16} /> VISTA PREVIA PDF
          </button>
          {isEdit ? (
            ordenTrabajoNumero ? (
              <button type="button" className="btn" onClick={() => navigate(`/admin/ordenes?search=${ordenTrabajoNumero}`)}
                style={{ background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                <FileOutput size={16} /> OT {ordenTrabajoNumero}
              </button>
            ) : form.estado === 'APROBADO' ? (
              <button type="button" className="btn" onClick={handleConvertirGuardar}
                disabled={saving}
                style={{ background: '#b91c1c', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                <FileOutput size={16} /> {saving ? 'CONVIRTIENDO...' : 'CONVERTIR A ORDEN'}
              </button>
            ) : ['PENDIENTE', 'ENVIADO'].includes(form.estado) ? (
              <button type="button" className="btn" onClick={handleAprobar}
                disabled={saving}
                style={{ background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                <Check size={16} /> {saving ? 'APROBANDO...' : 'APROBAR PRESUPUESTO'}
              </button>
            ) : null
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px' }}>
              <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
            </button>
          )}
          <button className="btn btn-success" onClick={handleEnviarWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}>
            <Send size={16} /> WhatsApp
          </button>
          <button className="btn btn-outline" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> IMPRIMIR
          </button>
        </FormHeader>
 
      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <ClienteSection
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clienteRef={clienteRef}
          showClienteDropdown={showClienteDropdown}
          setShowClienteDropdown={setShowClienteDropdown}
          clientesFiltrados={clientesFiltrados}
          handleClienteSelect={handleClienteSelect}
        />

        {/* ===== ÁREA CENTRAL: Croquis 70% | Materiales 30% ===== */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-outline" onClick={() => setShowCroquis(!showCroquis)}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}>
            {showCroquis ? '👁️' : '📐'} {showCroquis ? 'Ocultar Diseño' : 'Activar Diseño'}
          </button>
          {!showCroquis && <span style={{ fontSize: 12, color: '#94a3b8' }}>Croquis oculto.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: showCroquis ? '7fr 3fr' : '1fr', gap: 16, marginTop: 16 }}>
          {showCroquis && (
          <div style={{ minWidth: 0 }}>
            <CroquisEditor croquis={form.croquis} onChange={(v: unknown) => update('croquis', v)} readOnly={readOnly} />
          </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="card" style={{ height: '100%' }}>
              <h3 className="section-title">MATERIALES</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select className="input" style={{ flex: 1, fontSize: 13 }} value="" onChange={(e) => { addMaterial(e.target.value); e.target.value = ''; }} disabled={readOnly}>
                  <option value="">+ AGREGAR MATERIAL</option>
                  {materiales.filter((m: Record<string, unknown>) => m.nombre).map((m: Record<string, unknown>) => (
                    <option key={m.id as number} value={m.nombre as string}>{m.nombre as string}{m.color ? ` - ${m.color as string}` : ''}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {(form.materiales || []).map((mat, idx) => (
                <MaterialCard key={idx} mat={mat as unknown as Record<string, unknown>} idx={idx} readOnly={readOnly} updateMaterial={updateMaterial} removeMaterial={removeMaterial} num={num as (v: unknown) => number} />
              ))}
              </div>
              {(form.materiales || []).length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Sin materiales agregados. Usá "+ AGREGAR MATERIAL" para sumar.
                </div>
              )}
              <div className="form-group">
                <label>Observaciones del diseño</label>
                <textarea className="input" rows={4} value={form.observaciones_diseno} onChange={(e) => update('observaciones_diseno', e.target.value)} placeholder="Zócalo de 7 cm. Frente de 4 cm. Incluye 3 perforaciones..." disabled={readOnly} />
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECCIÓN INFERIOR: 4 paneles ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Panel 1: Detalle de Fabricación y Adicionales */}
          <div className="card">
            <FabricacionTable detalles={form.detalles_fabricacion as unknown as Record<string, unknown>[]} readOnly={readOnly} handleDetalleChange={handleDetalleChange} addDetalle={addDetalle} removeDetalle={removeDetalle} materiales={materiales} CONCEPTOS_M2={CONCEPTOS_M2} conceptosFabricacion={conceptosFabricacion} num={num as (v: unknown) => number} />
          </div>

          {/* Panel 2: Piletas */}
          <div className="card">
            <h3 className="section-title">PILETAS</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select className="input" style={{ flex: 1, fontSize: 13 }} value="" onChange={(e) => { addPileta(e.target.value); e.target.value = ''; }} disabled={readOnly}>
                <option value="">+ AGREGAR PILETA</option>
                {piletas.map((p: Record<string, unknown>) => (
                  <option key={p.id as number} value={p.id as number}>{p.marca as string} - {p.modelo as string} (Stock: {p.cantidad as number})</option>
                ))}
              </select>
            </div>
            {(form.piletas || []).map((pt, idx) => (
              <PiletaCard key={idx} pt={pt as unknown as Record<string, unknown>} idx={idx} piletas={piletas} readOnly={readOnly} updatePileta={updatePileta} removePileta={removePileta} formPiletas={form.piletas as unknown as Record<string, unknown>[]} update={update as (field: string, value: unknown) => void} num={num as (v: unknown) => number} />
            ))}
          </div>

          <PresupuestoPanel
            form={form}
            modoUSD={modoUSD}
            toggleModoUSD={toggleModoUSD}
            hayUSD={hayUSD}
            hayAlternativas={hayAlternativas}
            readOnly={readOnly}
            saving={saving}
            handleTrasladoChange={handleTrasladoChange}
            handleSenaMonedaChange={handleSenaMonedaChange}
            handleSenaMontoChange={handleSenaMontoChange}
            handleDolarDiaChange={handleDolarDiaChange}
            setForm={setForm}
            update={update as (field: string, value: unknown) => void}
            num={num as (v: unknown) => number}
            hidePaymentSection={hayAlternativas}
            alternativasTop={alternativasTop}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
          />

          <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
        </div>

        <ObservacionesSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />

        <FormFooter saving={saving} onCancel={() => navigate('/admin/presupuestos')} />
      </form>

      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar presupuesto" message="¿Estás seguro de eliminar este PRESUPUESTO LOCAL?" />
    </div>
  );
}
