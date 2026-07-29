import React, { Suspense, type ReactNode } from 'react';
import type { EntityFormState, Client, ClientAddress, MaterialInForm, PoolInForm, FabricationDetail } from '../../types';
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
import { ConfirmDialog } from '../ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../ui/LoadingSpinner/LoadingSpinner';
import { parseNumber } from '../../utils/formatters';

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

interface EntityFormLayoutProps {
  styles: Record<string, string>;
  prefix: string;

  form: EntityFormState;
  readOnly: boolean;
  saving: boolean;
  logoUrl: string;

  clientes: Client[];
  addOrRefreshClientes: (client: Client) => void;
  onAddressAdded: (clientId: number, address: ClientAddress) => void;
  update: (field: string, value: unknown) => void;

  materials: Record<string, unknown>[];
  pools: Record<string, unknown>[];
  addMaterial: (name: string) => void;
  removeMaterial: (idx: number) => void;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  addPileta: (id: string) => void;
  removePileta: (idx: number) => void;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  handleDetailChange: (idx: number, field: string, value: unknown) => void;
  addDetalle: () => void;
  removeDetalle: (idx: number) => void;
  M2_CONCEPTS: string[];

  modoUSD: boolean;
  toggleModoUSD: () => void;
  hayUSD: boolean;
  hayAlternativas: boolean;
  handleTransportChange: (value: string, source: 'ars' | 'usd') => void;
  handleDepositCurrencyChange: (currency: string) => void;
  handleDepositAmountChange: (value: string) => void;
  handleUsdRateChange: (value: string) => void;
  setForm: React.Dispatch<React.SetStateAction<EntityFormState>>;
  alternativasGrid?: ReactNode;
  discountBlock?: ReactNode;
  onConfirmarPago?: () => Promise<void>;

  beforeLayout?: ReactNode;
  observations?: ReactNode;
  /** Term cards to render at the bottom of the form. Defaults to [] (none).
   *  WorkOrder passes delivery + warranty; Budget omits them (the values
   *  are not wired into the budget form's save payload — they're only
   *  consumed by the work-order payload via `extraPayloadFields`). */
  terms?: TermConfig[];
  specsCardClassName?: string;
  fabricationShowMeasurementComparison?: boolean;
  fabricationMaterialsData?: MaterialInForm[];

  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  onCancel: () => void;

  showCroquis: boolean;
  setShowCroquis: (v: boolean) => void;

  pdfData: PdfDocumentData | null;
  pdfPreviewLoading: boolean;
  sketchExtractorActive: boolean;
  handleClosePdfPreview: () => void;
  handleSketchImagesReady: (images: string[]) => void;
  pdfTitle: string;
  pdfFileName: string;

  deleteConfirm: boolean;
  setDeleteConfirm: (v: boolean) => void;
  handleDelete: () => void;
  deleteTitle: string;
  deleteMessage: string;
  deleteConfirmLabel?: string;
  deleteDanger?: boolean;

  extraDialogs?: ReactNode;
}

export default function EntityFormLayout({
  styles,
  prefix,

  form, readOnly, saving, logoUrl,

  clientes, addOrRefreshClientes, onAddressAdded, update,

  materials, pools, addMaterial, removeMaterial, updateMaterial,
  addPileta, removePileta, updatePileta,
  handleDetailChange, addDetalle, removeDetalle, M2_CONCEPTS,

  modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
  handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange, handleUsdRateChange,
  setForm,
  alternativasGrid, discountBlock, onConfirmarPago,

  beforeLayout, observations, terms = [],
  specsCardClassName,
  fabricationShowMeasurementComparison, fabricationMaterialsData,

  handleSubmit, onCancel,

  showCroquis, setShowCroquis,

  pdfData, pdfPreviewLoading, sketchExtractorActive,
  handleClosePdfPreview, handleSketchImagesReady,
  pdfTitle, pdfFileName,

  deleteConfirm, setDeleteConfirm, handleDelete,
  deleteTitle, deleteMessage, deleteConfirmLabel, deleteDanger,

  extraDialogs,
}: EntityFormLayoutProps) {
  const s = styles;
  const layoutClass = showCroquis ? `${prefix}layout` : `${prefix}layout ${prefix}layout--no-sketch`;

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={(e: React.KeyboardEvent<HTMLFormElement>) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault(); }}>
        <EntityFormClient
          form={form}
          readOnly={readOnly}
          update={update as (field: string, value: unknown) => void}
          clientes={clientes}
          onClientCreated={addOrRefreshClientes}
          onAddressAdded={onAddressAdded}
        />

        {beforeLayout}

        <div className={s[layoutClass]}>
          <div className={s[`${prefix}right`]}>
            <EntityFormSpecs
              form={form}
              readOnly={readOnly}
              materials={materials}
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
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
              updatePileta={updatePileta}
              removePileta={removePileta}
              addPileta={addPileta}
              num={parseNumber}
            />
          </div>
          <div className={s[`${prefix}right`]}>
            <FabricationSection
              detalles={(form.fabrication_details as unknown as FabricationDetail[]) || []}
              readOnly={readOnly}
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
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
              formMaterials={(form.materials_data as unknown as MaterialInForm[]) || []}
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
            setForm={setForm}
            update={update as (field: string, value: unknown) => void}
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
