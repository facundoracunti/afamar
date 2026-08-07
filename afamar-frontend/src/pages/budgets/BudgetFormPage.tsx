import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, Save, FileOutput, Check, Send } from 'lucide-react';
import { getBudget, createBudget, updateBudget, deleteBudget, getNextBudgetNumber, getBudgetPdf } from '@/api/resources/budgets';
import { getMaterials } from '@/api/resources/materials';
import { getPoolStock } from '@/api/resources/poolStock';
import { getClients } from '@/api/resources/clients';
import { StatusBadge } from '../../components/ui/StatusBadge';
import useEntityForm from '../../hooks/useEntityForm';
import { useBudgetQuoteCalculations } from '../../hooks/useBudgetQuoteCalculations';
import { useBudgetActions } from '../../hooks/useBudgetActions';
import { useConfirmPayment } from '../../hooks/useConfirmPayment';
import { createAddressAddedHandler } from '../../hooks/entityFormHelpers';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { useNotify } from '../../context/NotificationContext';
import { useUsdRate } from '../../hooks/useUsdRate';
import QuoteOptionsGrid from '../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import EntityFormLayout from '../../components/entity/EntityFormLayout';
import {
  EntityFormActionsProvider,
  EntityFormDomainProvider,
  EntityFormStateProvider,
  EntityFormStyleProvider,
} from '../../components/entity/EntityFormContexts';
import BudgetFormObservations from './BudgetFormObservations';
import type { EntityFormState, MaterialInForm, EntityServices } from '../../types';
import { buildOptionFromMaterial, type AlternativaLike } from '../../utils/budgetOptions';
import styles from './BudgetFormPage.module.css';

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

  const {
    form, loading, saving, materials, pools, logoUrl, clientes, addOrRefreshClientes, updateClientAddresses,
    menuOpen, deleteConfirm, showCroquis,
    readOnly, hayUSD, hayAlternativas, isEdit,
    modoUSD, toggleModoUSD,
    setForm, setSaving,
    setDeleteConfirm, setShowCroquis,
    update, buildPayload,
    handleTransportChange,
    handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
    handleDetailChange, addDetalle, removeDetalle,
    addMaterial, removeMaterial, updateMaterial, addMaterialRow, removeMaterialGroup, updateMaterialGroup,
    swapMaterialGroup,
    addPileta, removePileta, updatePileta,
    handleDelete,
    M2_CONCEPTS,
  } = useEntityForm({
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
    sumatoriaAdicionalesARS, detalleTrabajosComunes, principalesBreakdown,
    matsMain, matsAlt, sumatoriaMaterialesPrincipalARS,
  } = useBudgetQuoteCalculations({ form, hayAlternativas });

  const {
    pdfData, pdfPreviewLoading, sketchExtractorActive,
    showConvertDialog, setShowConvertDialog,
    pendingAltIdx, setPendingAltIdx,
    handleSubmit: rawHandleSubmit,
    handleGuardar,
    handleAprobar,
    handleConvertirGuardar,
    handleConvertirAlternativa,
    handleEnviarWhatsApp,
    handlePreviewPdf,
    handleSketchImagesReady,
    handleClosePdfPreview,
  } = useBudgetActions({
    form, setForm, setSaving, saving, buildPayload, isEdit, id,
  });

  const handleConfirmarPago = useConfirmPayment({
    id,
    balance_paid: form.balance_paid,
    total: form.total,
    total_usd: form.total_usd,
    updateFn: updateBudget,
    queryKey: ['budgets'],
    setForm,
  });

  const { refresh: refreshUsdRate } = useUsdRate({ form, setForm, isEdit });

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    const ok = await rawHandleSubmit(e);
    if (ok) queryClient.invalidateQueries({ queryKey: ['budgets'] });
  }, [rawHandleSubmit, queryClient]);

  const handleAddressAdded = useCallback(createAddressAddedHandler(clientes, updateClientAddresses), [clientes, updateClientAddresses]);

  // Build each material into a `QuoteOptionsGrid` row. Pure helper from
  // `utils/budgetOptions.ts` — same code path used to live inline.
  const buildOption = useCallback(
    (mat: MaterialInForm): AlternativaLike =>
      buildOptionFromMaterial(mat, {
        usdRate: form.usd_rate,
        sumatoriaMaterialesPrincipalARS,
        sumatoriaAdicionalesARS,
      }),
    [form.usd_rate, sumatoriaMaterialesPrincipalARS, sumatoriaAdicionalesARS],
  );

  if (loading) return <LoadingSpinner />;

  const alternativasGrid = hayAlternativas && materials ? (
    <QuoteOptionsGrid
      mainMaterials={matsMain.map(buildOption)}
      alternativas={matsAlt.map(buildOption)}
      principalesBreakdown={principalesBreakdown}
      detalleTrabajosComunes={detalleTrabajosComunes}
      tipoCambio={Number(form.usd_rate) || 1}
      budgetId={id}
      onConvertirAlternativa={setPendingAltIdx}
      modoUSD={modoUSD}
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
        <button type="button" className="btn btn-outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          ) : props.layoutMode !== 'wizard' ? (
          <button className={`btn btn-primary ${s['budget-form__btn-save']}`} onClick={handleSubmit} disabled={saving}>
            <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
          </button>
        ) : null}
        <button type="button" className="btn btn-success" onClick={handleEnviarWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13 }}>
          <Send size={16} /> WhatsApp
        </button>
      </FormHeader>

      <EntityFormStyleProvider value={{ styles: s, prefix: 'budget-form__' }}>
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
                deleteTitle: 'Eliminar presupuesto',
                deleteMessage: '¿Estás seguro de eliminar este PRESUPUESTO LOCAL?',
                deleteConfirmLabel: 'Eliminar',
                deleteDanger: true,
                pdfData,
                pdfPreviewLoading,
                handleClosePdfPreview,
                pdfTitle: 'Vista previa — Presupuesto',
                pdfFileName: `presupuesto_${form.number || 'nuevo'}.pdf`,
                sketchExtractorActive,
                handleSketchImagesReady,
                showCroquis,
                setShowCroquis,
              }}
            >
              <EntityFormLayout
                mode={props.layoutMode || 'full'}
                alternativasGrid={alternativasGrid}
                observations={
                  <BudgetFormObservations
                    form={form}
                    readOnly={readOnly}
                    update={update}
                  />
                }
                extraDialogs={
                  <>
                    <ConfirmDialog
                      open={showConvertDialog}
                      onCancel={() => setShowConvertDialog(false)}
                      onConfirm={() => {
                        setShowConvertDialog(false);
                        void handleConvertirGuardar().catch(() => { /* already notifies errors */ });
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
                          void handleConvertirAlternativa(idx).catch(() => { /* already notifies errors */ });
                        }
                      }}
                      title="Convertir alternativa"
                      message="Se creará una nueva Orden de Trabajo con el material de esta opción más los trabajos comunes."
                      confirmLabel="Convertir"
                    />
                  </>
                }
              />
            </EntityFormActionsProvider>
          </EntityFormDomainProvider>
        </EntityFormStateProvider>
      </EntityFormStyleProvider>

    </div>
  );
}