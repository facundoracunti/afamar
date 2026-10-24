/**
 * Context providers of the budget form.
 *
 * The page owns the data (via `useEntityForm`) and the actions; this
 * component publishes them into the entity form contexts consumed by
 * `EntityFormLayout` and its sub-blocks. The budget-options provider sits
 * on top of them: it owns the multi-option array and keeps `form.pieces`
 * mirroring the active option.
 */
import React, { type ReactNode } from 'react';
import {
  EntityFormActionsProvider,
  EntityFormDomainProvider,
  EntityFormStateProvider,
  EntityFormStyleProvider,
} from '../../components/entity/EntityFormContexts';
import { BudgetOptionsProvider } from '../../features/budgets/options/BudgetOptionsContext';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import type { UseEntityFormReturn } from '../../types';
import type { ClientAddress } from '../../types/client';
import styles from './BudgetFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface BudgetFormPageProvidersProps {
  /** Everything `useEntityForm` returns — the source of truth of the form. */
  entity: UseEntityFormReturn;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  handleAddressAdded: (clientId: number, address: ClientAddress) => void;
  onUsdRateRefresh: () => void;
  /** PDF preview lifecycle owned by the page. */
  pdfPreview: {
    pdfData: PdfDocumentData | null;
    pdfPreviewLoading: boolean;
    sketchExtractorActive: boolean;
    handleClosePdfPreview: () => void;
    handleSketchImagesReady: (images: string[]) => void;
  };
  children: ReactNode;
}

export default function BudgetFormPageProviders({
  entity,
  handleSubmit,
  onCancel,
  handleAddressAdded,
  onUsdRateRefresh,
  pdfPreview,
  children,
}: BudgetFormPageProvidersProps) {
  const { form } = entity;
  const {
    pdfData, pdfPreviewLoading, sketchExtractorActive,
    handleClosePdfPreview, handleSketchImagesReady,
  } = pdfPreview;

  return (
    <EntityFormStyleProvider value={{ styles: s, prefix: 'budget-form__' }}>
      {/* Multi-option budgets (2026-10-01 Fase 2): the provider owns the
          options array AND keeps `form.pieces` mirroring the active
          option, so every consumer below (totals, PDF, pieces editor)
          keeps reading `form.pieces` unchanged. A legacy budget has
          `options: []` → fully inert. */}
      <BudgetOptionsProvider form={form} setForm={entity.setForm}>
        <EntityFormStateProvider
          value={{
            form,
            setForm: entity.setForm,
            update: entity.update,
            readOnly: entity.readOnly,
            saving: entity.saving,
            logoUrl: entity.logoUrl,
            M2_CONCEPTS: entity.M2_CONCEPTS,
          }}
        >
          <EntityFormDomainProvider
            value={{
              clientes: entity.clientes,
              materials: entity.materials,
              pools: entity.pools,
              paymentMethods: entity.paymentMethods,
              addOrRefreshClientes: entity.addOrRefreshClientes,
              onAddressAdded: handleAddressAdded,
              addMaterial: entity.addMaterial,
              removeMaterial: entity.removeMaterial,
              updateMaterial: entity.updateMaterial,
              addMaterialRow: entity.addMaterialRow,
              removeMaterialGroup: entity.removeMaterialGroup,
              updateMaterialGroup: entity.updateMaterialGroup,
              swapMaterialGroup: entity.swapMaterialGroup,
              addPileta: entity.addPileta,
              removePileta: entity.removePileta,
              updatePileta: entity.updatePileta,
              setPoolFields: entity.setPoolFields,
              handleDetailChange: entity.handleDetailChange,
              addDetalle: entity.addDetalle,
              removeDetalle: entity.removeDetalle,
              modoUSD: entity.modoUSD,
              toggleModoUSD: entity.toggleModoUSD,
              hayUSD: entity.hayUSD,
              hayAlternativas: entity.hayAlternativas,
              handleTransportChange: entity.handleTransportChange,
              handleDepositCurrencyChange: entity.handleDepositCurrencyChange,
              handleDepositAmountChange: entity.handleDepositAmountChange,
              handleUsdRateChange: entity.handleUsdRateChange,
              onUsdRateRefresh,
              formMaterials: form.materials_data || [],
            }}
          >
            <EntityFormActionsProvider
              value={{
                handleSubmit,
                onCancel,
                deleteConfirm: entity.deleteConfirm,
                setDeleteConfirm: entity.setDeleteConfirm,
                handleDelete: entity.handleDelete,
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
                showCroquis: entity.showCroquis,
                setShowCroquis: entity.setShowCroquis,
              }}
            >
              {children}
            </EntityFormActionsProvider>
          </EntityFormDomainProvider>
        </EntityFormStateProvider>
      </BudgetOptionsProvider>
    </EntityFormStyleProvider>
  );
}
