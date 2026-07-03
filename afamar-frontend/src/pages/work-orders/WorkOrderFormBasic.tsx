import React from 'react';
import ClientSection from '../../components/orders/ClientSection';
import type { EntityFormState } from '../../types';

interface WorkOrderFormBasicProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clientRef: React.RefObject<HTMLDivElement>;
  showClientDropdown: boolean;
  setShowClientDropdown: (v: boolean) => void;
  filteredClients: unknown[];
  handleClientSelect: (c: Record<string, unknown>) => void;
}

export default function WorkOrderFormBasic({
  form,
  readOnly,
  update,
  clientRef,
  showClientDropdown,
  setShowClientDropdown,
  filteredClients,
  handleClientSelect,
}: WorkOrderFormBasicProps) {
  return (
    <>
      <ClientSection
        form={form}
        readOnly={readOnly}
        update={update}
        clientRef={clientRef}
        showClientDropdown={showClientDropdown}
        setShowClientDropdown={setShowClientDropdown}
        filteredClients={filteredClients}
        handleClientSelect={handleClientSelect}
      />
      <div className="card">
        <h3 className="section-title">ESTADO Y PRIORIDAD</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label>Estado</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              disabled={readOnly}
            >
              <option value="MEDICION">Medición</option>
              <option value="TALLER">Taller</option>
              <option value="TERMINADA">Terminada</option>
              <option value="ENTREGADA">Entregada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}