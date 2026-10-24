/**
 * Legacy 2-column layout of the shared entity form layout.
 *
 * Kept for the flat (non-pieces) mode: the client card on top, then two
 * columns — MATERIALES + PILETAS on the left, FABRICACIÓN + ADICIONALES on
 * the right — and the shared bottom stack below.
 */
import React from 'react';
import BudgetFormAdicionales from '../../pages/budgets/BudgetFormAdicionales';
import FabricationSection from '../budget/FabricationSection/FabricationSection';
import AdditionalWorkSection from '../budget/AdditionalWorkSection/AdditionalWorkSection';
import EntityFormSpecs from './EntityFormSpecs';
import EntityFormLayoutClientBlock from './EntityFormLayout.ClientBlock';
import EntityFormLayoutBottomStack from './EntityFormLayout.BottomStack';
import { parseNumber } from '../../utils/formatters';
import {
  useEntityFormDomain,
  useEntityFormState,
  useEntityFormStyle,
} from './EntityFormContexts';
import type { EntityFormLayoutSlots } from './EntityFormLayout.types';
import type { FabricationDetail, MaterialInForm } from '../../types';

interface EntityFormLayoutLegacyLayoutProps {
  slots: EntityFormLayoutSlots;
  /** Pre-resolved class name of the 2-column wrapper. */
  layoutClassName: string;
  specsCardClassName?: string;
  fabricationShowMeasurementComparison?: boolean;
  fabricationMaterialsData?: MaterialInForm[];
}

export default function EntityFormLayoutLegacyLayout({
  slots,
  layoutClassName,
  specsCardClassName,
  fabricationShowMeasurementComparison,
  fabricationMaterialsData,
}: EntityFormLayoutLegacyLayoutProps) {
  const { styles: s, prefix } = useEntityFormStyle();
  const { form, setForm, update, readOnly, M2_CONCEPTS } = useEntityFormState();
  const {
    materials: materiales, addMaterial, removeMaterial, updateMaterial,
    addMaterialRow, removeMaterialGroup, updateMaterialGroup, swapMaterialGroup,
    pools, addPileta, removePileta, updatePileta, setPoolFields,
    handleDetailChange, addDetalle, removeDetalle,
    formMaterials,
  } = useEntityFormDomain();

  return (
    <>
      <EntityFormLayoutClientBlock />

      {slots.beforeLayout}

      <div className={layoutClassName}>
        <div className={s[`${prefix}right`]}>
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

      <EntityFormLayoutBottomStack slots={slots} />
    </>
  );
}
