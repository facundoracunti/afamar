import React from 'react';
import { Save } from 'lucide-react';

interface FormFooterProps {
  saving: boolean;
  onCancel: () => void;
  showSave?: boolean;
}

export default function FormFooter({ saving, onCancel, showSave = true }: FormFooterProps) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
      <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      {showSave && (
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#b91c1c' }}>
          <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      )}
    </div>
  );
}
