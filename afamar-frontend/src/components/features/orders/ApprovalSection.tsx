import React from 'react';
import SignatureCanvas from '../signature/SignatureCanvas';
import type { EntityFormState } from '../../../types/form';

interface ApprovalSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
}

export default function ApprovalSection({ form, readOnly, update }: ApprovalSectionProps) {
  return (
    <div className="card">
      <h3 className="section-title">APROBACIÓN DEL CLIENTE</h3>
      <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
        El cliente aprueba el diseño y presupuesto.
      </p>
      <SignatureCanvas
        value={form.digital_signature}
        onChange={(v: unknown) => update('digital_signature', v)}
        label="Firma del cliente"
        height={140}
        readOnly={readOnly}
      />
      <div className="form-group" style={{ marginTop: 8 }}>
        <label>Fecha de aprobación</label>
        <input type="date" className="input" value={form.signed_at || ''} onChange={(e) => update('signed_at', e.target.value)} disabled={readOnly} />
      </div>
    </div>
  );
}
