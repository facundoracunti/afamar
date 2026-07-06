import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save, FileOutput, Check, Send } from 'lucide-react';
import { getBudget, createBudget, updateBudget, deleteBudget, getNextBudgetNumber, getBudgetPdf, previewBudgetPdf, convertBudgetToWorkOrder, convertAlternativeToWorkOrder } from '@/api/resources/budgets';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency, fabricationConcepts } from '../../utils/formatters';
import { t as translateConcept } from '../../utils/translate';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import PdfPreviewModal from '../../components/ui/PdfPreviewModal/PdfPreviewModal';
import TermsEditor from '../../components/ui/TermsEditor/TermsEditor';
import { useNotify } from '../../context/NotificationContext';
import { fetchUsdVenta } from '../../utils/dolarApi';
import QuoteOptionsGrid from '../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid';

import ObservationsSection from '../../components/orders/ObservationsSection/ObservationsSection';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import FormFooter from '../../components/orders/FormFooter/FormFooter';
import BudgetFormClient from './BudgetFormClient';
import SketchSection from '../../components/sketch/SketchSection/SketchSection';
import BudgetFormSpecs from './BudgetFormSpecs';
import BudgetFormFinancial from './BudgetFormFinancial';
import BudgetFormAdicionales from './BudgetFormAdicionales';
import FabricationSection from '../../components/budget/FabricationSection/FabricationSection';
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
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [pendingAltIdx, setPendingAltIdx] = useState<number | null>(null);
  const notify = useNotify();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const encodeTerms = (items: string[]) => JSON.stringify(items.map((t) => t).filter((t) => t.trim() !== ''));

  const {
    form, loading, saving, materiales, piletas, logoUrl, clientes, addOrRefreshClientes,
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
    onError: (msg) => notify(msg, 'error'),
  });

  // Auto-fill USD rate from dolarapi.com on new budget creation. When editing,
  // we use the value stored in the DB. If the API is down we keep the
  // INITIAL_FORM default (1000) so the form still works.
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    fetchUsdVenta()
      .then((venta) => { if (!cancelled) setForm((prev) => ({ ...prev, usd_rate: venta })); })
      .catch(() => { /* keep default 1000 if API is down */ });
    return () => { cancelled = true; };
  }, [isEdit, setForm]);

  // Wrap the legacy submit so the budgets list cache is invalidated on
  // every successful save (the default 5min staleTime would otherwise
  // keep the previous list visible after navigation).
  const handleSubmit = async (e?: React.FormEvent) => {
    const wasRejected = form.status === 'REJECTED';
    const ok = await legacyHandleSubmit(e);
    if (!ok) return; // error already notified via onError
    queryClient.invalidateQueries({ queryKey: ['budgets'] });
    if (wasRejected) {
      notify('Presupuesto guardado. Estado restablecido a Pendiente — podes volver a aprobarlo.', 'success');
    } else {
      notify('Presupuesto guardado correctamente', 'success');
    }
  };

  const buildPayloadWithTerms = (): Record<string, unknown> => ({
    ...buildPayload(),
    budget_terms_override: encodeTerms(budgetTerms),
    warranty_override: encodeTerms(warrantyTerms),
  });

  const handleConvertirGuardar = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      const res = await convertBudgetToWorkOrder(id as string);
      setWorkOrderNumber(res.data.number);
      setForm((prev) => ({ ...prev, status: 'CONVERTED_TO_OT' }));
      notify(`¡Orden ${res.data.number} creada exitosamente!`, 'success');
      // Both lists change: budget becomes CONVERTED_TO_OT, OT is created.
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      navigate(`/admin/work-orders/${res.data.id}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al convertir';
      notify(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertirAlternativa = async (idx: number) => {
    if (!id) {
      notify('Primero guardá el presupuesto para poder convertir una alternativa.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await convertAlternativeToWorkOrder(id as string, idx);
      if (res.status === 201) {
        notify(`¡Orden ${res.data.number} creada exitosamente desde alternativa "${res.data.alternative_name}"!`, 'success');
        queryClient.invalidateQueries({ queryKey: ['budgets'] });
        queryClient.invalidateQueries({ queryKey: ['work-orders'] });
        navigate(`/admin/work-orders/${res.data.id}`);
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al convertir la alternativa';
      notify(detail, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const payload = buildPayload();
      await updateBudget(id as string, payload);
      notify('Presupuesto guardado correctamente', 'success');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al guardar';
      notify(detail, 'error');
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
      // Only reflect the user-facing changes back into the form. Spreading
      // the whole `aprobado` payload would overwrite `materials_data` (a JSON
      // string in the payload) over the in-memory array, breaking
      // `useFormMaterials` on the next render.
      setForm((prev) => ({
        ...prev,
        status: 'APPROVED',
        deposit_received: aprobado.deposit_received ?? prev.deposit_received,
        deposit_usd: aprobado.deposit_usd ?? prev.deposit_usd,
        balance_due: aprobado.balance_due ?? prev.balance_due,
        balance_due_usd: aprobado.balance_due_usd ?? prev.balance_due_usd,
        balance_paid: aprobado.balance_paid ?? prev.balance_paid,
        balance_paid_at: aprobado.balance_paid_at ?? prev.balance_paid_at,
      }));
      notify('Presupuesto aprobado', 'success');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        || (err as Error).message
        || 'Error al aprobar';
      notify(detail, 'error');
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

  if (loading) return <LoadingSpinner />;

  const dd2 = Number(form.usd_rate) || 1;
  let sumatoriaAdicionalesARS = Number(form.transport || 0);
  const detalleTrabajosComunes: { concept: string; quantity: number; total: number; currency: 'ARS' | 'USD' }[] = [];
  if (Number(form.transport || 0) > 0) {
    detalleTrabajosComunes.push({ concept: 'Traslado', quantity: 1, total: Number(form.transport), currency: 'ARS' });
  }
  (form.fabrication_details || []).forEach((item) => {
    const totalItem = Number(item.price || 0) * Number(item.quantity || 1);
    const itemCurrency = (item.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const totalItemARS = itemCurrency === 'USD' ? (dd2 > 0 ? totalItem * dd2 : 0) : totalItem;
    if (totalItem > 0) {
      sumatoriaAdicionalesARS += totalItemARS;
      const baseLabel = item.concept === 'OTHER' && item.detail ? translateConcept('OTHER') + ' - ' + (item.detail as string) : translateConcept(item.concept as string);
      detalleTrabajosComunes.push({ concept: baseLabel, quantity: Number(item.quantity || 1), total: totalItem, currency: itemCurrency });
    }
  });
  (form.pools_data || []).forEach((pil) => {
    const pool = pil as unknown as PoolInForm & Record<string, unknown>;
    const totalPil = Number(pool.price || 0) * Number(pool.quantity || 1);
    const poolCurrency = (pool.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
    const totalPilARS = poolCurrency === 'USD' ? (dd2 > 0 ? totalPil * dd2 : 0) : totalPil;
    if (totalPil > 0) {
      sumatoriaAdicionalesARS += totalPilARS;
      detalleTrabajosComunes.push({ concept: `Pileta ${(pool.brand as string) || ''} ${(pool.model as string) || ''}`.trim(), quantity: Number(pool.quantity || 1), total: totalPil, currency: poolCurrency });
    }
  });
  // Principal (non-alternative) materials — broken out separately so they
  // render right after "Costo Material base" in the comparison cards.
  const principalesBreakdown: { concept: string; quantity: number; total: number; currency: 'ARS' | 'USD' }[] = [];
  if (hayAlternativas) {
    ((form.materials_data as unknown as MaterialInForm[]) || [])
      .filter((m) => !m.is_alternative)
      .forEach((m) => {
        const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
        const costoMat = m.currency === 'USD' ? m2 * (m.price_m2_usd || 0) : m2 * (m.price_m2 || 0);
        const mCurrency = (m.currency === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD';
        if (costoMat > 0) {
          principalesBreakdown.push({
            concept: `Material Principal — ${m.name || ''}${m.color ? ' (' + m.color + ')' : ''}`,
            quantity: m.quantity || 1,
            total: costoMat,
            currency: mCurrency,
          });
        }
      });
  }
  const matsMain = hayAlternativas ? (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => !m.is_alternative) : (form.materials_data as unknown as MaterialInForm[] || []);
  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

  const alternativasTop = hayAlternativas ? (
    <div style={{ marginTop: 0 }}>
      <div className={s['budget-form__detail-card']}>
        <div className={s['budget-form__detail-header']}>
          <div>
            <h3 className={s['budget-form__detail-title']}>
              DETALLE DE FABRICACIÓN Y ACCESORIOS COMUNES
            </h3>
            <p className={s['budget-form__detail-subtitle']}>
              Estos trabajos se aplican y ya están sumados en cada una de las opciones de abajo.
            </p>
          </div>
          <div className={s['budget-form__detail-rateBox']}>
            <span className={s['budget-form__detail-rateLabel']}>Dólar Ref.</span>
            <input
              type="number"
              className={`input ${s['budget-form__detail-rateInput']}`}
              value={form.usd_rate || ''}
              onChange={(e) => setForm({ ...form, usd_rate: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        {detalleTrabajosComunes.length > 0 ? (
          <div className={s['budget-form__detail-grid']}>
            {detalleTrabajosComunes.map((job, idx) => (
              <div key={idx} className={s['budget-form__detail-row']}>
                <span>✓ {job.concept} ({job.quantity > 1 ? `x${job.quantity}` : 'x1'})</span>
                <span className={s['budget-form__detail-rowValue']}>
                  $ {job.total.toLocaleString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={s['budget-form__detail-empty']}>
            No hay trabajos adicionales comunes configurados.
          </p>
        )}
      </div>
    </div>
  ) : null;

  // Every card's TOTAL should include all principals (non-alternatives) +
// this card's own material + common works (transport, fabrication, pools).
// Alternatives are additive, not replacements.
const sumatoriaMaterialesPrincipalARS = matsMain.reduce((sum, m) => {
  const ddLocal = Number(form.usd_rate) || 1;
  const m2 = Number(m.length || 0) * Number(m.width || 0) * (m.quantity || 1);
  const costoMat = m.currency === 'USD' ? m2 * (m.price_m2_usd || 0) : m2 * (m.price_m2 || 0);
  const costoMatArs = m.currency === 'USD' ? (ddLocal > 0 ? costoMat * ddLocal : 0) : costoMat;
  return sum + costoMatArs;
}, 0);

const buildOptionFromMaterial = (mat: MaterialInForm): import('../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid').Alternativa => {
    const ddLocal = Number(form.usd_rate) || 1;
    const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
    const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
    const costoMatArs = mat.currency === 'USD' ? (ddLocal > 0 ? costoMat * ddLocal : 0) : costoMat;
    const totalFinalARS = sumatoriaMaterialesPrincipalARS + costoMatArs + sumatoriaAdicionalesARS;
    return {
      name: mat.name || '',
      category: mat.category || '',
      currency: mat.currency || 'ARS',
      costoMaterialBase: costoMat,
      totalFinalARS,
      length: Number(mat.length || 0),
      width: Number(mat.width || 0),
      quantity: mat.quantity || 1,
    };
  };

  const alternativasGrid = hayAlternativas && materiales ? (
    <QuoteOptionsGrid
      mainMaterials={matsMain.map(buildOptionFromMaterial)}
      alternativas={matsAlt.map(buildOptionFromMaterial)}
      principalesBreakdown={principalesBreakdown}
      detalleTrabajosComunes={detalleTrabajosComunes}
      tipoCambio={Number(form.usd_rate) || 1}
      presupuestoId={id}
      onConvertirAlternativa={setPendingAltIdx}
      modoUSD={modoUSD}
    />
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
            <button type="button" className={s['budget-form__btn-convert']} onClick={() => setShowConvertDialog(true)}
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
          onClientCreated={addOrRefreshClientes}
        />

        <div className={`${s['budget-form__layout']}${showCroquis ? '' : ' ' + s['budget-form__layout--no-sketch']}`}>
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
          <div className={s['budget-form__right']}>
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
          </div>
        </div>

        <div className={s['budget-form__bottom']}>
          <FabricationSection
            detalles={form.fabrication_details as unknown as Record<string, unknown>[]}
            readOnly={readOnly}
            materiales={materiales}
            M2_CONCEPTS={M2_CONCEPTS}
            num={num as (v: unknown) => number}
            handleDetailChange={handleDetailChange}
            addDetalle={addDetalle}
            removeDetalle={removeDetalle}
          />

          <SketchSection
            showCroquis={showCroquis}
            setShowCroquis={setShowCroquis}
            sketchElements={form.sketch_elements}
            onChange={(v) => update('sketch_elements', v)}
            readOnly={readOnly}
            toggleLabel="Diseño / Croquis"
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
            onConfirmarPago={handleConfirmarPago}
          />

        </div>

        <BudgetFormObservations
          form={form}
          readOnly={readOnly}
          update={update}
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

      <ConfirmDialog open={deleteConfirm} onCancel={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar presupuesto" message="¿Estás seguro de eliminar este PRESUPUESTO LOCAL?" confirmLabel="Eliminar" danger />

      <ConfirmDialog
        open={showConvertDialog}
        onCancel={() => setShowConvertDialog(false)}
        onConfirm={() => {
          setShowConvertDialog(false);
          void handleConvertirGuardar();
        }}
        title="Convertir a Orden de Trabajo"
        message="Se guardará y copiará toda la información: croquis, material, detalles de fabricación, pileta, firma, precios y condiciones comerciales."
        confirmLabel="Convertir"
      />

      <ConfirmDialog
        open={pendingAltIdx !== null}
        onCancel={() => setPendingAltIdx(null)}
        onConfirm={() => {
          if (pendingAltIdx !== null) {
            const idx = pendingAltIdx;
            setPendingAltIdx(null);
            void handleConvertirAlternativa(idx);
          }
        }}
        title="Convertir alternativa"
        message="Se creará una nueva Orden de Trabajo con el material de esta opción más los trabajos comunes."
        confirmLabel="Convertir"
      />

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
