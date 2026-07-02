import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, getNextWorkOrderNumber, getWorkOrderPdf, previewWorkOrderPdf } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency, conceptosFabricacion } from '../../utils/formatters';
import EstadoBadge from '../../components/ui/EstadoBadge';
import useEntityForm from '../../hooks/useEntityForm';
import CroquisEditor from '../../components/croquis/CroquisEditor';
import PresupuestoPanel from '../../components/presupuesto/PresupuestoPanel';
import Loading from '../../components/common/Loading';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import FormHeader from '../../components/ordenes/FormHeader';
import FormFooter from '../../components/ordenes/FormFooter';
import WorkOrderFormBasic from './WorkOrderFormBasic';
import WorkOrderFormSpecs from './WorkOrderFormSpecs';
import WorkOrderFormItemsGrid from './WorkOrderFormItemsGrid';
import WorkOrderFormFinancial from './WorkOrderFormFinancial';
import WorkOrderFormObservations from './WorkOrderFormObservations';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import type { OrdenTrabajoPayload, EntityFormState, EntityServices, MaterialEnForm } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const ordenServices = {
  getById: getWorkOrder as EntityServices['getById'],
  create: createWorkOrder as EntityServices['create'],
  update: updateWorkOrder as EntityServices['update'],
  delete: deleteWorkOrder as EntityServices['delete'],
  getNextNumero: getNextWorkOrderNumber as EntityServices['getNextNumero'],
  getMateriales: getMaterials as EntityServices['getMateriales'],
  getPiletas: getPoolStock as EntityServices['getPiletas'],
  getClientes: getClients as EntityServices['getClientes'],
  getPdfUrl: getWorkOrderPdf,
  listPath: '/admin/work-orders',
};

export default function OrdenForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

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
    buildPayload,
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
    await updateWorkOrder(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' } as EntityFormState));
  };

  const handlePreviewPdf = async () => {
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    try {
      const payload = buildPayload();
      const res = await previewWorkOrderPdf(payload);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch (err) {
      const responseData = (err as { response?: { data?: unknown; status?: number } }).response?.data;
      const status = (err as { response?: { status?: number } }).response?.status;
      let detail: string | undefined;
      if (typeof responseData === 'string') {
        detail = responseData;
      } else if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
        detail = (responseData as { detail?: string }).detail;
      } else if (responseData && typeof responseData === 'object' && 'error' in responseData) {
        detail = (responseData as { error?: string }).error;
      }
      console.error('[preview-pdf] status:', status, 'data:', responseData, 'err:', err);
      notify(detail ? `${detail} (status ${status})` : `Error al generar la vista previa del PDF (status ${status})`, 'error');
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleClosePdfPreview = () => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
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
    <div className={s['work-order-form']}>
      <FormHeader
        className="orden-header"
        title={`Orden N° ${form.numero || 'A-_____'}`}
        badge={<EstadoBadge estado={form.estado} style={{ fontSize: 13, padding: '4px 14px' }} />}
        logoUrl={logoUrl}
        menuOpen={menuOpen}
        menuRef={menuRef}
        setMenuOpen={setMenuOpen}
        menuItems={[
          { label: 'Duplicar', icon: <Copy size={16} />, onClick: () => { setMenuOpen(false); notify('Duplicar orden — próximamente', 'info'); } },
          { label: 'Exportar PDF', icon: <FileDown size={16} />, onClick: () => { setMenuOpen(false); if (id) window.open(getWorkOrderPdf(id as string), '_blank'); else notify('Guardá la orden primero para exportar el PDF', 'info'); } },
          { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => { setMenuOpen(false); setDeleteConfirm(true); }, danger: true },
          { label: 'Historial', icon: <History size={16} />, onClick: () => { setMenuOpen(false); notify('Historial de cambios — próximamente', 'info'); } },
        ]}
      >
        {form.estado === 'MEDICION' && (
          <button className={s['work-order-form__btn-measurement']} onClick={() => handleCambioEstadoAccion('TALLER')} disabled={saving}>
            🏭 Enviar a Taller
          </button>
        )}
        {form.estado === 'TALLER' && (
          <button className={s['work-order-form__btn-workshop']} onClick={() => handleCambioEstadoAccion('TERMINADA')} disabled={saving}>
            ✅ Finalizar Trabajo
          </button>
        )}
        {form.estado === 'TERMINADA' && (
          <button className={s['work-order-form__btn-delivery']} onClick={() => handleCambioEstadoAccion('ENTREGADA')} disabled={saving}>
            🚚 Entregar al Cliente
          </button>
        )}
        {form.estado === 'ENTREGADA' && (
          <span className={s['work-order-form__badge-delivered']}>
            📦 Trabajo Entregado
          </span>
        )}
        <button className="btn btn-outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        <button className={`btn btn-primary ${s['work-order-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
        <button className="btn btn-outline" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Printer size={16} /> IMPRIMIR
        </button>
      </FormHeader>

      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <WorkOrderFormBasic
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clienteRef={clienteRef}
          showClienteDropdown={showClienteDropdown}
          setShowClienteDropdown={setShowClienteDropdown}
          clientesFiltrados={clientesFiltrados}
          handleClienteSelect={handleClienteSelect}
        />

        <WorkOrderFormSnapshot form={form} readOnly={readOnly} />

        <div className={`${s['work-order-form__layout']}${showCroquis ? '' : ' ' + s['work-order-form__layout--no-croquis']}`}>
          {showCroquis && (
            <div className={s['work-order-form__croquis']}>
              <CroquisEditor croquis={form.croquis} onChange={(v: unknown) => update('croquis', v)} readOnly={readOnly} />
            </div>
          )}
          <div className={s['work-order-form__right']}>
            <WorkOrderFormSpecs
              form={form}
              readOnly={readOnly}
              materiales={materiales}
              addMaterial={addMaterial}
              updateMaterial={updateMaterial}
              removeMaterial={removeMaterial}
              update={update}
              num={num}
            />
          </div>
        </div>

        <div className={s['work-order-form__bottom']}>
          <WorkOrderFormItemsGrid
            form={form}
            readOnly={readOnly}
            materiales={materiales}
            CONCEPTOS_M2={CONCEPTOS_M2}
            num={num}
            handleDetalleChange={handleDetalleChange}
            addDetalle={addDetalle}
            removeDetalle={removeDetalle}
          />

          <WorkOrderFormFinancial
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
            num={num}
            piletas={piletas}
            addPileta={addPileta}
            updatePileta={updatePileta}
            removePileta={removePileta}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
            handleConfirmarPago={handleConfirmarPago}
            mostrarToggleTitle={true}
            mostrarToggleColumns={false}
          />

          <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
        </div>

        <WorkOrderFormObservations
          form={form}
          readOnly={readOnly}
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
          update={update}
        />

        <FormFooter saving={saving} onCancel={() => navigate('/admin/work-orders')} />
      </form>

      <PdfPreviewModal
        isOpen={pdfPreviewUrl !== null || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        title="Vista previa — Orden de Trabajo"
      />
      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" />
    </div>
  );
}