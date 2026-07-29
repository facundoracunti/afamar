import React, { useState, useEffect, useCallback } from 'react';
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
import { fetchUsdVenta } from '../../utils/dolarApi';
import QuoteOptionsGrid from '../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid';
import FormHeader from '../../components/orders/FormHeader/FormHeader';
import EntityFormLayout from '../../components/entity/EntityFormLayout';
import BudgetFormObservations from './BudgetFormObservations';
import type { EntityFormState, MaterialInForm, EntityServices } from '../../types';
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
    addMaterial, removeMaterial, updateMaterial,
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

  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    fetchUsdVenta()
      .then((venta) => { if (!cancelled) setForm((prev) => ({ ...prev, usd_rate: venta })); })
      .catch((err) => {
        console.warn('USD venta fetch failed (keeping default 1000):', err);
      });
    return () => { cancelled = true; };
  }, [isEdit, setForm]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    const ok = await rawHandleSubmit(e);
    if (ok) queryClient.invalidateQueries({ queryKey: ['budgets'] });
  }, [rawHandleSubmit, queryClient]);

  const handleAddressAdded = useCallback(createAddressAddedHandler(clientes, updateClientAddresses), [clientes, updateClientAddresses]);

  const buildOptionFromMaterial = useCallback((mat: MaterialInForm): import('../../components/budget/QuoteOptionsGrid/QuoteOptionsGrid').Alternativa => {
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
  }, [form.usd_rate, sumatoriaMaterialesPrincipalARS, sumatoriaAdicionalesARS]);

  if (loading) return <LoadingSpinner />;

  const alternativasGrid = hayAlternativas && materials ? (
    <QuoteOptionsGrid
      mainMaterials={matsMain.map(buildOptionFromMaterial)}
      alternativas={matsAlt.map(buildOptionFromMaterial)}
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

      <EntityFormLayout
        styles={s}
        prefix="budget-form__"

        form={form as unknown as EntityFormState}
        readOnly={readOnly}
        saving={saving}
        logoUrl={logoUrl}

        clientes={clientes as unknown as import('../../types/client').Client[]}
        addOrRefreshClientes={addOrRefreshClientes}
        onAddressAdded={handleAddressAdded}
        update={update as (field: string, value: unknown) => void}

        materials={materials}
        pools={pools}
        addMaterial={addMaterial}
        removeMaterial={removeMaterial}
        updateMaterial={updateMaterial}
        addPileta={addPileta}
        removePileta={removePileta}
        updatePileta={updatePileta}
        handleDetailChange={handleDetailChange}
        addDetalle={addDetalle}
        removeDetalle={removeDetalle}
        M2_CONCEPTS={M2_CONCEPTS}

        modoUSD={modoUSD}
        toggleModoUSD={toggleModoUSD}
        hayUSD={hayUSD}
        hayAlternativas={hayAlternativas}
        handleTransportChange={handleTransportChange}
        handleDepositCurrencyChange={handleDepositCurrencyChange}
        handleDepositAmountChange={handleDepositAmountChange}
        handleUsdRateChange={handleUsdRateChange}
        setForm={setForm}
        alternativasGrid={alternativasGrid}
        onConfirmarPago={handleConfirmarPago}

        observations={
          <BudgetFormObservations
            form={form}
            readOnly={readOnly}
            update={update}
          />
        }

        handleSubmit={handleSubmit}
        onCancel={handleCancelClick}

        showCroquis={showCroquis}
        setShowCroquis={setShowCroquis}

        pdfData={pdfData}
        pdfPreviewLoading={pdfPreviewLoading}
        sketchExtractorActive={sketchExtractorActive}
        handleClosePdfPreview={handleClosePdfPreview}
        handleSketchImagesReady={handleSketchImagesReady}
        pdfTitle="Vista previa — Presupuesto"
        pdfFileName={`presupuesto_${form.number || 'nuevo'}.pdf`}

        deleteConfirm={deleteConfirm}
        setDeleteConfirm={setDeleteConfirm}
        handleDelete={handleDelete}
        deleteTitle="Eliminar presupuesto"
        deleteMessage="¿Estás seguro de eliminar este PRESUPUESTO LOCAL?"
        deleteConfirmLabel="Eliminar"
        deleteDanger

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

    </div>
  );
}