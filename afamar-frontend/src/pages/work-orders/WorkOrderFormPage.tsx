import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNotify } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { useUsdRate } from '../../hooks/useUsdRate';
import { getWorkOrder, createWorkOrder, updateWorkOrder, deleteWorkOrder, cancelWorkOrderWithRecovery, getNextWorkOrderNumber, getWorkOrderPdf, getMeasurementAdjustment, approveMeasurementAdjustment } from '@/api/resources/workOrders';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import type { AfterActionInfo } from '../../hooks/useFormActions';
import { useSettingsWithTerms } from '../../hooks/useSettingsWithTerms';
import { useWorkshopPdfController } from '../../hooks/useWorkshopPdfController';
import { useConfirmPayment } from '../../hooks/useConfirmPayment';
import { createAddressAddedHandler } from '../../hooks/entityFormHelpers';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import EntityFormLayout from '../../components/entity/EntityFormLayout';
import { AlternativeBudgetGrid } from './AlternativeBudgetGrid';
import ObservationsSection from '../../components/orders/ObservationsSection/ObservationsSection';
import type { EntityFormState, EntityServices, MaterialInForm } from '../../types';
import styles from './WorkOrderFormPage.module.css';
import WorkOrderFormPageHeaderActions from './WorkOrderFormPage.HeaderActions';
import WorkOrderFormPageBeforeLayout from './WorkOrderFormPage.BeforeLayout';
import WorkOrderFormPagePaymentSection from './WorkOrderFormPage.PaymentSection';
import WorkOrderFormPageProviders from './WorkOrderFormPage.Providers';
import { useWorkOrderPdfPreview } from './WorkOrderFormPage.usePdfPreview';
import { useWorkOrderWhatsAppShare } from './WorkOrderFormPage.useWhatsAppShare';
import { buildWorkOrderTerms } from './WorkOrderFormPage.terms';
import MeasurementAdjustmentDialog, { type MeasurementAdjustmentProposal } from './MeasurementAdjustmentDialog';
import WorkOrderCancellationModal from './WorkOrderCancellationModal';
import { parseApiError } from '../../utils/error';

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
  const { user } = useAuth();
  const [deliveryTerms, setDeliveryTerms] = useState<string[]>([]);
  const [warrantyTerms, setWarrantyTerms] = useState<string[]>([]);
  const [showComparisonToggle, setShowComparisonToggle] = useState(false);
  // Pagos registrados en la sesión vía el módulo de pagos (ARS). Se integra
  // al preview del PDF: fila "Seña / Pagos Registrados" = este acumulado
  // (el pago real; la seña del form solo funge de fallback legacy).
  const [pagoAcumuladoModulo, setPagoAcumuladoModulo] = useState(0);
  const [measurementAdjustment, setMeasurementAdjustment] = useState<MeasurementAdjustmentProposal | null>(null);
  const [measurementAdjustmentOpen, setMeasurementAdjustmentOpen] = useState(false);
  const [measurementAdjustmentLoading, setMeasurementAdjustmentLoading] = useState(false);
  const [measurementAdjustmentSaving, setMeasurementAdjustmentSaving] = useState(false);
  const [cancellationOpen, setCancellationOpen] = useState(false);
  const [cancellationSaving, setCancellationSaving] = useState(false);
  const [hasRegisteredPayments, setHasRegisteredPayments] = useState(false);
  const { company, globalTerms } = useSettingsWithTerms();

  // Ficha de Taller: documento interno SIN precios para los trabajadores del
  // taller. Los 6 specs (CORTE/FAJA/PERF/TRAS-PEG/TERM/SOPAPAS) se imprimen
  // SIEMPRE en blanco bajo el croquis — el cortador los completa a mano con
  // lapicera sobre el papel, no por esta web.
  const ficha = useWorkshopPdfController({
    fetchEntity: async (id) => getWorkOrder(id as number) as unknown as { data: Record<string, unknown> },
    defaultStatus: 'MEASUREMENT',
    company,
    notify,
  });

  const handleCancelClick = () =>
    props.onCancel ? props.onCancel() : navigate('/admin/work-orders');

  const handleStatusRequest = (status: string) => {
    if (status === 'CANCELLED' && id && (entity.form.pool_requirements?.length ?? 0) > 0) {
      setCancellationOpen(true);
      return;
    }
    handleStatusChangeAction(status);
  };

  const handlePoolCancellation = async (
    recoveries: Array<{ requirement_id: number; recovered_quantity: number }>,
    paymentsConfirmed: boolean,
  ) => {
    if (!id || cancellationSaving) return;
    setCancellationSaving(true);
    try {
      await cancelWorkOrderWithRecovery(id, recoveries, paymentsConfirmed);
      await queryClient.invalidateQueries({ queryKey: ['pool-stock'] });
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      notify('Orden cancelada y recuperación de piletas registrada', 'success');
      setCancellationOpen(false);
      handleSuccessCallback({ deleted: true });
    } catch (error) {
      notify(parseApiError(error, 'No se pudo cancelar la orden'), 'error');
    } finally {
      setCancellationSaving(false);
    }
  };
  // Create → jump to the just-created record's edit page so the operator can
  // keep tweaking without re-opening it (and the form stops being "create
  // mode" re-submittable, preventing duplicates). Update → stay put.
  // Delete in page mode → back to the list.
  const handleSuccessCallback = (info?: AfterActionInfo) => {
    // El backend ahora persiste `discount_enabled`, `discount_target`,
    // `discount_percentage`, `discount_fixed_amount` (migración Alembic
    // g9h0i1j2k3l4) y los devuelve en el GET /work-orders/{id}. El
    // refetch que se dispara a continuación pinta la UI con el valor
    // canónico del servidor — no hace falta espejo client-side.
    queryClient.invalidateQueries({ queryKey: ['work-orders'], refetchType: 'all' });
    if (props.onSuccess) props.onSuccess();
    else if (info?.created && info.id != null) navigate(`/admin/work-orders/${info.id}`);
    else if (info?.deleted) navigate('/admin/work-orders');
  };

  const entity = useEntityForm({
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
  const {
    form, loading, saving, logoUrl, clientes, updateClientAddresses,
    readOnly, hayAlternativas, isEdit,
    modoUSD,
    setForm,
    update,
    handleSubmit: legacyHandleSubmit, handleStatusChangeAction,
    paymentMethods,
    piecesFlow,
  } = entity;

  // Wrap the legacy submit so the work-orders list cache is invalidated
  // AND immediately refetched on every successful save. The bare
  // `invalidateQueries({ queryKey: ['work-orders'] })` only marks the
  // cache as stale — but the list query isn't mounted at submit time, so
  // the refetch only happens after the user navigates back, which left
  // the list showing the previous totals until they manually refreshed.
  // `refetchType: 'all'` forces the refetch right here (the list page
  // will pick up the fresh data when it mounts).
  //
  // El descuento comercial viaja en el payload a través de
  // `buildFinancialPayload` (entityFormFinancial.ts:28-34) y el
  // backend lo persiste en `work_orders.discount_*` (migración Alembic
  // g9h0i1j2k3l4). NO guardamos nada en `localStorage` — la API es
  // la única fuente de verdad.
  const handleSubmit = async (e?: React.FormEvent) => {
    await legacyHandleSubmit(e);
  };

  const handlePrintFicha = () => {
    if (!id) return; // Solo órdenes guardadas tienen ficha imprimible.
    // Pasar el form EN VIVO (no re-fetchear del API): si el operador
    // asignó cada pileta a su mesada en "Asignar a opción" y todavía no
    // guardó, la ficha debe reflejar esa asignación igual que el PDF del
    // cliente refleja el resto de los cambios sin guardar.
    ficha.handleOpenWorkshopSheet(
      { id, number: form.number, status: form.status },
      { liveForm: form as unknown as Record<string, unknown> }
    );
  };

  const handleOpenMeasurementAdjustment = async () => {
    if (!id) return;
    setMeasurementAdjustmentLoading(true);
    try {
      const response = await getMeasurementAdjustment(id);
      setMeasurementAdjustment(response.data as MeasurementAdjustmentProposal);
      setMeasurementAdjustmentOpen(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudieron calcular las diferencias.', 'error');
    } finally {
      setMeasurementAdjustmentLoading(false);
    }
  };

  const handleApproveMeasurementAdjustment = async () => {
    if (!id || !measurementAdjustment) return;
    setMeasurementAdjustmentSaving(true);
    try {
      const response = await approveMeasurementAdjustment(id, {
        measurement_fingerprint: measurementAdjustment.measurement_fingerprint,
        previous_total: measurementAdjustment.original_total,
        previous_total_usd: measurementAdjustment.original_total_usd,
      });
      const approved = response.data as { order?: EntityFormState };
      const updated = approved.order;
      if (updated) {
        setForm((previous) => ({
          ...previous,
          // The approval response is authoritative. Do not recompute these
          // values in the browser after the server-side commercial recalc.
          subtotal: updated.subtotal,
          subtotal_usd: updated.subtotal_usd,
          total: updated.total,
          total_usd: updated.total_usd,
          balance_due: updated.balance_due,
          balance_due_usd: updated.balance_due_usd,
          balance_paid: updated.balance_paid,
          measurement_approvals: updated.measurement_approvals,
        }));
      }
      setMeasurementAdjustmentOpen(false);
      setMeasurementAdjustment(null);
      queryClient.invalidateQueries({ queryKey: ['work-orders', id] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      notify('Diferencias de medición confirmadas.', 'success');
    } catch (error) {
      setMeasurementAdjustmentOpen(false);
      notify(error instanceof Error ? error.message : 'No se pudo confirmar la diferencia.', 'error');
    } finally {
      setMeasurementAdjustmentSaving(false);
    }
  };

  const { whatsappSending, handleEnviarWhatsApp } = useWorkOrderWhatsAppShare({
    form,
    id,
    notify,
  });

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

  const { refresh: refreshUsdRate } = useUsdRate({ form, setForm, isEdit, source: 'blue_mid' });

  const {
    pdfData, pdfPreviewLoading, sketchExtractorActive,
    handlePreviewPdf, handleSketchImagesReady, handleClosePdfPreview,
  } = useWorkOrderPdfPreview({
    form,
    company,
    globalTerms,
    deliveryTerms,
    warrantyTerms,
    paymentMethods,
    pagoAcumuladoModulo,
  });

  if (loading) return <LoadingSpinner />;

  const matsAlt = (form.materials_data as unknown as MaterialInForm[] || []).filter((m) => m.is_alternative);

  const alternativasGrid = hayAlternativas ? (
    <AlternativeBudgetGrid
      form={form}
      matsAlt={matsAlt}
      modoUSD={modoUSD}
    />
  ) : null;

  return (
    <div className={s['work-order-form']}>
      <FormHeader
        className="orden-header"
        title={`Orden N° ${form.number || 'A-_____'}`}
        badge={<StatusBadge status={form.status} />}
        logoUrl={logoUrl}
      >
        <WorkOrderFormPageHeaderActions
          form={form}
          saving={saving}
          hasId={Boolean(id)}
          pdfPreviewLoading={pdfPreviewLoading}
          whatsappSending={whatsappSending}
           onStatusChange={handleStatusRequest}
          onPrintFicha={handlePrintFicha}
          onEnviarWhatsApp={handleEnviarWhatsApp}
           onPreviewPdf={handlePreviewPdf}
           onConfirmMeasurementAdjustment={handleOpenMeasurementAdjustment}
           measurementAdjustmentLoading={measurementAdjustmentLoading}
          onSubmit={handleSubmit}
          showSaveButton={props.layoutMode !== 'wizard'}
        />
      </FormHeader>

      <WorkOrderFormPageProviders
        entity={entity}
        handleSubmit={handleSubmit}
        onCancel={handleCancelClick}
        onConfirmarPago={handleConfirmarPago}
        handleAddressAdded={handleAddressAdded}
        onUsdRateRefresh={refreshUsdRate}
        pdfPreview={{
          pdfData,
          pdfPreviewLoading,
          sketchExtractorActive,
          handleClosePdfPreview,
          handleSketchImagesReady,
        }}
      >
        <EntityFormLayout
          mode={props.layoutMode || 'full'}
          showPieces
          piecesFlow={piecesFlow}
          paymentSection={
            <WorkOrderFormPagePaymentSection
              orderId={id ? Number(id) : null}
              form={form}
               update={update}
               onPaidChange={setPagoAcumuladoModulo}
               onPaymentsPresenceChange={setHasRegisteredPayments}
               isAdmin={user?.is_admin === true}
             />
          }
          alternativasGrid={alternativasGrid}
          beforeLayout={
            <WorkOrderFormPageBeforeLayout
              form={form}
              readOnly={readOnly}
              update={update}
              setForm={setForm}
               showComparisonToggle={showComparisonToggle}
               setShowComparisonToggle={setShowComparisonToggle}
               onCancelRequest={() => handleStatusRequest('CANCELLED')}
            />
          }
          observations={
            <ObservationsSection
              form={form}
              readOnly={readOnly}
              update={update as (field: string, value: unknown) => void}
              className={s['work-order-form__card']}
              titleClassName={s['work-order-form__card-title']}
            />
          }
          terms={buildWorkOrderTerms({
            deliveryTerms,
            warrantyTerms,
            setDeliveryTerms,
            setWarrantyTerms,
            readOnly,
          })}
          specsCardClassName={`card ${s['specs-card']}`}
          fabricationShowMeasurementComparison={form.status === 'MEASUREMENT'}
          fabricationMaterialsData={form.materials_data}
        />
       </WorkOrderFormPageProviders>

        <MeasurementAdjustmentDialog
         proposal={measurementAdjustment}
         open={measurementAdjustmentOpen}
         saving={measurementAdjustmentSaving}
         onCancel={() => setMeasurementAdjustmentOpen(false)}
         onConfirm={handleApproveMeasurementAdjustment}
        />

        <WorkOrderCancellationModal
          open={cancellationOpen}
          orderNumber={form.number}
          requirements={form.pool_requirements || []}
          hasRegisteredPayments={hasRegisteredPayments}
          loading={cancellationSaving}
          onClose={() => setCancellationOpen(false)}
          onConfirm={handlePoolCancellation}
        />

      {ficha.UI}

    </div>
  );
}
