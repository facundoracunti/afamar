import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import styles from './TermsEditor.module.css';

const s = styles as unknown as Record<string, string>;

interface TermsEditorProps {
  /** Current list of terms. Always non-null for the consumer. */
  items: string[];
  /** Called whenever the list changes (add/edit/remove). */
  onChange: (next: string[]) => void;
  /** Disable all interactions. */
  disabled?: boolean;
  /** Placeholder for new item rows. */
  placeholder?: string;
  /** Bullet character rendered to the left of each row (default "•"). */
  bullet?: string;
  /** Render an extra footer slot (e.g. helper text). */
  hint?: string;
}

/**
 * Reusable CRUD editor for ordered term lists.
 *
 * Used in:
 *  - `ConfigurationPage` (admin → configuration, each term input for budget_terms, etc.)
 *  - `BudgetFormPage` / `WorkOrderFormPage` (per-order override of the global terms)
 *  - any future PDF terms editing surface
 *
 * Treats the value as a list-of-strings end-to-end. The serializer (PUT /settings,
 * CRUD on the budget/work-order row) is responsible for turning it into JSON.
 */
export default function TermsEditor({
  items,
  onChange,
  disabled = false,
  placeholder = 'Escribe un término y presiona Agregar…',
  bullet = '•',
  hint,
}: TermsEditorProps) {
  const list: string[] = Array.isArray(items) ? items : [];

  const handleRowChange = (idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    onChange(next);
  };

  const handleDelete = (idx: number) => {
    if (list.length <= 1) {
      onChange([]);
      return;
    }
    onChange(list.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    onChange([...list, '']);
  };

  return (
    <div className={s['terms-editor']}>
      {list.length === 0 && (
        <div className={s['terms-editor__empty']}>
          No hay términos. Agregá el primero con el botón de abajo.
        </div>
      )}

      {list.length > 0 && (
        <ul className={s['terms-editor__list']} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {list.map((value, idx) => (
            <li key={`term-${idx}`} className={s['terms-editor__row']}>
              <span className={s['terms-editor__row-bullet']}>{bullet}</span>
              <input
                type="text"
                className={s['terms-editor__row-input']}
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                onChange={(e) => handleRowChange(idx, e.target.value)}
                aria-label={`Término ${idx + 1}`}
              />
              <button
                type="button"
                className={s['terms-editor__row-delete']}
                onClick={() => handleDelete(idx)}
                disabled={disabled}
                title="Eliminar"
                aria-label="Eliminar término"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={s['terms-editor__add']}
        onClick={handleAdd}
        disabled={disabled}
      >
        <Plus size={14} /> Agregar término
      </button>

      {hint && (
        <small className={s['terms-editor__hint']}>{hint}</small>
      )}
    </div>
  );
}
