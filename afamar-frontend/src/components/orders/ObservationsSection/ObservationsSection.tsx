import React, { useEffect, useState } from 'react';
import TermsEditor from '../../ui/TermsEditor/TermsEditor';
import type { EntityFormState } from '../../../types/form';

interface ObservationsSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  className: string;
  titleClassName: string;
}

/**
 * "Observaciones" card — same shape as the Términos / Garantía cards:
 * a TermsEditor that lets the operator add one item per bullet.
 *
 * Storage: the model column is `Mapped[str]` (TEXT), so the list is
 * JSON-encoded by the frontend before being stored and JSON-decoded
 * on load. This is the same convention used by the Términos /
 * Garantía / Condiciones de Entrega cards on the same form — the
 * `encodeTerms` helper in BudgetFormPage / WorkOrderFormPage does
 * the JSON.stringify/parse for those override fields.
 */
export default function ObservationsSection({
  form,
  readOnly,
  update,
  className,
  titleClassName,
}: ObservationsSectionProps) {
  const [items, setItems] = useState<string[]>(() => parseObservations(form.important_observations));

  // Keep the local list in sync when the form is loaded with a different
  // value (e.g. when navigating to an existing budget).
  useEffect(() => {
    const fromForm = parseObservations(form.important_observations);
    if (fromForm.join('|') !== items.join('|')) {
      setItems(fromForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.important_observations]);

  const handleChange = (next: string[]) => {
    setItems(next);
    update('important_observations', JSON.stringify(next));
  };

  return (
    <div className={className} style={{ marginTop: 16 }}>
      <h3 className={titleClassName}>Observaciones</h3>
      <TermsEditor
        items={items}
        onChange={handleChange}
        placeholder="Ej: No se realizan instalaciones…"
        hint="Cada línea es una observación para el cliente. Si la lista queda vacía, no se incluye ninguna."
        disabled={readOnly}
      />
    </div>
  );
}

/**
 * Parse the JSON-encoded `important_observations` string from the
 * backend. Tolerates legacy values stored with newline separators
 * (older rows) and the empty / null case.
 */
function parseObservations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string' && s.trim() !== '') : [];
  } catch {
    // Fallback: legacy newline-separated string.
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }
}
