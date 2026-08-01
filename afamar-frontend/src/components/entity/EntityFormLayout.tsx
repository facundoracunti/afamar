import React, { Suspense, useState, type ReactNode } from 'react';
import type { FabricationDetail, MaterialInForm } from '../../types';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import EntityFormClient from './EntityFormClient';
import EntityFormSpecs from './EntityFormSpecs';
import EntityFormFinancial from './EntityFormFinancial';
import BudgetFormAdicionales from '../../pages/budgets/BudgetFormAdicionales';
import FabricationSection from '../budget/FabricationSection/FabricationSection';
import AdditionalWorkSection from '../budget/AdditionalWorkSection/AdditionalWorkSection';
import SketchSection from '../sketch/SketchSection/SketchSection';
import TermsEditor from '../ui/TermsEditor/TermsEditor';
import FormFooter from '../orders/FormFooter/FormFooter';
import EntityFormWizard, { type EntityFormWizardStep } from './EntityFormWizard';
import { ConfirmDialog } from '../ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../ui/LoadingSpinner/LoadingSpinner';
import { parseNumber } from '../../utils/formatters';
import {
  useEntityFormActions,
  useEntityFormDomain,
  useEntityFormState,
  useEntityFormStyle,
} from './EntityFormContexts';

const PdfPreviewModal = React.lazy(() => import('../ui/PdfPreviewModal/PdfPreviewModal'));
const SketchImageExtractor = React.lazy(() => import('../ui/PdfPreviewModal/SketchImageExtractor'));

interface TermConfig {
  title: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  hint?: string;
  disabled: boolean;
}

/**
 * Public API. Most state/handlers are consumed from the 4 contexts set up
 * by the consuming page. The slots below are page-specific extras:
 *
 *   - `beforeLayout`, `observations`, `extraDialogs` — render slots
 *   - `terms` — per-page list of term editor cards (Budget = none,
 *     WorkOrder = delivery + warranty)
 *   - `alternativasGrid`, `discountBlock` — only set by the Budget page
 *   - `specsCardClassName`, `fabricationShowMeasurementComparison`,
 *     `fabricationMaterialsData` — small layout/materialisation overrides
 *
 * The BudgetFormPage and WorkOrderFormPage wrap this component in the
 * 4 `EntityFormXxxProvider`s from `EntityFormContexts.tsx`.
 */
export interface EntityFormLayoutProps {
  beforeLayout?: ReactNode;
  observations?: ReactNode;
  terms?: TermConfig[];
  alternativasGrid?: ReactNode;
  discountBlock?: ReactNode;
  extraDialogs?: ReactNode;
  specsCardClassName?: string;
  fabricationShowMeasurementComparison?: boolean;
  fabricationMaterialsData?: MaterialInForm[];
  mode?: 'full' | 'wizard';
}

// Helper: ts-friendly accessor — the lazy providers below accept the
// domain value object directly, but the public prop type re-exports the
// formMaterials derived field so callers can wire it without recomputing.
function useEntityFormLayoutInternals() {
  const { styles, prefix } = useEntityFormStyle();
  const state = useEntityFormState();
  const domain = useEntityFormDomain();
  const actions = useEntityFormActions();
  return { styles, prefix, state, domain, actions };
}

export default function EntityFormLayout(props: EntityFormLayoutProps) {
  const { styles: s, prefix, state, domain, actions } = useEntityFormLayoutInternals();
  const {
    form, setForm, update, readOnly, saving, M2_CONCEPTS,
  } = state;
  const {
    materials: materiales, addMaterial, removeMaterial, updateMaterial,
    pools, addPileta, removePileta, updatePileta,
    clientes, addOrRefreshClientes, onAddressAdded,
    handleDetailChange, addDetalle, removeDetalle,
    modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
    handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange,
    handleUsdRateChange, onUsdRateRefresh,
    formMaterials,
  } = domain;
  const {
    handleSubmit, onCancel, onConfirmarPago,
    showCroquis, setShowCroquis,
    pdfData, pdfPreviewLoading, handleClosePdfPreview, pdfTitle, pdfFileName,
    sketchExtractorActive, handleSketchImagesReady,
    deleteConfirm, setDeleteConfirm, handleDelete,
    deleteTitle, deleteMessage, deleteConfirmLabel, deleteDanger,
  } = actions;

  const {
    beforeLayout, observations, terms = [],
    alternativasGrid, discountBlock, extraDialogs,
    specsCardClassName, fabricationShowMeasurementComparison, fabricationMaterialsData,
    mode = 'full',
  } = props;
  const [wizardStep, setWizardStep] = useState(0);

  const layoutClass = showCroquis ? `${prefix}layout` : `${prefix}layout ${prefix}layout--no-sketch`;
  const layoutClassName = layoutClass
    .split(' ')
    .map((className) => s[className])
    .filter(Boolean)
    .join(' ');
  const wizardTerms = terms.map((t) => (
    <div key={t.title} className={s[`${prefix}card`]}>
      <h3 className={s[`${prefix}card-title`]}>{t.title}</h3>
      <TermsEditor
        items={t.items}
        onChange={t.onChange}
        placeholder={t.placeholder || ''}
        hint={t.hint}
        disabled={t.disabled}
      />
    </div>
  ));

  const wizardSteps: EntityFormWizardStep[] = [
    {
      id: 'client',
      label: 'Cliente y entrega',
      description: 'Datos del cliente y domicilio de obra.',
      content: (
        <>
          <EntityFormClient
            form={form}
            readOnly={readOnly}
            update={update}
            clientes={clientes}
            onClientCreated={addOrRefreshClientes}
            onAddressAdded={onAddressAdded}
          />
          {beforeLayout}
        </>
      ),
    },
    {
      id: 'materials',
      label: 'Materiales',
      description: 'Materiales principales y alternativas.',
      content: (
        <EntityFormSpecs
          form={form}
          readOnly={readOnly}
          materials={materiales}
          addMaterial={addMaterial}
          updateMaterial={updateMaterial}
          removeMaterial={removeMaterial}
          update={update}
          num={parseNumber}
          cardClassName={specsCardClassName}
        />
      ),
    },
    {
      id: 'pools',
      label: 'Piletas',
      description: 'Piletas y asignación a materiales.',
      content: (
        <BudgetFormAdicionales
          form={form}
          readOnly={readOnly}
          pools={pools}
          formMaterials={formMaterials}
          updatePileta={updatePileta}
          removePileta={removePileta}
          addPileta={addPileta}
          num={parseNumber}
        />
      ),
    },
    {
      id: 'fabrication',
      label: 'Fabricación',
      description: 'Zócalos, frentes y medidas adicionales.',
      content: (
        <FabricationSection
          detalles={(form.fabrication_details as FabricationDetail[]) || []}
          readOnly={readOnly}
          formMaterials={formMaterials}
          M2_CONCEPTS={M2_CONCEPTS}
          num={parseNumber as (v: unknown) => number}
          handleDetailChange={handleDetailChange}
          addDetalle={addDetalle}
          removeDetalle={removeDetalle}
          showMeasurementComparison={fabricationShowMeasurementComparison}
          materialsData={fabricationMaterialsData}
        />
      ),
    },
    {
      id: 'additional-works',
      label: 'Trabajos adicionales',
      description: 'Extras, frentes y trabajos del catálogo.',
      content: (
        <AdditionalWorkSection
          value={form.additional_works_data}
          onChange={(json) => setForm({ ...form, additional_works_data: json })}
          readOnly={readOnly}
          formMaterials={formMaterials}
        />
      ),
    },
    {
      id: 'sketch',
      label: 'Diseño y plano',
      description: 'Croquis, observaciones y diseño.',
      content: (
        <SketchSection
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
          sketchElements={form.sketch_elements}
          onChange={(v) => update('sketch_elements', v)}
          readOnly={readOnly}
          toggleLabel="Diseño / Plano"
        />
      ),
    },
    {
      id: 'financial',
      label: 'Totales y pago',
      description: 'Precios, descuentos, señas y entrega.',
      content: (
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
          onUsdRateRefresh={onUsdRateRefresh}
          setForm={setForm}
          update={update}
          num={parseNumber}
          alternativasGrid={alternativasGrid}
          discountBlock={discountBlock}
          onConfirmarPago={onConfirmarPago}
        />
      ),
    },
    {
      id: 'review',
      label: 'Observaciones y condiciones',
      description: 'Notas finales, entrega y garantía.',
      content: (
        <div className={s[`${prefix}right`]}>
          {observations}
          {wizardTerms}
        </div>
      ),
    },
  ];

  return (
    <>
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault();
        }}
      >
        {mode === 'wizard' ? (
          <EntityFormWizard
            steps={wizardSteps}
            activeStep={wizardStep}
            onStepChange={setWizardStep}
            onCancel={onCancel}
            saving={saving}
          />
        ) : (
          <>
            <EntityFormClient
          form={form}
          readOnly={readOnly}
          update={update}
          clientes={clientes}
          onClientCreated={addOrRefreshClientes}
          onAddressAdded={onAddressAdded}
        />

        {beforeLayout}

        <div className={layoutClassName}>
          <div className={s[`${prefix}right`]}>
            <EntityFormSpecs
              form={form}
              readOnly={readOnly}
              materials={materiales}
              addMaterial={addMaterial}
              updateMaterial={updateMaterial}
              removeMaterial={removeMaterial}
              update={update}
              num={parseNumber}
              cardClassName={specsCardClassName}
            />
            <BudgetFormAdicionales
              form={form}
              readOnly={readOnly}
              pools={pools}
              formMaterials={formMaterials}
              updatePileta={updatePileta}
              removePileta={removePileta}
              addPileta={addPileta}
              num={parseNumber}
            />
          </div>
          <div className={s[`${prefix}right`]}>
            <FabricationSection
              detalles={(form.fabrication_details as FabricationDetail[]) || []}
              readOnly={readOnly}
              formMaterials={formMaterials}
              M2_CONCEPTS={M2_CONCEPTS}
              num={parseNumber as (v: unknown) => number}
              handleDetailChange={handleDetailChange}
              addDetalle={addDetalle}
              removeDetalle={removeDetalle}
              showMeasurementComparison={fabricationShowMeasurementComparison}
              materialsData={fabricationMaterialsData}
            />
            <AdditionalWorkSection
              value={form.additional_works_data}
              onChange={(json) => setForm({ ...form, additional_works_data: json })}
              readOnly={readOnly}
              formMaterials={formMaterials}
            />
          </div>
        </div>

        <div className={s[`${prefix}bottom`]}>
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
            onUsdRateRefresh={onUsdRateRefresh}
            setForm={setForm}
            update={update}
            num={parseNumber}
            alternativasGrid={alternativasGrid}
            discountBlock={discountBlock}
            onConfirmarPago={onConfirmarPago}
          />
        </div>

        {observations}

        {terms.map((t) => (
          <div key={t.title} className={s[`${prefix}card`]} style={{ marginTop: 16 }}>
            <h3 className={s[`${prefix}card-title`]}>{t.title}</h3>
            <TermsEditor
              items={t.items}
              onChange={t.onChange}
              placeholder={t.placeholder || ''}
              hint={t.hint}
              disabled={t.disabled}
            />
          </div>
        ))}

        <FormFooter saving={saving} onCancel={onCancel} />
          </>
        )}
      </form>

      <Suspense fallback={<LoadingSpinner />}>
        <PdfPreviewModal
          isOpen={pdfData !== null || pdfPreviewLoading}
          onClose={handleClosePdfPreview}
          data={pdfData}
          loading={pdfPreviewLoading}
          title={pdfTitle}
          fileName={pdfFileName}
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

      <ConfirmDialog
        open={deleteConfirm}
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel={deleteConfirmLabel}
        danger={deleteDanger}
      />

      {extraDialogs}
    </>
  );
}