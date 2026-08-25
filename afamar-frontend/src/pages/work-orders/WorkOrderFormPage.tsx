import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save } from 'lucide-react';
import { useNotify } from '../../context/NotificationContext';
import { useUsdRate } from '../../hooks/useUsdRate';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, getNextWorkOrderNumber, getWorkOrderPdf } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { useConfirmPayment } from '../../hooks/useConfirmPayment';
import { createAddressAddedHandler } from '../../hooks/entityFormHelpers';
import { buildPdfData } from '../../utils/pdf/buildPdfData';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import EntityFormLayout from '../../components/entity/EntityFormLayout';
import {
  EntityFormActionsProvider,
  EntityFormDomainProvider,
  EntityFormStateProvider,
  EntityFormStyleProvider,
} from '../../components/entity/EntityFormContexts';
import WorkOrderFormStatus from './WorkOrderFormStatus';
import WorkOrderFormSnapshot from './WorkOrderFormSnapshot';
import WorkOrderFormObservations from './WorkOrderFormObservations';
import { AlternativeBudgetGrid } from './AlternativeBudgetGrid';
import type { EntityFormState, EntityServices, MaterialInForm } from '../../types';
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

interface WorkOrderFormProps {
  /** Called after a successful save or delete. Page mode falls back to
   *  navigating to /admin/work-orders; modal mode closes the modal. */
  onSuccess?: () => void;
  /** Called when the user cancels. Page mode falls back to navigating
   *  to /admin/work-orders; modal mode closes the modal. */
  onCancel?: () => void;
  layoutMode?: 'full' | 'wizard';
}

export default function WorkOrderForm(props: WorkOrderFormProps = {}) {
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

  const handleCancelClick = () =>
    props.onCancel ? props.onCancel() : navigate('/admin/work-orders');
  const handleSuccessCallback = () => {
    queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
    props.onSuccess?.();
  };

  const {
    form, loading, saving, materials, pools, logoUrl, clientes, addOrRefreshClientes, updateClientAddresses,
    menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, isEdit,
    modoUSD, toggleModoUSD,
    menuRef,
    setForm,
    setSaving,
    setMenuOpen, setDeleteConfirm, setShowCroquis,
    update,
    handleTransportChange,
    handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial, addMaterialRow, removeMaterialGroup, updateMaterialGroup,
    swapMaterialGroup,
    addPileta, removePileta, updatePileta,
    handleSubmit: legacyHandleSubmit, handleDelete, handleStatusChangeAction, handlePrint,
    buildPayload,
    paymentMethods,
    M2_CONCEPTS,
  } = useEntityForm({
    services: workOrderServices,
    defaultStatus: 'MEASUREMENT',
    id,
    navigate,
    extraPayloadFields: () => ({
      delivery_terms_override: encodeTerms(deliveryTerms),
      warranty_override: encodeTerms(warrantyTerms),
    }),
    onError: (msg) => notify(msg, 'error'),
    onAfterAction: handleSuccessCallback,
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
    await legacyHandleSubmit(e);
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

  const { refresh: refreshUsdRate } = useUsdRate({ form, setForm, isEdit });

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
      // Pasar el catálogo para que el PDF pueda aplicar la regla del
      // método (SURCHARGE / DISCOUNT) y emitir la tabla 3-columnas
      // de cuotas cuando hay tarjeta de crédito.
      paymentMethods,
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
          <button type="button" className={s['work-order-form__btn-measurement']} onClick={() => handleStatusChangeAction('WORKSHOP')} disabled={saving}>
            🏭 Enviar a Taller
          </button>
        )}
        {form.status === 'WORKSHOP' && (
          <button type="button" className={s['work-order-form__btn-workshop']} onClick={() => handleStatusChangeAction('FINISHED')} disabled={saving}>
            ✅ Finalizar Trabajo
          </button>
        )}
        {form.status === 'FINISHED' && (
          <button type="button" className={s['work-order-form__btn-delivery']} onClick={() => handleStatusChangeAction('DELIVERED')} disabled={saving}>
            🚚 Entregar al Cliente
          </button>
        )}
        {form.status === 'DELIVERED' && (
          <span className={s['work-order-form__badge-delivered']}>
            📦 Trabajo Entregado
          </span>
        )}
        <button type="button" className={`btn btn-outline ${s['work-order-form__preview-btn']}`} onClick={handlePreviewPdf} disabled={pdfPreviewLoading}>
          <Eye size={16} /> {pdfPreviewLoading ? 'GENERANDO...' : 'VISTA PREVIA PDF'}
        </button>
        {props.layoutMode !== 'wizard' && (
          <button className={`btn btn-primary ${s['work-order-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
        )}
      </FormHeader>

      <EntityFormStyleProvider value={{ styles: s, prefix: 'work-order-form__' }}>
        <EntityFormStateProvider
          value={{
            form,
            setForm,
            update,
            readOnly,
            saving,
            logoUrl,
            M2_CONCEPTS,
          }}
        >
          <EntityFormDomainProvider
            value={{
              clientes,
              materials,
              pools,
              paymentMethods,
              addOrRefreshClientes,
              onAddressAdded: handleAddressAdded,
              addMaterial,
              removeMaterial,
              updateMaterial,
              addMaterialRow,
              removeMaterialGroup,
              updateMaterialGroup,
              swapMaterialGroup,
              addPileta,
              removePileta,
              updatePileta,
              handleDetailChange,
              addDetalle,
              removeDetalle,
              modoUSD,
              toggleModoUSD,
              hayUSD,
              hayAlternativas,
              handleTransportChange,
              handleDepositCurrencyChange,
              handleDepositAmountChange,
              handleUsdRateChange,
              onUsdRateRefresh: refreshUsdRate,
              formMaterials: form.materials_data || [],
            }}
          >
            <EntityFormActionsProvider
              value={{
                handleSubmit,
                onCancel: handleCancelClick,
                onConfirmarPago: handleConfirmarPago,
                deleteConfirm,
                setDeleteConfirm,
                handleDelete,
                deleteTitle: 'Eliminar orden',
                deleteMessage: '¿Estás seguro de eliminar esta orden de trabajo?',
                deleteConfirmLabel: 'Eliminar',
                deleteDanger: true,
                pdfData,
                pdfPreviewLoading,
                handleClosePdfPreview,
                pdfTitle: 'Vista previa — Orden de Trabajo',
                pdfFileName: `orden_${form.number || 'nueva'}.pdf`,
                sketchExtractorActive,
                handleSketchImagesReady,
                showCroquis,
                setShowCroquis,
              }}
            >
              <EntityFormLayout
                mode={props.layoutMode || 'full'}
                alternativasGrid={alternativasGrid}
                discountBlock={discountBlock}
                beforeLayout={
                  <>
                    <div className={s['work-order-form__card-section']}>
                      <WorkOrderFormStatus
                        form={form}
                        readOnly={readOnly}
                        update={update}
                      />
                    </div>
                    <div className={s['work-order-form__card-section']}>
                      <WorkOrderFormSnapshot form={form} readOnly={readOnly} />
                    </div>
                  </>
                }
                observations={
                  <WorkOrderFormObservations
                    form={form}
                    readOnly={readOnly}
                    update={update}
                  />
                }
                terms={[
                  {
                    title: 'Condiciones de Entrega',
                    items: deliveryTerms,
                    onChange: setDeliveryTerms,
                    placeholder: 'Ej: Entrega a convenir, transporte a cargo del cliente…',
                    hint: 'Si dejás la lista vacía, se usarán las condiciones globales configuradas.',
                    disabled: readOnly,
                  },
                  {
                    title: 'Garantía',
                    items: warrantyTerms,
                    onChange: setWarrantyTerms,
                    placeholder: 'Ej: 12 meses por defectos de fabricación…',
                    hint: 'Si dejás la lista vacía, se usará la garantía global configurada.',
                    disabled: readOnly,
                  },
                ]}
                specsCardClassName={`card ${s['specs-card']}`}
                fabricationShowMeasurementComparison={form.status === 'MEASUREMENT'}
                fabricationMaterialsData={form.materials_data}
              />
            </EntityFormActionsProvider>
          </EntityFormDomainProvider>
        </EntityFormStateProvider>
      </EntityFormStyleProvider>

    </div>
  );
}