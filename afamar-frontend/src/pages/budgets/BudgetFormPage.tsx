import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Printer, MoreVertical, Copy, FileDown, Trash2, History, FileOutput, Check, Send } from 'lucide-react';
import { getBudget, createBudget, updateBudget, deleteBudget, getNextBudgetNumber, getBudgetPdf, previewBudgetPdf, convertBudgetToWorkOrder, convertAlternativeToWorkOrder } from '@/api/resources/budgets';
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
import { useNotify } from '../../context/NotificationContext';
import OpcionesCotizacionGrid from '../../components/presupuesto/OpcionesCotizacionGrid';
import AprobacionSection from '../../components/ordenes/AprobacionSection';
import ObservacionesSection from '../../components/ordenes/ObservacionesSection';
import FormHeader from '../../components/ordenes/FormHeader';
import FormFooter from '../../components/ordenes/FormFooter';
import BudgetFormClient from './BudgetFormClient';
import BudgetFormSpecs from './BudgetFormSpecs';
import BudgetFormFinancial from './BudgetFormFinancial';
import BudgetFormItems from './BudgetFormItems';
import BudgetFormAdicionales from './BudgetFormAdicionales';
import BudgetFormObservations from './BudgetFormObservations';
import type { PresupuestoPayload, MaterialEnForm, EntityFormState, EntityServices } from '../../types';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const presupuestoServices: EntityServices = {
  getById: getBudget as EntityServices['getById'],
  create: createBudget as EntityServices['create'],
  update: updateBudget as EntityServices['update'],
  delete: deleteBudget as EntityServices['delete'],
  getNextNumero: getNextBudgetNumber as EntityServices['getNextNumero'],
  getMateriales: getMaterials as EntityServices['getMateriales'],
  getPiletas: getPoolStock as EntityServices['getPiletas'],
  getClientes: getClients as EntityServices['getClientes'],
  getPdfUrl: getBudgetPdf,
  listPath: '/admin/budgets',
};

export default function PresupuestoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ordenTrabajoNumero, setOrdenTrabajoNumero] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const notify = useNotify();
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
      await updateBudget(id as string, payload);
      const res = await convertBudgetToWorkOrder(id as string);
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
      const res = await convertAlternativeToWorkOrder(id as string, idx);
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
      await updateBudget(id as string, payload);
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
      await updateBudget(id as string, aprobado as unknown as Record<string, unknown>);
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
    const pdfUrl = getBudgetPdf(id as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Mármoles & Granitos. Podés revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handlePreviewPdf = async () => {
    setPdfPreviewLoading(true);
    setPdfPreviewUrl(null);
    try {
      const payload = buildPayload();
      const res = await previewBudgetPdf(payload);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
    } catch (err) {
      const responseData = (err as { response?: { data?: unknown } }).response?.data;
      let detail: string | undefined;
      if (typeof responseData === 'string') {
        detail = responseData;
      } else if (responseData && typeof responseData === 'object' && 'detail' in responseData) {
        detail = (responseData as { detail?: string }).detail;
      }
      console.error('Error al generar la vista previa del PDF:', err);
      notify(detail || 'Error al generar la vista previa del PDF', 'error');
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
    await updateBudget(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload, fecha_pago_saldo: nuevo ? hoy : '' } as EntityFormState));
  };

  return (
    <div className={s['budget-form']}>
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
          { label: 'Exportar PDF', icon: <FileDown size={16} />, onClick: () => { setMenuOpen(false); if (id) window.open(getBudgetPdf(id as string), '_blank'); else handlePreviewPdf(); } },
          { label: 'Guardar', icon: <Save size={16} />, onClick: () => { setMenuOpen(false); handleGuardar(); } },
          { label: 'Eliminar', icon: <Trash2 size={16} />, onClick: () => { setMenuOpen(false); setDeleteConfirm(true); }, danger: true },
          { label: 'Historial', icon: <History size={16} />, onClick: () => { setMenuOpen(false); alert('Historial de cambios'); } },
        ]}
      >
        <button className="btn btn-outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        {isEdit ? (
          ordenTrabajoNumero ? (
            <button type="button" className={s['budget-form__btn-ot']} onClick={() => navigate(`/admin/work-orders?search=${ordenTrabajoNumero}`)}>
              <FileOutput size={16} /> OT {ordenTrabajoNumero}
            </button>
          ) : form.estado === 'APROBADO' ? (
            <button type="button" className={s['budget-form__btn-convert']} onClick={handleConvertirGuardar}
              disabled={saving}>
              <FileOutput size={16} /> {saving ? 'CONVIRTIENDO...' : 'CONVERTIR A ORDEN'}
            </button>
          ) : ['PENDIENTE', 'ENVIADO'].includes(form.estado) ? (
            <button type="button" className={s['budget-form__btn-approve']} onClick={handleAprobar}
              disabled={saving}>
              <Check size={16} /> {saving ? 'APROBANDO...' : 'APROBAR PRESUPUESTO'}
            </button>
          ) : null
        ) : (
          <button className={`btn btn-primary ${s['budget-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
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
        <BudgetFormClient
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clienteRef={clienteRef}
          showClienteDropdown={showClienteDropdown}
          setShowClienteDropdown={setShowClienteDropdown}
          clientesFiltrados={clientesFiltrados}
          handleClienteSelect={handleClienteSelect}
        />

        <div className={`${s['budget-form__layout']}${showCroquis ? '' : ' ' + s['budget-form__layout--no-croquis']}`}>
          {showCroquis && (
            <div className={s['budget-form__croquis']}>
              <CroquisEditor croquis={form.croquis} onChange={(v: unknown) => update('croquis', v)} readOnly={readOnly} />
            </div>
          )}
          <div className={s['budget-form__right']}>
            <BudgetFormSpecs
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

        <div className={s['budget-form__bottom']}>
          <BudgetFormItems
            form={form}
            readOnly={readOnly}
            materiales={materiales}
            CONCEPTOS_M2={CONCEPTOS_M2}
            num={num}
            handleDetalleChange={handleDetalleChange}
            addDetalle={addDetalle}
            removeDetalle={removeDetalle}
          />

          <BudgetFormAdicionales
            form={form}
            readOnly={readOnly}
            piletas={piletas}
            update={update}
            updatePileta={updatePileta}
            removePileta={removePileta}
            addPileta={addPileta}
            num={num}
          />

          <BudgetFormFinancial
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
            alternativasTop={alternativasTop}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
          />

          <AprobacionSection form={form} readOnly={readOnly} update={update as (field: string, value: unknown) => void} />
        </div>

        <BudgetFormObservations
          form={form}
          readOnly={readOnly}
          update={update}
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
        />

        <FormFooter saving={saving} onCancel={() => navigate('/admin/budgets')} />
      </form>

      <ConfirmDialog isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar presupuesto" message="¿Estás seguro de eliminar este PRESUPUESTO LOCAL?" />

      <PdfPreviewModal
        isOpen={!!pdfPreviewUrl || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        title="Vista previa — Presupuesto"
      />
    </div>
  );
}