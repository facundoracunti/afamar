import React, { Suspense, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, getNextWorkOrderNumber, getWorkOrderPdf } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { formatCurrency, formatCurrencyValue, todayLocalISO, parseNumber } from '../../utils/formatters';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { useConfirmPayment } from '../../hooks/useConfirmPayment';
import { createAddressAddedHandler } from '../../hooks/entityFormHelpers';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
const PdfPreviewModal = React.lazy(() => import('../../components/ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = React.lazy(() => import('../../components/ui/PdfPreviewModal/SketchImageExtractor'));
import TermsEditor from '../../components/ui/TermsEditor/TermsEditor';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import FormFooter from '../../components/orders/FormFooter/FormFooter';
import EntityFormClient from '../../components/entity/EntityFormClient';
import WorkOrderFormStatus from './WorkOrderFormStatus';
import EntityFormSpecs from '../../components/entity/EntityFormSpecs';
import EntityFormFinancial from '../../components/entity/EntityFormFinancial';
import FabricationSection from '../../components/budget/FabricationSection/FabricationSection';
import BudgetFormAdicionales from '../budgets/BudgetFormAdicionales';
import AdditionalWorkSection from '../../components/budget/AdditionalWorkSection/AdditionalWorkSection';
import SketchSection from '../../components/sketch/SketchSection/SketchSection';
import WorkOrderFormObservations from './WorkOrderFormObservations';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import { AlternativeBudgetGrid } from './AlternativeBudgetGrid';
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
  const [pdfData, setPdfData] = useState<PdfDocumentData | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [sketchExtractorActive, setSketchExtractorActive] = useState(false);
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([]);
  const { company, globalTerms } = useSettingsWithTerms();

  const {
    form, loading, saving, materials, pools, logoUrl, clientes, addOrRefreshClientes, updateClientAddresses,
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
    defaultStatus: 'MEASUREMENT',
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
    if (!ok) return;
    queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
  };

  const handleAddressAdded = useCallback(createAddressAddedHandler(clientes, updateClientAddresses), [clientes, updateClientAddresses]);

  const encodeTerms = (items: string[]) => JSON.stringify(items.filter((t) => t.trim() !== ''));

  const handleConfirmarPago = useConfirmPayment({
    id,
    balance_paid: form.balance_paid,
    total: form.total,
    total_usd: form.total_usd,
    updateFn: updateWorkOrder,
    queryKey: ['work-orders'],
    setForm,
  });

  if (loading) return <LoadingSpinner />;

  const matsMain = hayAlternativas ? (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => !m.is_alternative) : (form.materials_data as unknown as MaterialInForm[] || []);
  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

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
    <AlternativeBudgetGrid
      form={form}
      matsAlt={matsAlt}
      modoUSD={modoUSD}
    />
  ) : null;

  const discountBlock = (
    <>{form.payment_method === 'EFECTIVO' && (
      <div className={s['work-order-form__discount']}>
        <label className={s['work-order-form__discount-label']}>
          🔒 Descuento Comercial (Solo Vendedor)
        </label>
        <div className={s['work-order-form__discount-row']}>
          <div className={s['work-order-form__discount-group']}>
            <span className={s['work-order-form__discount-prefix']}>%</span>
            <input type="number" className={`input ${s['work-order-form__discount-input']}`}
              placeholder="0" min="0" max="100"
              value={form.discount_percentage || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setForm({ ...form, discount_percentage: val, discount_fixed_amount: val > 0 ? 0 : form.discount_percentage });
              }}
              disabled={readOnly} />
          </div>
          <span className={s['work-order-form__discount-or']}>o</span>
          <div className={s['work-order-form__discount-group']}>
            <span className={s['work-order-form__discount-prefix']}>$</span>
            <input type="number" className={`input ${s['work-order-form__discount-input--fixed']}`}
              placeholder="Monto fijo"
              value={form.discount_fixed_amount || ''}
              onChange={(e) => {
                const val = Number(e.target.value) || 0;
                setForm({ ...form, discount_fixed_amount: val, discount_percentage: val > 0 ? 0 : form.discount_percentage });
              }}
              disabled={readOnly} />
          </div>
        </div>
        <div className={s['work-order-form__discount-hint']}>
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
        <button className={`btn btn-outline ${s['work-order-form__preview-btn']}`} onClick={handlePreviewPdf} disabled={pdfPreviewLoading}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        <button className={`btn btn-primary ${s['work-order-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      </FormHeader>

      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <EntityFormClient
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clientes={clientes as unknown as import('../../types/client').Client[]}
          onClientCreated={addOrRefreshClientes}
          onAddressAdded={handleAddressAdded}
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
            <EntityFormSpecs
              form={form}
              readOnly={readOnly}
              materials={materials}
              addMaterial={addMaterial}
              updateMaterial={updateMaterial}
              removeMaterial={removeMaterial}
              update={update}
              num={parseNumber}
              cardClassName={`card ${s['specs-card']}`}
            />
            <BudgetFormAdicionales
              form={form}
              readOnly={readOnly}
              pools={pools}
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
              updatePileta={updatePileta}
              removePileta={removePileta}
              addPileta={addPileta}
              num={parseNumber}
            />
          </div>
          <div className={s['work-order-form__right']}>
            <FabricationSection
              detalles={(form.fabrication_details as unknown as import('../../types/budget').FabricationDetail[]) || []}
              readOnly={readOnly}
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
              M2_CONCEPTS={M2_CONCEPTS}
              num={parseNumber as (v: unknown) => number}
              handleDetailChange={handleDetailChange}
              addDetalle={addDetalle}
              removeDetalle={removeDetalle}
              showMeasurementComparison={form.status === 'MEASUREMENT'}
              materialsData={form.materials_data as unknown as import('../../types').MaterialInForm[]}
            />
            <AdditionalWorkSection
              value={form.additional_works_data}
              onChange={(json) => setForm({ ...form, additional_works_data: json })}
              readOnly={readOnly}
              formMaterials={(form.materials_data as unknown as import('../../types/budget').MaterialInForm[]) || []}
            />
          </div>
        </div>

        <div className={s['work-order-form__bottom']}>
          <SketchSection
            showCroquis={showCroquis}
            setShowCroquis={setShowCroquis}
            sketchElements={form.sketch_elements}
            onChange={(v) => update('sketch_elements', v)}
            readOnly={readOnly}
            toggleLabel="Diseño / Plano"
          />

          <EntityFormFinancial
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
            num={parseNumber}
            alternativasGrid={alternativasGrid}
            discountBlock={discountBlock}
            onConfirmarPago={handleConfirmarPago}
          />
        </div>

        <WorkOrderFormObservations
          form={form}
          readOnly={readOnly}
          update={update}
        />

        <div className={`${s['work-order-form__card']} ${s['work-order-form__terms-card']}`}>
          <h3 className={s['work-order-form__card-title']}>Condiciones de Entrega</h3>
          <TermsEditor
            items={deliveryTerms}
            onChange={setDeliveryTerms}
            placeholder="Ej: Entrega a convenir, transporte a cargo del cliente…"
            hint="Si dejás la lista vacía, se usarán las condiciones globales configuradas."
            disabled={readOnly}
          />
        </div>

        <div className={`${s['work-order-form__card']} ${s['work-order-form__terms-card']}`}>
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

      <Suspense fallback={<LoadingSpinner />}>
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title="Vista previa — Orden de Trabajo"
          fileName={`orden_${form.number || 'nueva'}.pdf`}
        />
      </Suspense>

      {sketchExtractorActive && (
        <Suspense fallback={null}>
          <SketchImageExtractor
            sketchElements={form.sketch_elements}
            onReady={handleSketchImagesReady}
          />
        </Suspense>
      )}
      <ConfirmDialog open={deleteConfirm} onCancel={() => setDeleteConfirm(false)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro de eliminar esta orden de trabajo?" confirmLabel="Eliminar" danger />
    </div>
  );
}