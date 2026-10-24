import React, { useState } from 'react';
import type { FabricationDetail } from '../../types';
import PorcelainCalculatorSection from '../calculator/PorcelainCalculatorSection/PorcelainCalculatorSection';
import TermsEditor from '../ui/TermsEditor/TermsEditor';
import EntityFormWizard from './EntityFormWizard';
import EntityFormLayoutPiecesLayout from './EntityFormLayout.PiecesLayout';
import EntityFormLayoutLegacyLayout from './EntityFormLayout.LegacyLayout';
import EntityFormLayoutOverlays from './EntityFormLayout.Overlays';
import { useEntityFormWizardSteps } from './EntityFormLayout.useWizardSteps';
import {
  useEntityFormActions,
  useEntityFormDomain,
  useEntityFormState,
  useEntityFormStyle,
} from './EntityFormContexts';
import type {
  EntityFormLayoutProps,
  EntityFormLayoutSlots,
} from './EntityFormLayout.types';

// Public types — kept exported from this file so the consuming pages
// (and any other consumer) keep importing them from the same place.
export type { EntityFormLayoutProps, EntityFormLayoutSlots, TermConfig } from './EntityFormLayout.types';

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

/**
 * Orchestrator of the shared entity form body.
 *
 * It only decides WHICH layout runs (wizard / pieces-only / legacy
 * 2-column) and assembles the page-specific slots every sub-block needs.
 * The blocks themselves live in focused sibling components:
 *
 *   - `EntityFormLayout.ClientBlock`  → client card (shared by all modes)
 *   - `EntityFormLayout.BottomStack`  → calculator + croquis + totals +
 *                                        observations + terms + footer
 *   - `EntityFormLayout.PiecesLayout` → pieces-only cascade (budgets)
 *   - `EntityFormLayout.LegacyLayout` → flat 2-column layout
 *   - `EntityFormLayout.Overlays`     → PDF preview + delete dialog
 *   - `EntityFormLayout.useWizardSteps` → the wizard panels
 */
export default function EntityFormLayout(props: EntityFormLayoutProps) {
  const { styles: s, prefix, state, domain, actions } = useEntityFormLayoutInternals();
  const { form, update, readOnly, saving } = state;
  const { formMaterials, modoUSD } = domain;
  const { showCroquis, handleSubmit, onCancel } = actions;

  const {
      beforeLayout, observations, terms = [],
    alternativasGrid, actionBlock, extraDialogs,
    specsCardClassName, fabricationShowMeasurementComparison, fabricationMaterialsData,
    mode = 'full',
    showPieces = true,
    piecesFlow,
    paymentSection,
  } = props;

  // Pieces v3: both budgets AND work orders render in pieces-only mode.
  // A legacy consumer could still pass `showPieces={false}` to opt back
  // into the flat layout, but nothing does today.
  const piecesOn = Boolean(showPieces && piecesFlow);

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

  const addPorcelainDetail = (detail: FabricationDetail) =>
    update('fabrication_details', [...(form.fabrication_details || []), detail]);

  // Unique material names from the form so each sketch page can be labeled
  // with the countertop material it draws (printed on the taller sheet).
  // Trimmed: catalog names may carry a trailing space (e.g. "ROSA DE SALTO "),
  // while `setPageMaterial` persists the trimmed value — the <option> values
  // must match the persisted value or the select falls back to "Material…".
  const sketchMaterials = Array.from(
    new Set(
      formMaterials
        .map((m) => (m.name || '').trim())
        .filter((n): n is string => Boolean(n && n.trim())),
    ),
  );

  const porcelainCalculatorProps = {
    readOnly,
    currency: modoUSD ? 'USD' as const : 'ARS' as const,
    onAddDetail: addPorcelainDetail,
    addLabel: prefix.startsWith('budget') ? 'Agregar al presupuesto' : 'Agregar a la orden',
  };

  // En el wizard vive en su propio paso: arrancá abierta para que el primer
  // plano sea la calculadora (no requiera apretar el toggle).
  const porcelainCalculator = <PorcelainCalculatorSection {...porcelainCalculatorProps} defaultOpen />;

  // En el modo full vive al pie, junto al croquis: collapsed por defecto.
  const porcelainCalculatorCollapsed = <PorcelainCalculatorSection {...porcelainCalculatorProps} />;

  const slots: EntityFormLayoutSlots = {
    beforeLayout,
    observations,
    terms,
    wizardTerms,
    alternativasGrid,
    actionBlock,
    paymentSection,
    onConfirmarPago: actions.onConfirmarPago,
    porcelainCalculator,
    porcelainCalculatorCollapsed,
    sketchMaterials,
  };

  const wizardSteps = useEntityFormWizardSteps({
    slots,
    piecesOn,
    piecesFlow,
    specsCardClassName,
    fabricationShowMeasurementComparison,
    fabricationMaterialsData,
  });

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
        ) : piecesOn && piecesFlow ? (
          // Pieces-only mode (budgets): single-column cascade. The pieces
          // card already embeds its own pools + zócalo/frente + adicionales
          // sections, so the legacy globals (MATERIALES / PILETAS /
          // FABRICACIÓN / ADICIONALES) collapse into it.
          <EntityFormLayoutPiecesLayout
            slots={slots}
            piecesFlow={piecesFlow}
            fabricationShowMeasurementComparison={fabricationShowMeasurementComparison}
          />
        ) : (
          <EntityFormLayoutLegacyLayout
            slots={slots}
            layoutClassName={layoutClassName}
            specsCardClassName={specsCardClassName}
            fabricationShowMeasurementComparison={fabricationShowMeasurementComparison}
            fabricationMaterialsData={fabricationMaterialsData}
          />
        )}
      </form>

      <EntityFormLayoutOverlays extraDialogs={extraDialogs} />
    </>
  );
}
