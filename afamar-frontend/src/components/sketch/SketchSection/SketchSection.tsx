import React from 'react';
import CroquisEditor from '../CroquisEditor/CroquisEditor';
import styles from './SketchSection.module.css';

const s = styles as unknown as Record<string, string>;

interface SketchSectionProps {
  showCroquis: boolean;
  setShowCroquis: (v: boolean) => void;
  sketchElements: unknown;
  onChange: (v: unknown) => void;
  readOnly: boolean;
  /** Override the default hint text shown when the sketch is hidden. */
  hiddenHint?: string;
  /** Override the toggle label (defaults to "Diseño / Croquis"). */
  toggleLabel?: string;
}

export default function SketchSection({
  showCroquis, setShowCroquis,
  sketchElements, onChange, readOnly,
  hiddenHint = 'Croquis oculto.',
  toggleLabel = 'Diseño / Croquis',
}: SketchSectionProps) {
  return (
    <div className={s['sketch-section']}>
      <div className={s['sketch-section__header']}>
        <button
          type="button"
          className={`btn btn-outline ${s['sketch-section__toggle']}`}
          onClick={() => setShowCroquis(!showCroquis)}
        >
          {showCroquis ? '👁️' : '📐'} {showCroquis ? `Ocultar ${toggleLabel}` : `Activar ${toggleLabel}`}
        </button>
        {!showCroquis && <span className={s['sketch-section__hint']}>{hiddenHint}</span>}
      </div>
      {showCroquis && (
        <div className={s['sketch-section__editor']}>
          <CroquisEditor croquis={sketchElements as never} onChange={onChange} readOnly={readOnly} />
        </div>
      )}
    </div>
  );
}