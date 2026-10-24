import React, { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getBudget, createBudget, updateBudget, deleteBudget, getNextBudgetNumber, getBudgetPdf } from '@/api/resources/budgets';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import { useBudgetQuoteCalculations } from '../../hooks/useBudgetQuoteCalculations';
import { useBudgetActions } from '../../hooks/useBudgetActions';
import { createAddressAddedHandler } from '../../hooks/entityFormHelpers';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { useNotify } from '../../context/NotificationContext';
import { useUsdRate } from '../../hooks/useUsdRate';
import QuoteOptionsGrid from '../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import EntityFormLayout from '../../components/entity/EntityFormLayout';
import ObservationsSection from '../../components/orders/ObservationsSection/ObservationsSection';
import BudgetOptionsTabs from '../../features/budgets/options/BudgetOptionsTabs';
import { pickWinningOptionId } from '../../features/budgets/options/budgetOptions';
import type { EntityServices } from '../../types';
import styles from './BudgetFormPage.module.css';
import BudgetFormPageHeaderActions from './BudgetFormPage.HeaderActions';
import BudgetFormPageConvertAction from './BudgetFormPage.ConvertAction';
import BudgetFormPageConvertDialogs from './BudgetFormPage.ConvertDialogs';
import BudgetFormPageProviders from './BudgetFormPage.Providers';
import { useBudgetQuoteOptions } from './BudgetFormPage.useQuoteOptions';

const s = styles as unknown as Record<string, string>;

const budgetServices: EntityServices = {
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

interface BudgetFormProps {
  /** Called after a successful save or delete. Page mode falls back to
   *  navigating to /admin/budgets; modal mode closes the modal. */
  onSuccess?: () => void;
  /** Called when the user cancels. Page mode falls back to navigating
   *  to /admin/budgets; modal mode closes the modal. */
  onCancel?: () => void;
  layoutMode?: 'full' | 'wizard';
}

export default function BudgetForm(props: BudgetFormProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const [workOrderNumber, setWorkOrderNumber] = useState<string | null>(null);

  const handleCancelClick = () => (props.onCancel ? props.onCancel() : navigate('/admin/budgets'));

  const entity = useEntityForm({
    services: budgetServices,
    defaultStatus: 'PENDING',
    id,
    navigate,
    onLoaded: (data: Record<string, unknown>) => {
      setWorkOrderNumber((data.work_order_number as string) || null);
    },
    onError: (msg) => notify(msg, 'error'),
    onAfterAction: props.onSuccess,
  });
  const {
    form, loading, saving, materials, logoUrl, clientes, updateClientAddresses,
    readOnly, hayAlternativas, isEdit,
    modoUSD,
    setForm, setSaving,
    update, buildPayload,
    paymentMethods,
    piecesFlow,
  } = entity;

  const {
    sumatoriaAdicionalesARS, detalleTrabajosComunes, principalesBreakdown,
    matsMain, matsAlt, sumatoriaMaterialesPrincipalARS,
  } = useBudgetQuoteCalculations({ form, hayAlternativas });

  const {
    pdfData, pdfPreviewLoading, sketchExtractorActive,
    showConvertDialog, setShowConvertDialog,
    pendingAltIdx, setPendingAltIdx,
    handleSubmit: rawHandleSubmit,
    handleAprobar,
    handleConvertirGuardar,
    handleConvertirAlternativa,
    handleEnviarWhatsApp,
    handlePreviewPdf,
    handleSketchImagesReady,
    handleClosePdfPreview,
  } = useBudgetActions({
    form, setForm, setSaving, saving, buildPayload, isEdit, id,
    paymentMethods,
  });

  // Multi-option guard (2026-10-01 Fase 3): `pickWinningOptionId` returns
  // null when the choice is ambiguous (2+ options with none or several
  // marked as the winner). The convert button is DISABLED and explains
  // why, so the operator never fires a request the backend would reject —
  // and never converts the wrong scenario by accident.
  const winningOptionId = pickWinningOptionId(form.options ?? []);
  const conversionAmbiguous = winningOptionId === null;
  const winningOptionName =
    !conversionAmbiguous && winningOptionId
      ? (form.options ?? []).find((o) => o.id === winningOptionId)?.name ?? null
      : null;

  const { refresh: refreshUsdRate } = useUsdRate({ form, setForm, isEdit, source: 'official' });

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    const ok = await rawHandleSubmit(e);
    if (ok) queryClient.invalidateQueries({ queryKey: ['budgets'] });
  }, [rawHandleSubmit, queryClient]);

  const handleAddressAdded = useCallback(createAddressAddedHandler(clientes, updateClientAddresses), [clientes, updateClientAddresses]);

  const { buildOption, buildAltOption } = useBudgetQuoteOptions({
    form,
    sumatoriaMaterialesPrincipalARS,
    sumatoriaAdicionalesARS,
  });

  const handleConfirmConvert = () => {
    setShowConvertDialog(false);
    void handleConvertirGuardar().catch(() => { /* already notifies errors */ });
  };

  const handleConfirmPendingAlt = () => {
    if (pendingAltIdx !== null) {
      const idx = pendingAltIdx;
      setPendingAltIdx(null);
      void handleConvertirAlternativa(idx).catch(() => { /* already notifies errors */ });
    }
  };

  if (loading) return <LoadingSpinner />;

  const alternativasGrid = hayAlternativas && materials ? (
    <QuoteOptionsGrid
      mainMaterials={matsMain.map(buildOption)}
      alternativas={matsAlt.map(buildAltOption)}
      principalesBreakdown={principalesBreakdown}
      detalleTrabajosComunes={detalleTrabajosComunes}
      tipoCambio={Number(form.usd_rate) || 1}
      budgetId={id}
      onConvertirAlternativa={setPendingAltIdx}
      modoUSD={modoUSD}
    />
  ) : null;

  // Acción primaria "CONVERTIR A ORDEN" — se renderiza debajo de
  // Traslado dentro del Presupuesto card, no en el header.
  const convertAction = isEdit && !workOrderNumber && form.status === 'APPROVED' ? (
    <BudgetFormPageConvertAction
      conversionAmbiguous={conversionAmbiguous}
      winningOptionName={winningOptionName}
      saving={saving}
      onOpenConvertDialog={() => setShowConvertDialog(true)}
    />
  ) : null;

  return (
    <div className={s['budget-form']}>
      <FormHeader
        className="presupuesto-header"
        title={`Presupuesto N° ${form.number || 'P-_____'}`}
        badge={!['PENDING'].includes(form.status) ? <StatusBadge status={form.status} /> : undefined}
        logoUrl={logoUrl}
      >
        <BudgetFormPageHeaderActions
          status={form.status}
          isEdit={isEdit}
          workOrderNumber={workOrderNumber}
          saving={saving}
          pdfPreviewLoading={pdfPreviewLoading}
          onPreviewPdf={handlePreviewPdf}
          onOpenWorkOrder={() => navigate(`/admin/work-orders?search=${workOrderNumber}`)}
          onAprobar={handleAprobar}
          onSubmit={handleSubmit}
          onEnviarWhatsApp={handleEnviarWhatsApp}
          showSaveButton={props.layoutMode !== 'wizard'}
        />
      </FormHeader>

      <BudgetFormPageProviders
        entity={entity}
        handleSubmit={handleSubmit}
        onCancel={handleCancelClick}
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
        {/* Option tabs — only render when the budget really has 2+
            options (the component self-hides otherwise, so legacy
            and single-option budgets keep their current UI). */}
        <BudgetOptionsTabs />
        <EntityFormLayout
          mode={props.layoutMode || 'full'}
          showPieces
          piecesFlow={piecesFlow}
          alternativasGrid={alternativasGrid}
          actionBlock={convertAction}
          observations={
            <ObservationsSection
              form={form}
              readOnly={readOnly}
              update={update as (field: string, value: unknown) => void}
              className={s['budget-form__card']}
              titleClassName={s['budget-form__card-title']}
            />
          }
          extraDialogs={
            <BudgetFormPageConvertDialogs
              showConvertDialog={showConvertDialog}
              onCloseConvertDialog={() => setShowConvertDialog(false)}
              onConfirmConvert={handleConfirmConvert}
              winningOptionName={winningOptionName}
              pendingAltIdx={pendingAltIdx}
              onClosePendingAlt={() => setPendingAltIdx(null)}
              onConfirmPendingAlt={handleConfirmPendingAlt}
            />
          }
        />
      </BudgetFormPageProviders>

    </div>
  );
}
