import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save, FileOutput, Check, Send } from 'lucide-react';
import { getBudget, createBudget, updateBudget, deleteBudget, getNextBudgetNumber, getBudgetPdf, previewBudgetPdf, convertBudgetToWorkOrder, convertAlternativeToWorkOrder } from '@/api/resources/budgets';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency, fabricationConcepts } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import CroquisEditor from '../../components/sketch/CroquisEditor';
import BudgetPanel from '../../components/budget/BudgetPanel';
import Loading from '../../components/common/Loading';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PdfPreviewModal from '../../components/common/PdfPreviewModal';
import TermsEditor from '../../components/common/TermsEditor';
import { useNotify } from '../../context/NotificationContext';
import QuoteOptionsGrid from '../../components/budget/QuoteOptionsGrid';

import ObservationsSection from '../../components/orders/ObservationsSection';
import FormHeader from '../../components/orders/FormHeader';
import FormFooter from '../../components/orders/FormFooter';
import BudgetFormClient from './BudgetFormClient';
import BudgetFormSpecs from './BudgetFormSpecs';
import BudgetFormFinancial from './BudgetFormFinancial';
import BudgetFormItems from './BudgetFormItems';
import BudgetFormAdicionales from './BudgetFormAdicionales';
import BudgetFormObservations from './BudgetFormObservations';
import type { BudgetPayload, MaterialInForm, PoolInForm, EntityFormState, EntityServices } from '../../types';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const presupuestoServices: EntityServices = {
  getById: getBudget as EntityServices['getById'],
  create: createBudget as EntityServices['create'],
  update: updateBudget as EntityServices['update'],
  delete: deleteBudget as EntityServices['delete'],
  getNextNumero: getNextBudgetNumber as EntityServices['getNextNumero'],
  getMaterials: getMaterials as EntityServices['getMaterials'],
  getPools: getPoolStock as EntityServices['getPools'],
  getClients: getClients as EntityServices['getClients'],
  getPdfUrl: getBudgetPdf,
  listPath: '/admin/budgets',
};

export default function BudgetForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [workOrderNumber, setWorkOrderNumber] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [budgetTerms, setBudgetTerms] = useState<string[]>([]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([]);
  const notify = useNotify();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const encodeTerms = (items: string[]) => JSON.stringify(items.map((t) => t).filter((t) => t.trim() !== ''));

  const {
    form, loading, saving, materiales, piletas, logoUrl, clientes, refreshClientes,
    menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, isEdit,
    modoUSD, toggleModoUSD,
    menuRef,
    setForm, setSaving,
    setMenuOpen, setDeleteConfirm, setShowCroquis,
    update, buildPayload,
    handleTransportChange,
    handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit: legacyHandleSubmit, handleDelete, handlePrint,
    M2_CONCEPTS,
  } = useEntityForm({
    entityType: 'budget',
    services: presupuestoServices,
    defaultEstado: 'PENDING',
    id,
    navigate,
    onLoaded: (data: Record<string, unknown>) => {
      setWorkOrderNumber((data.work_order_number as string) || null);
    },
  });

  // Wrap the legacy submit so the budgets list cache is invalidated on
  // every successful save (the default 5min staleTime would otherwise
  // keep the previous list visible after navigation).
  const handleSubmit = async (e?: React.FormEvent) => {
    await legacyHandleSubmit(e);
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  const buildPayloadWithTerms = (): Record<string, unknown> => ({
    ...buildPayload(),
    budget_terms_override: encodeTerms(budgetTerms),
    warranty_override: encodeTerms(warrantyTerms),
  });

  const handleConvertirGuardar = async () => {
    if (!window.confirm('¿Convertir este presupuesto en Orden de Trabajo?\n\nSe guardará y copiará toda la información: croquis, material, detalles de fabricación, pileta, firma, precios y condiciones comerciales.')) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      const res = await convertBudgetToWorkOrder(id as string);
      setWorkOrderNumber(res.data.number);
      setForm((prev) => ({ ...prev, status: 'CONVERTED_TO_OT' }));
      alert(`¡Orden ${res.data.number} creada exitosamente!`);
      // Both lists change: budget becomes CONVERTED_TO_OT, OT is created.
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
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
        alert(`¡Orden ${res.data.number} creada exitosamente desde alternativa "${res.data.alternative_name}"!`);
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
        queryClient.invalidateQueries({ queryKey: ['work-orders'] });
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
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
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
      const aprobado = { ...payload, status: 'APPROVED' as const } as unknown as BudgetPayload;
      if (['TARJETA DE CRÉDITO', 'TARJETA DE DÉBITO'].includes(form.payment_method)) {
        aprobado.deposit_received = Number(form.total);
        aprobado.balance_due = 0;
        aprobado.balance_paid = true;
        aprobado.deposit_usd = Number(form.total_usd);
        aprobado.balance_due_usd = 0;
        aprobado.balance_paid_at = new Date().toISOString().split('T')[0];
      }
      await updateBudget(id as string, aprobado as unknown as Record<string, unknown>);
      setForm((prev) => ({ ...prev, ...aprobado, status: 'APPROVED' } as unknown as EntityFormState));
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch {
      alert('Error al aprobar');
    } finally {
      setSaving(false);
    }
  };

  const handleEnviarWhatsApp = () => {
    const telefono = (form.client_phone || '').replace(/[^\d]/g, '');
    const nombre = form.client_name || '';
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
      const payload = buildPayloadWithTerms();
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

  const dd2 = Number(form.usd_rate) || 1;
  let sumatoriaAdicionalesARS = Number(form.transport || 0);
  const detalleTrabajosComunes: { concept: string; quantity: number; total: number }[] = [];
  if (Number(form.transport || 0) > 0) {
    detalleTrabajosComunes.push({ concept: 'Traslado', quantity: 1, total: Number(form.transport) });
  }
  (form.fabrication_details || []).forEach((item) => {
    const totalItem = Number(item.price || 0) * Number(item.quantity || 1);
    const totalItemARS = item.currency === 'USD' ? (dd2 > 0 ? totalItem * dd2 : 0) : totalItem;
    if (totalItemARS > 0) {
      sumatoriaAdicionalesARS += totalItemARS;
      detalleTrabajosComunes.push({ concept: (item.concept as string) + (item.detail ? ` - ${item.detail as string}` : ''), quantity: Number(item.quantity || 1), total: totalItemARS });
    }
  });
  (form.pools_data || []).forEach((pil) => {
    const pool = pil as unknown as PoolInForm & Record<string, unknown>;
    const totalPil = Number(pool.price || 0) * Number(pool.quantity || 1);
    const totalPilARS = pool.currency === 'USD' ? (dd2 > 0 ? totalPil * dd2 : 0) : totalPil;
    if (totalPilARS > 0) {
      sumatoriaAdicionalesARS += totalPilARS;
      detalleTrabajosComunes.push({ concept: `Pileta ${(pool.brand as string) || ''} ${(pool.model as string) || ''}`.trim(), quantity: Number(pool.quantity || 1), total: totalPilARS });
    }
  });
  const matsMain = hayAlternativas ? (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => !m.is_alternative) : (form.materials_data as unknown as MaterialInForm[] || []);
  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

  const alternativasTop = hayAlternativas ? (
    <div style={{ marginTop: 0 }}>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              DETALLE DE FABRICACIÓN Y ACCESORIOS COMUNES
            </h3>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0 0' }}>
              Estos trabajos se aplican y ya están sumados en cada una de las opciones de abajo.
            </p>
          </div>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', padding: '4px 12px', borderRadius: 6, textAlign: 'center' }}>
            <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Dólar Ref.</span>
            <input type="number" style={{ width: 100, fontSize: 12, fontWeight: 900, color: '#334155', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', textAlign: 'center', background: '#fff' }} value={form.usd_rate || ''} onChange={(e) => setForm({ ...form, usd_rate: Number(e.target.value) || 0 })} />
          </div>
        </div>
        {detalleTrabajosComunes.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '4px 16px', fontSize: 12, fontWeight: 500, color: '#475569' }}>
            {detalleTrabajosComunes.map((job, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                <span>✓ {job.concept} ({job.quantity > 1 ? `x${job.quantity}` : 'x1'})</span>
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
    <QuoteOptionsGrid
      alternativas={matsAlt.map((mat: MaterialInForm, altIdx: number) => {
        const ddLocal = Number(form.usd_rate) || 1;
        const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
        const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
        const costoMatArs = mat.currency === 'USD' ? (ddLocal > 0 ? costoMat * ddLocal : 0) : costoMat;
        const totalFinalARS = costoMatArs + sumatoriaAdicionalesARS;
        return { name: mat.name || '', category: mat.category || '', currency: mat.currency || 'ARS', costoMaterialBase: costoMat, totalFinalARS, length: Number(mat.length || 0), width: Number(mat.width || 0), quantity: mat.quantity || 1 };
      })}
      detalleTrabajosComunes={detalleTrabajosComunes}
      tipoCambio={Number(form.usd_rate) || 1}
      presupuestoId={id}
      onConvertirAlternativa={handleConvertirAlternativa}
      modoUSD={modoUSD}
    />
  ) : null;

  const descuentoBlock = form.payment_method === 'EFECTIVO' ? (
    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        🔒 Descuento Comercial (Solo Vendedor)
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>%</span>
          <input type="number" className="input" style={{ width: 70, textAlign: 'right' }}
            placeholder="0" min="0" max="100"
            value={form.discount_percentage || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              setForm({ ...form, discount_percentage: val, discount_fixed_amount: val > 0 ? 0 : form.discount_percentage });
            }}
            disabled={readOnly} />
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>o</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>$</span>
          <input type="number" className="input" style={{ width: 100, textAlign: 'right' }}
            placeholder="Monto fijo"
            value={form.discount_fixed_amount || ''}
            onChange={(e) => {
              const val = Number(e.target.value) || 0;
              setForm({ ...form, discount_fixed_amount: val, discount_percentage: val > 0 ? 0 : form.discount_percentage });
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
    const nuevo = !form.balance_paid;
    const hoy = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = {
      balance_paid: nuevo,
      balance_paid_at: nuevo ? hoy : null,
    };
    if (nuevo) {
      payload.deposit_received = Number(form.total);
      payload.deposit_currency = 'ARS';
      payload.balance_due = 0;
      payload.deposit_usd = Number(form.total_usd);
      payload.balance_due_usd = 0;
    }
    await updateBudget(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload, balance_paid_at: nuevo ? hoy : '' } as EntityFormState));
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
  };

  return (
    <div className={s['budget-form']}>
      <FormHeader
        className="presupuesto-header"
        title={`Presupuesto N° ${form.number || 'P-_____'}`}
        badge={!['PENDING'].includes(form.status) ? <StatusBadge status={form.status} /> : undefined}
        logoUrl={logoUrl}
      >
        <button className="btn btn-outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        {isEdit ? (
          workOrderNumber ? (
            <button type="button" className={s['budget-form__btn-ot']} onClick={() => navigate(`/admin/work-orders?search=${workOrderNumber}`)}>
              <FileOutput size={16} /> OT {workOrderNumber}
            </button>
          ) : form.status === 'APPROVED' ? (
            <button type="button" className={s['budget-form__btn-convert']} onClick={handleConvertirGuardar}
              disabled={saving}>
              <FileOutput size={16} /> {saving ? 'CONVIRTIENDO...' : 'CONVERTIR A ORDEN'}
            </button>
          ) : ['PENDING', 'ONLINE'].includes(form.status) ? (
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
      </FormHeader>

      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <BudgetFormClient
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clientes={clientes as unknown as import('../../types/client').Client[]}
          onClientCreated={refreshClientes}
        />

        <div className={`${s['budget-form__layout']}${showCroquis ? '' : ' ' + s['budget-form__layout--no-sketch']}`}>
          {showCroquis && (
            <div className={s['budget-form__sketch']}>
              <CroquisEditor croquis={form.sketch_elements} onChange={(v: unknown) => update('sketch_elements', v)} readOnly={readOnly} />
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
            M2_CONCEPTS={M2_CONCEPTS}
            num={num}
            handleDetailChange={handleDetailChange}
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
            handleTransportChange={handleTransportChange}
            handleDepositCurrencyChange={handleDepositCurrencyChange}
            handleDepositAmountChange={handleDepositAmountChange}
            handleUsdRateChange={handleUsdRateChange}
            setForm={setForm}
            update={update as (field: string, value: unknown) => void}
            num={num as (v: unknown) => number}
            alternativasTop={alternativasTop}
            alternativasGrid={alternativasGrid}
            descuentoBlock={descuentoBlock}
            onConfirmarPago={handleConfirmarPago}
          />

        </div>

        <BudgetFormObservations
          form={form}
          readOnly={readOnly}
          update={update}
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
        />

        <div className={s['budget-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['budget-form__card-title']}>Términos del Presupuesto</h3>
          <TermsEditor
            items={budgetTerms}
            onChange={setBudgetTerms}
            placeholder="Ej: Se requiere seña del 50% para iniciar trabajo…"
            hint="Si dejás la lista vacía, se usarán los términos globales configurados en Configuración."
            disabled={readOnly}
          />
        </div>

        <div className={s['budget-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['budget-form__card-title']}>Garantía</h3>
          <TermsEditor
            items={warrantyTerms}
            onChange={setWarrantyTerms}
            placeholder="Ej: 12 meses por defectos de fabricación…"
            hint="Si dejás la lista vacía, se usará la garantía global configurada."
            disabled={readOnly}
          />
        </div>

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
