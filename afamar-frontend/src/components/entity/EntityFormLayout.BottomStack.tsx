/**
 * Bottom stack of the shared entity form layout.
 *
 * Shared between the pieces-only branch (budgets) and the legacy 2-column
 * branch (work orders). These modules are document-global, not piece-scoped,
 * so they always render below the materials/pieces card regardless of the
 * layout mode.
 */
import React from 'react';
import SketchSection from '../sketch/SketchSection/SketchSection';
import FormFooter from '../orders/FormFooter/FormFooter';
import TermsEditor from '../ui/TermsEditor/TermsEditor';
import EntityFormFinancial from './EntityFormFinancial';
import { parseNumber } from '../../utils/formatters';
import {
  useEntityFormActions,
  useEntityFormDomain,
  useEntityFormState,
  useEntityFormStyle,
} from './EntityFormContexts';
import type { EntityFormLayoutSlots } from './EntityFormLayout.types';

interface EntityFormLayoutBottomStackProps {
  slots: EntityFormLayoutSlots;
}

export default function EntityFormLayoutBottomStack({ slots }: EntityFormLayoutBottomStackProps) {
  const { styles: s, prefix } = useEntityFormStyle();
  const { form, setForm, update, readOnly, saving } = useEntityFormState();
  const {
    modoUSD, toggleModoUSD, hayUSD, hayAlternativas,
    handleTransportChange, handleDepositCurrencyChange, handleDepositAmountChange,
    handleUsdRateChange, onUsdRateRefresh,
    paymentMethods,
  } = useEntityFormDomain();
  const { showCroquis, setShowCroquis, onCancel } = useEntityFormActions();

  const {
    observations, terms, alternativasGrid, actionBlock, paymentSection,
    onConfirmarPago, porcelainCalculatorCollapsed, sketchMaterials,
  } = slots;

  return (
    <>
      <div className={s[`${prefix}bottom`]}>
        {porcelainCalculatorCollapsed}

        <SketchSection
          showCroquis={showCroquis}
          setShowCroquis={setShowCroquis}
          sketchElements={form.sketch_elements}
          onChange={(v) => update('sketch_elements', v)}
          readOnly={readOnly}
          toggleLabel="Diseño / Plano"
          materials={sketchMaterials}
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
          actionBlock={actionBlock}
          paymentSection={paymentSection}
          onConfirmarPago={onConfirmarPago}
          paymentMethods={paymentMethods}
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
  );
}
