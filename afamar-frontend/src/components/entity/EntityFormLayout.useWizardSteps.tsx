/**
 * Wizard steps of the shared entity form layout.
 *
 * The wizard (mode="wizard") replaces the single-page cascade with one
 * panel per topic. Each step is built here from the entity form contexts
 * so the wizard and the full-mode layout always render the same modules.
 */
import React from 'react';
import type { FabricationDetail, MaterialInForm } from '../../types';
import type { UseBudgetPiecesReturn } from '@features/budgets/hooks/useBudgetPieces';
import PiecesSection from '@features/budgets/components/PiecesSection';
import BudgetFormAdicionales from '../../pages/budgets/BudgetFormAdicionales';
import FabricationSection from '../budget/FabricationSection/FabricationSection';
import AdditionalWorkSection from '../budget/AdditionalWorkSection/AdditionalWorkSection';
import SketchSection from '../sketch/SketchSection/SketchSection';
import EntityFormSpecs from './EntityFormSpecs';
import EntityFormFinancial from './EntityFormFinancial';
import EntityFormLayoutClientBlock from './EntityFormLayout.ClientBlock';
import type { EntityFormWizardStep } from './EntityFormWizard';
import { parseNumber } from '../../utils/formatters';
import {
  useEntityFormActions,
  useEntityFormDomain,
  useEntityFormState,
  useEntityFormStyle,
} from './EntityFormContexts';
import type { EntityFormLayoutSlots } from './EntityFormLayout.types';

interface UseEntityFormWizardStepsParams {
  slots: EntityFormLayoutSlots;
  piecesOn: boolean;
  piecesFlow?: UseBudgetPiecesReturn;
  specsCardClassName?: string;
  fabricationShowMeasurementComparison?: boolean;
  fabricationMaterialsData?: MaterialInForm[];
}

export function useEntityFormWizardSteps({
  slots,
  piecesOn,
  piecesFlow,
  specsCardClassName,
  fabricationShowMeasurementComparison,
  fabricationMaterialsData,
}: UseEntityFormWizardStepsParams): EntityFormWizardStep[] {
  const { styles: s, prefix } = useEntityFormStyle();
  const { form, setForm, update, readOnly, saving, M2_CONCEPTS } = useEntityFormState();
  const {
    materials: materiales, addMaterial, removeMaterial, updateMaterial,
    addMaterialRow, removeMaterialGroup, updateMaterialGroup, swapMaterialGroup,
    pools, addPileta, removePileta, updatePileta, setPoolFields,
    handleDetailChange, addDetalle, removeDetalle,
    modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
    handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange,
    handleUsdRateChange, onUsdRateRefresh,
    formMaterials,
    paymentMethods,
  } = useEntityFormDomain();
  const { showCroquis, setShowCroquis } = useEntityFormActions();

  const {
    beforeLayout, observations, wizardTerms, alternativasGrid, actionBlock,
    paymentSection, onConfirmarPago, porcelainCalculator, sketchMaterials,
  } = slots;

  return [
    {
      id: 'client',
      label: 'Cliente y entrega',
      description: 'Datos del cliente y domicilio de obra.',
      content: (
        <>
          <EntityFormLayoutClientBlock />
          {beforeLayout}
        </>
      ),
    },
    {
      id: 'materials',
      label: 'Materiales',
      description: 'Materiales principales y alternativas.',
      content: piecesOn && piecesFlow ? (
        <PiecesSection
          form={form}
          readOnly={readOnly}
          materials={materiales}
          pools={pools}
          pieces={piecesFlow.pieces}
          handlers={piecesFlow}
          showMeasurementComparison={fabricationShowMeasurementComparison}
        />
      ) : (
        <EntityFormSpecs
          form={form}
          readOnly={readOnly}
          materials={materiales}
          addMaterial={addMaterial}
          updateMaterial={updateMaterial}
          removeMaterial={removeMaterial}
          addMaterialRow={addMaterialRow}
          removeMaterialGroup={removeMaterialGroup}
          updateMaterialGroup={updateMaterialGroup}
          swapMaterialGroup={swapMaterialGroup}
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
          setPoolFields={setPoolFields}
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
          materials={sketchMaterials}
        />
      ),
    },
    {
      id: 'porcelain-calculator',
      label: 'Calculadora de porcelanato',
      description: 'Servicio de corte de zócalos de porcelanato.',
      content: porcelainCalculator,
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
          actionBlock={actionBlock}
          paymentSection={paymentSection}
          onConfirmarPago={onConfirmarPago}
          paymentMethods={paymentMethods}
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
  ].filter(
    // Pieces v3: with the multi-piece editor active, the legacy
    // Piletas / Fabricación / Trabajos adicionales steps collapse into
    // the single "Materiales" step (each piece carries its own pools +
    // zócalos + adicionales). Hide them in the wizard so the operator
    // doesn't see duplicate controls.
    (step) => !piecesOn || !['pools', 'fabrication', 'additional-works'].includes(step.id),
  );
}
