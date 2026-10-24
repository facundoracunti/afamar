/**
 * Context providers of the work order form.
 *
 * The page owns the data (via `useEntityForm`) and the actions; this
 * component publishes them into the 4 entity form contexts consumed by
 * `EntityFormLayout` and its sub-blocks.
 */
import React, { type ReactNode } from 'react';
import {
  EntityFormActionsProvider,
  EntityFormDomainProvider,
  EntityFormStateProvider,
  EntityFormStyleProvider,
} from '../../components/entity/EntityFormContexts';
import type { PdfDocumentData } from '../../utils/pdf/buildPdfData';
import type { UseEntityFormReturn } from '../../types';
import type { ClientAddress } from '../../types/client';
import styles from './WorkOrderFormPage.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderFormPageProvidersProps {
  /** Everything `useEntityForm` returns — the source of truth of the form. */
  entity: UseEntityFormReturn;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  onConfirmarPago?: () => Promise<void>;
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

export default function WorkOrderFormPageProviders({
  entity,
  handleSubmit,
  onCancel,
  onConfirmarPago,
  handleAddressAdded,
  onUsdRateRefresh,
  pdfPreview,
  children,
}: WorkOrderFormPageProvidersProps) {
  const { form } = entity;
  const {
    pdfData, pdfPreviewLoading, sketchExtractorActive,
    handleClosePdfPreview, handleSketchImagesReady,
  } = pdfPreview;

  return (
    <EntityFormStyleProvider value={{ styles: s, prefix: 'work-order-form__' }}>
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
              onConfirmarPago,
              deleteConfirm: entity.deleteConfirm,
              setDeleteConfirm: entity.setDeleteConfirm,
              handleDelete: entity.handleDelete,
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
              showCroquis: entity.showCroquis,
              setShowCroquis: entity.setShowCroquis,
            }}
          >
            {children}
          </EntityFormActionsProvider>
        </EntityFormDomainProvider>
      </EntityFormStateProvider>
    </EntityFormStyleProvider>
  );
}
