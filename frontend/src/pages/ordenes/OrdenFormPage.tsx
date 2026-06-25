import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History, Plus, X } from 'lucide-react';
import { getOrden, createOrden, updateOrden, deleteOrden, getNextNumero, getMateriales, getPiletas, getClientes, getOrdenPdf } from '../../services/api';
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
import ClienteSection from '../../components/ordenes/ClienteSection';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import ObservacionesSection from '../../components/ordenes/ObservacionesSection';
import FormHeader from '../../components/ordenes/FormHeader';
import FormFooter from '../../components/ordenes/FormFooter';
import type { OrdenTrabajoPayload, EntityFormState, EntityServices } from '../../types';

const ordenServices = {
  getById: getOrden as EntityServices['getById'],
  create: createOrden as EntityServices['create'],
  update: updateOrden as EntityServices['update'],
  delete: deleteOrden as EntityServices['delete'],
  getNextNumero: getNextNumero as EntityServices['getNextNumero'],
  getMateriales: getMateriales as EntityServices['getMateriales'],
  getPiletas: getPiletas as EntityServices['getPiletas'],
  getClientes: getClientes as EntityServices['getClientes'],
  getPdfUrl: getOrdenPdf,
  listPath: '/admin/ordenes',
};

export default function OrdenForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const {
    form, loading, saving, materiales, piletas, logoUrl,
    showClienteDropdown, menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, clientesFiltrados,
    modoUSD, toggleModoUSD,
    menuRef, clienteRef,
    setForm,
    setMenuOpen, setDeleteConfirm, setShowClienteDropdown, setShowCroquis,
    update,
    handleClienteSelect, handleTrasladoChange,
    handleSenaMonedaChange, handleSenaMontoChange, handleDolarDiaChange,
    handleDetalleChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit, handleDelete, handleCambioEstadoAccion, handlePrint,
    CONCEPTOS_M2,
  } = useEntityForm({
    entityType: 'orden',
    services: ordenServices,
    defaultEstado: 'MEDICION',
    id,
    navigate,
  });

  if (loading) return <Loading />;

  const matsMain = hayAlternativas ? (form.materiales || []).filter((m) => !m.es_alternativa) : (form.materiales || []);
  const matsAlt = (form.materiales || []).filter((m) => m.es_alternativa);

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
    await updateOrden(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' } as EntityFormState));
  };

  const alternativasGrid = hayAlternativas ? (
    <div style={{ marginTop: 16 }}>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>📋 PRESUPUESTO COMPARATIVO</span>
        <span style={{ fontSize: 11, color: '#3b82f6', marginLeft: 8 }}>{matsAlt.length} opciones alternativas</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {matsAlt.map((mat, idx) => {
          const letra = String.fromCharCode(65 + idx);
          const dd2 = Number(form.dolar_dia);
          const m2 = Number(mat.largo || 0) * Number(mat.ancho || 0) * (mat.cantidad || 1);
          const costoMat = mat.moneda === 'USD' ? m2 * (mat.precio_m2_usd || 0) : m2 * (mat.precio_m2 || 0);
          const costoMatArs = mat.moneda === 'USD' ? (dd2 > 0 ? costoMat * dd2 : 0) : costoMat;
          const fijosArsAlt = (form.detalles_fabricacion || []).reduce((s: number, d) => s + (Number(d.precio) || 0) * (d.cantidad || 1), 0)
            + (form.piletas || []).reduce((s: number, pt) => s + (Number(pt.precio) || 0) * (pt.cantidad || 1), 0)
            + (Number(form.traslado) || 0);
          const totalArs = costoMatArs + fijosArsAlt;
          const mostrarUSDAlt = modoUSD && dd2 > 0;
          return (
            <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: 4 }}>Alternativa {letra}</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{mat.cantidad || 1} pza. ({m2.toFixed(3)} m²)</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', marginBottom: 2 }}>{mat.nombre as string}</div>
                {mat.moneda === 'USD' && <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 8 }}>USD {costoMat.toFixed(2)}</div>}
                <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 6, fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Material:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{mostrarUSDAlt ? `USD ${(costoMatArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${costoMatArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Trabajos + Piletas + Traslado:</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{mostrarUSDAlt ? `USD ${(fijosArsAlt / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${fijosArsAlt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, textAlign: 'center', background: '#fff', borderRadius: 6, padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Total alternativa {mostrarUSDAlt ? '(USD)' : ''}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{mostrarUSDAlt ? `USD ${(totalArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${Math.round(totalArs).toLocaleString('es-AR')}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
        * Todos los totales incluyen la misma configuraci&oacute;n de trabajos, piletas y traslados.
      </div>
    </div>
  ) : null;

  const descuentoBlock = (
    <>
      {form.descuento_porcentaje > 0 && (() => {
        const descPct = form.descuento_porcentaje || 0;
        const recargoPct = form.recargo_pct || 0;
        const totalActual = form.total || 0;
        const totalSinRecargo = recargoPct > 0 ? Math.round(totalActual / (1 + recargoPct / 100)) : totalActual;
        const precioBase = Math.round(totalSinRecargo / (1 - descPct / 100));
        const precioLista = recargoPct > 0 ? precioBase + Math.round(precioBase * recargoPct / 100) : precioBase;
        const descuentoEnPesos = Math.round(precioLista * descPct / 100);
        return (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, fontSize: 13 }}>
            <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#92400e', textAlign: 'center' }}>
              📌 Este pedido se guard&oacute; con un <span style={{ fontSize: 14 }}>{descPct}%</span> de descuento aplicado
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #dcfce7', fontWeight: 700, color: '#374151' }}>
              <span>Precio Lista (Original)</span>
              <span>{formatCurrency(precioLista)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontWeight: 700, color: '#dc2626' }}>
              <span>Descuento Aplicado</span>
              <span>{descPct}% OFF (-{formatCurrency(descuentoEnPesos)})</span>
            </div>
          </div>
        );
      })()}
      {form.forma_pago === 'EFECTIVO' && (
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
      )}
    </>
  );

  return (
    <div className="orden-form">
        <FormHeader
          className="orden-header"
          title={`Orden N° ${form.numero || 'A-_____'}`}
          badge={<EstadoBadge estado={form.estado} style={{ fontSize: 13, padding: '4px 14px' }} />}
          logoUrl={logoUrl}
          menuOpen={menuOpen}
          menuRef={menuRef}
          setMenuOpen={setMenuOpen}
          menuItems={[
            { label: 'Duplicar', icon: <Copy size={16} />, onClick: () => { setMenuOpen(false); alert('Duplicar orden'); } },
            { label: 'Exportar PDF', icon: <FileDown size={16} />, onClick: () => { setMenuOpen(false); alert('Exportar PDF'); } },
            { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => { setMenuOpen(false); setDeleteConfirm(true); }, danger: true },
            { label: 'Historial', icon: <History size={16} />, onClick: () => { setMenuOpen(false); alert('Historial de cambios'); } },
          ]}
        >
          {form.estado === 'MEDICION' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('TALLER')} disabled={saving}
              style={{ background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              🏭 Enviar a Taller
            </button>
          )}
          {form.estado === 'TALLER' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('TERMINADA')} disabled={saving}
              style={{ background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ✅ Finalizar Trabajo
            </button>
          )}
          {form.estado === 'TERMINADA' && (
            <button className="btn" onClick={() => handleCambioEstadoAccion('ENTREGADA')} disabled={saving}
              style={{ background: '#9333ea', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              🚚 Entregar al Cliente
            </button>
          )}
          {form.estado === 'ENTREGADA' && (
            <span style={{ background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
              📦 Trabajo Entregado
            </span>
          )}
          <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={16} /> VISTA PREVIA PDF
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ background: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px' }}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
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

        {/* ===== BOTÓN CROQUIS COLAPSABLE ===== */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-outline" onClick={() => setShowCroquis(!showCroquis)}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}>
            {showCroquis ? '👁️' : '📐'} {showCroquis ? 'Ocultar Diseño / Croquis' : 'Activar Diseño / Croquis'}
          </button>
          {!showCroquis && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>El croquis está oculto. Hacé clic para diseñar.</span>
          )}
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

            {form.estado === 'MEDICION' && form.detalles_presupuestados.length > 0 && (
              <div style={{ marginTop: 16, borderTop: '2px solid #1e40af', paddingTop: 12 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>📐 COMPARATIVA DE MEDICIÓN</h4>
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th style={{ textAlign: 'center' }}>M² Presupuestado</th>
                      <th style={{ textAlign: 'center' }}>M² Medición Real</th>
                      <th style={{ textAlign: 'center' }}>Diferencia Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.detalles_fabricacion.map((d, i) => {
                      if (!CONCEPTOS_M2.includes(d.concepto)) return null;
                      const pres = form.detalles_presupuestados[i];
                      if (!pres) return null;
                      const m2Ori = Number(pres.m2) || 0;
                      const m2Real = d.m2 || 0;
                      const dif = Math.round((m2Real - m2Ori) * 100000) / 100000;
                      const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                      return (
                        <tr key={'med_' + i}>
                          <td style={{ fontWeight: 600 }}>{d.concepto === 'OTRA' ? (d.detalle || 'OTRA') : d.concepto}</td>
                          <td style={{ textAlign: 'center' }}>{m2Ori.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: difColor }}>
                            {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
                          </td>
                        </tr>
                      );
                    })}
                    {(form.materiales || []).filter((m) => Number(m.largo || 0) * Number(m.ancho || 0) > 0).map((m, i) => {
                      const m2Real = Number(m.largo || 0) * Number(m.ancho || 0) * (m.cantidad || 1);
                      const m2Pres = m.m2_presupuestado || 0;
                      const dif = Math.round((m2Real - m2Pres) * 100000) / 100000;
                      const difColor = dif > 0 ? '#16a34a' : dif < 0 ? '#dc2626' : '#6b7280';
                      return (
                        <tr key={'mat_' + i}>
                          <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                          <td style={{ textAlign: 'center' }}>{m2Pres.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{m2Real.toFixed(5)} m²</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: difColor }}>
                            {dif > 0 ? '+' : ''}{dif.toFixed(5)} m²
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Panel 2: Pileta */}
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
            alternativasTop={null}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
            mostrarToggleTitle={true}
            mostrarToggleColumns={false}
          />

          <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
        </div>

        <ObservacionesSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />

        <FormFooter saving={saving} onCancel={() => navigate('/admin/ordenes')} />
      </form>

      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" />
    </div>
  );
}
