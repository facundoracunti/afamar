import React from 'react';
import { Save } from 'lucide-react';
import styles from './FormFooter.module.css';

const s = styles as unknown as Record<string, string>;

interface FormFooterProps {
  saving: boolean;
  onCancel: () => void;
  showSave?: boolean;
}

export default function FormFooter({ saving, onCancel, showSave = true }: FormFooterProps) {
  return (
    <div className={s['form-footer']}>
      <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      {showSave && (
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      )}
    </div>
  );
}
