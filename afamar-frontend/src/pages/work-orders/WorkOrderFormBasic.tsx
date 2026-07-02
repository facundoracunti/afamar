import React from 'react';
import ClienteSection from '../../components/ordenes/ClienteSection';
import type { EntityFormState } from '../../types';

interface WorkOrderFormBasicProps {
  form: EntityFormState;
  readOnly: boolean;
  update: (field: string, value: unknown) => void;
  clienteRef: React.RefObject<HTMLDivElement>;
  showClienteDropdown: boolean;
  setShowClienteDropdown: (v: boolean) => void;
  clientesFiltrados: unknown[];
  handleClienteSelect: (c: Record<string, unknown>) => void;
}

export default function WorkOrderFormBasic({
  form,
  readOnly,
  update,
  clienteRef,
  showClienteDropdown,
  setShowClienteDropdown,
  clientesFiltrados,
  handleClienteSelect,
}: WorkOrderFormBasicProps) {
  return (
    <>
      <ClienteSection
        form={form}
        readOnly={readOnly}
        update={update}
        clienteRef={clienteRef}
        showClienteDropdown={showClienteDropdown}
        setShowClienteDropdown={setShowClienteDropdown}
        clientesFiltrados={clientesFiltrados}
        handleClienteSelect={handleClienteSelect}
      />
      <div className="card">
        <h3 className="section-title">ESTADO Y PRIORIDAD</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="form-group">
            <label>Estado</label>
            <select
              className="input"
              value={form.estado}
              onChange={(e) => update('estado', e.target.value)}
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