import React from 'react';
import { Save, FileOutput } from 'lucide-react';

interface Props {
  onWhatsApp: () => void;
  onCancel: () => void;
  isEdit: boolean;
  onConvertAll: () => Promise<void>;
  saving: boolean;
}

export default function OnlineBudgetFooter({ onWhatsApp, onCancel, isEdit, onConvertAll, saving }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' } as React.CSSProperties}>
      <button type="button" className="btn btn-success" onClick={onWhatsApp}
        style={{ display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Exportar para WhatsApp
      </button>
      <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      {isEdit && (
        <button type="button" className="btn" onClick={onConvertAll} style={{ background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties}>
          <FileOutput size={16} /> CONVERTIR A OT
        </button>
      )}
      <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: '#b91c1c' } as React.CSSProperties}>
        <Save size={16} /> {saving ? 'GUARDANDO...' : 'GUARDAR'}
      </button>
    </div>
  );
}
