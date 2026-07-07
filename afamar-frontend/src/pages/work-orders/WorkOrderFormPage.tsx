import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, getNextWorkOrderNumber, getWorkOrderPdf } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import BudgetPanel from '../../components/budget/BudgetPanel/BudgetPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import PdfPreviewModal from '../../components/ui/PdfPreviewModal/PdfPreviewModal';
import SketchImageExtractor from '../../components/ui/PdfPreviewModal/SketchImageExtractor';
import TermsEditor from '../../components/ui/TermsEditor/TermsEditor';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import FormFooter from '../../components/orders/FormFooter/FormFooter';
import WorkOrderFormClient from './WorkOrderFormClient';
import WorkOrderFormStatus from './WorkOrderFormStatus';
import WorkOrderFormSpecs from './WorkOrderFormSpecs';
import WorkOrderFormFinancial from './WorkOrderFormFinancial';
import FabricationSection from '../../components/budget/FabricationSection/FabricationSection';
import BudgetFormAdicionales from '../budgets/BudgetFormAdicionales';
import SketchSection from '../../components/sketch/SketchSection/SketchSection';
import WorkOrderFormObservations from './WorkOrderFormObservations';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import type { EntityFormState, EntityServices, MaterialInForm, PoolInForm } from '../../types';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

const workOrderServices = {
  getById: getWorkOrder as EntityServices['getById'],
  create: createWorkOrder as EntityServices['create'],
  update: updateWorkOrder as EntityServices['update'],
  delete: deleteWorkOrder as EntityServices['delete'],
  getNextNumero: getNextWorkOrderNumber as EntityServices['getNextNumero'],
  getMaterials: getMaterials as EntityServices['getMaterials'],
  getPools: getPoolStock as EntityServices['getPools'],
  getClients: getClients as EntityServices['getClients'],
  getPdfUrl: getWorkOrderPdf,
  listPath: '/admin/work-orders',
};

export default function WorkOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const num = (v: string): number | null => v === '' ? null : parseFloat(v);

  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([]);
  const { company, globalTerms } = useSettingsWithTerms();

  const {
    form, loading, saving, materials, pools, logoUrl, clientes, addOrRefreshClientes,
    menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas,
    modoUSD, toggleModoUSD,
    menuRef,
    setForm,
    setSaving,
    setMenuOpen, setDeleteConfirm, setShowCroquis,
    update,
    handleTransportChange,
    handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial,
    addPileta, removePileta, updatePileta,
    handleSubmit: legacyHandleSubmit, handleDelete, handleStatusChangeAction, handlePrint,
    buildPayload,
    M2_CONCEPTS,
  } = useEntityForm({
    entityType: 'work_order',
    services: workOrderServices,
    defaultEstado: 'MEASUREMENT',
    id,
    navigate,
    extraPayloadFields: () => ({
      delivery_terms_override: encodeTerms(deliveryTerms),
      warranty_override: encodeTerms(warrantyTerms),
    }),
    onError: (msg) => notify(msg, 'error'),
  });

  // Wrap the legacy submit so the work-orders list cache is invalidated
  // AND immediately refetched on every successful save. The bare
  // `invalidateQueries({ queryKey: ['work-orders'] })` only marks the
  // cache as stale — but the list query isn't mounted at submit time, so
  // the refetch only happens after the user navigates back, which left
  // the list showing the previous totals until they manually refreshed.
  // `refetchType: 'all'` forces the refetch right here (the list page
  // will pick up the fresh data when it mounts).
  const handleSubmit = async (e?: React.FormEvent) => {
    const ok = await legacyHandleSubmit(e);
    if (!ok) return; // error already notified via onError
    queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
  };

  const encodeTerms = (items: string[]) => JSON.stringify(items.filter((t) => t.trim() !== ''));

  if (loading) return <LoadingSpinner />;

  const matsMain = hayAlternativas ? (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => !m.is_alternative) : (form.materials_data as unknown as MaterialInForm[] || []);
  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

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
    await updateWorkOrder(id as string, payload);
    setForm((prev) => ({ ...prev, ...payload } as EntityFormState));
    queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
  };

  const handlePreviewPdf = () => {
    setPdfPreviewLoading(true);
    setPdfData(null);
    setSketchExtractorActive(true);
  };

  const handleSketchImagesReady = (images: string[]) => {
    const data = buildPdfData({
      form: form as unknown as Record<string, unknown>,
      document_type: 'work_order',
      overrides: {
        delivery_terms: deliveryTerms,
        warranty_terms: warrantyTerms,
      },
      company,
      globalTerms,
      sketchImages: images,
    });
    setPdfData(data);
    setPdfPreviewLoading(false);
    setSketchExtractorActive(false);
  };

  const handleClosePdfPreview = () => {
    setPdfData(null);
    setSketchExtractorActive(false);
  };

  const alternativasGrid = hayAlternativas ? (
    <div className={s['work-order-form__alt-grid']}>
      <div className={s['work-order-form__alt-header']}>
        <span className={s['work-order-form__alt-header-title']}>📋 PRESUPUESTO COMPARATIVO</span>
        <span className={s['work-order-form__alt-header-count']}>{matsAlt.length} opciones alternativas</span>
      </div>
      <div className={s['work-order-form__alt-cards']}>
        {matsAlt.map((mat: MaterialInForm, idx: number) => {
          const letra = String.fromCharCode(65 + idx);
          const dd2 = Number(form.usd_rate);
          const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
          const costoMat = mat.currency === 'USD' ? m2 * (mat.price_m2_usd || 0) : m2 * (mat.price_m2 || 0);
          const costoMatArs = mat.currency === 'USD' ? (dd2 > 0 ? costoMat * dd2 : 0) : costoMat;
          const fijosArsAlt = (form.fabrication_details || []).reduce((s: number, d) => s + (Number(d.price) || 0) * (d.quantity || 1), 0)
            + (form.pools_data as unknown as PoolInForm[] || []).reduce((s: number, pt) => s + (Number(pt.price) || 0) * (Number(pt.quantity) || 1), 0)
            + (Number(form.transport) || 0);
          const totalArs = costoMatArs + fijosArsAlt;
          const mostrarUSDAlt = modoUSD && dd2 > 0;
          return (
            <div key={idx} className={s['work-order-form__alt-card']}>
              <div>
                <div className={s['work-order-form__alt-card-head']}>
                  <span className={s['work-order-form__alt-card-badge']}>Alternativa {letra}</span>
                  <span className={s['work-order-form__alt-card-pza']}>{mat.quantity || 1} pza. ({m2.toFixed(3)} m²)</span>
                </div>
                <div className={s['work-order-form__alt-card-name']}>{mat.name}</div>
                {mat.currency === 'USD' && <div className={s['work-order-form__alt-card-usd']}>USD {costoMat.toFixed(2)}</div>}
                <div className={s['work-order-form__alt-card-body']}>
                  <div className={s['work-order-form__alt-card-row']}>
                    <span>Material:</span>
                    <span className={s['work-order-form__alt-card-value']}>{mostrarUSDAlt ? `USD ${(costoMatArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${costoMatArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                  <div className={s['work-order-form__alt-card-row']}>
                    <span>Trabajos + Piletas + Traslado:</span>
                    <span className={s['work-order-form__alt-card-value']}>{mostrarUSDAlt ? `USD ${(fijosArsAlt / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${fijosArsAlt.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              </div>
              <div className={s['work-order-form__alt-card-total']}>
                <div className={s['work-order-form__alt-card-total-lbl']}>Total alternativa {mostrarUSDAlt ? '(USD)' : ''}</div>
                <div className={s['work-order-form__alt-card-total-val']}>{mostrarUSDAlt ? `USD ${(totalArs / dd2).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${Math.round(totalArs).toLocaleString('es-AR')}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={s['work-order-form__alt-footer']}>
        * Todos los totales incluyen la misma configuración de trabajos, pools y traslados.
      </div>
    </div>
  ) : null;

  const discountBlock = (
    <>{form.payment_method === 'EFECTIVO' && (
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
    )}</>
  );

  return (
    <div className={s['work-order-form']}>
      <FormHeader
        className="orden-header"
        title={`Orden N° ${form.number || 'A-_____'}`}
        badge={<StatusBadge status={form.status} />}
        logoUrl={logoUrl}
      >
        {form.status === 'MEASUREMENT' && (
          <button className={s['work-order-form__btn-measurement']} onClick={() => handleStatusChangeAction('WORKSHOP')} disabled={saving}>
            🏭 Enviar a Taller
          </button>
        )}
        {form.status === 'WORKSHOP' && (
          <button className={s['work-order-form__btn-workshop']} onClick={() => handleStatusChangeAction('FINISHED')} disabled={saving}>
            ✅ Finalizar Trabajo
          </button>
        )}
        {form.status === 'FINISHED' && (
          <button className={s['work-order-form__btn-delivery']} onClick={() => handleStatusChangeAction('DELIVERED')} disabled={saving}>
            🚚 Entregar al Cliente
          </button>
        )}
        {form.status === 'DELIVERED' && (
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
      </FormHeader>

      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <WorkOrderFormClient
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clientes={clientes as unknown as import('../../types/client').Client[]}
          onClientCreated={addOrRefreshClientes}
        />

        <div className={s['work-order-form__card-section']}>
          <WorkOrderFormStatus
            form={form}
            readOnly={readOnly}
            update={update as (field: string, value: unknown) => void}
          />
        </div>

        <div className={s['work-order-form__card-section']}>
          <WorkOrderFormSnapshot form={form} readOnly={readOnly} />
        </div>

        <div className={`${s['work-order-form__layout']}${showCroquis ? '' : ' ' + s['work-order-form__layout--no-sketch']}`}>
          <div className={s['work-order-form__right']}>
            <WorkOrderFormSpecs
              form={form}
              readOnly={readOnly}
              materials={materials}
              addMaterial={addMaterial}
              updateMaterial={updateMaterial}
              removeMaterial={removeMaterial}
              update={update}
              num={num}
            />
          </div>
          <div className={s['work-order-form__right']}>
            <BudgetFormAdicionales
              form={form}
              readOnly={readOnly}
              pools={pools}
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
              updatePileta={updatePileta}
              removePileta={removePileta}
              addPileta={addPileta}
              num={num}
            />
          </div>
        </div>

        <div className={s['work-order-form__bottom']}>
          <FabricationSection
            detalles={(form.fabrication_details as unknown as import('../../types/budget').FabricationDetail[]) || []}
            readOnly={readOnly}
            formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
            M2_CONCEPTS={M2_CONCEPTS}
            num={num as (v: unknown) => number}
            handleDetailChange={handleDetailChange}
            addDetalle={addDetalle}
            removeDetalle={removeDetalle}
            showMeasurementComparison={form.status === 'MEASUREMENT'}
            materialsData={form.materials_data as unknown as import('../../types').MaterialInForm[]}
          />

          <SketchSection
            showCroquis={showCroquis}
            setShowCroquis={setShowCroquis}
            sketchElements={form.sketch_elements}
            onChange={(v) => update('sketch_elements', v)}
            readOnly={readOnly}
            toggleLabel="Diseño / Croquis"
          />

          <WorkOrderFormFinancial
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
            num={num}
            alternativasGrid={alternativasGrid}
            discountBlock={discountBlock}
            onConfirmarPago={handleConfirmarPago}
            handleConfirmarPago={handleConfirmarPago}
            mostrarToggleTitle={true}
            mostrarToggleColumns={false}
          />
        </div>

        <WorkOrderFormObservations
          form={form}
          readOnly={readOnly}
          update={update}
        />

        <div className={s['work-order-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['work-order-form__card-title']}>Condiciones de Entrega</h3>
          <TermsEditor
            items={deliveryTerms}
            onChange={setDeliveryTerms}
            placeholder="Ej: Entrega a convenir, transporte a cargo del cliente…"
            hint="Si dejás la lista vacía, se usarán las condiciones globales configuradas."
            disabled={readOnly}
          />
        </div>

        <div className={s['work-order-form__card']} style={{ marginTop: 16 }}>
          <h3 className={s['work-order-form__card-title']}>Garantía</h3>
          <TermsEditor
            items={warrantyTerms}
            onChange={setWarrantyTerms}
            placeholder="Ej: 12 meses por defectos de fabricación…"
            hint="Si dejás la lista vacía, se usará la garantía global configurada."
            disabled={readOnly}
          />
        </div>

        <FormFooter saving={saving} onCancel={() => navigate('/admin/work-orders')} />
      </form>

      <PdfPreviewModal
        isOpen={pdfData !== null || pdfPreviewLoading}
        onClose={handleClosePdfPreview}
        data={pdfData}
        loading={pdfPreviewLoading}
        title="Vista previa — Orden de Trabajo"
        fileName={`orden_${form.number || 'nueva'}.pdf`}
      />

      {sketchExtractorActive && (
        <SketchImageExtractor
          sketchElements={form.sketch_elements}
          onReady={handleSketchImagesReady}
        />
      )}
      <ConfirmDialog open={deleteConfirm} onCancel={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" confirmLabel="Eliminar" danger />
    </div>
  );
}