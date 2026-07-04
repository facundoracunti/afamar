import React from 'react';
import type { CroquisToolType, CroquisPage, CroquisElement } from '../../../types/croquis';

const TBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid transparent',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 16,
  color: '#374151',
  background: 'transparent',
};

const TBtnOn: React.CSSProperties = {
  ...TBtn,
  border: '2px solid #3b82f6',
  background: '#dbeafe',
};

const TBtnOff: React.CSSProperties = {
  ...TBtn,
  opacity: 0.35,
  cursor: 'not-allowed',
};

const Separator: React.CSSProperties = {
  width: 1,
  height: 24,
  background: '#d1d5db',
  margin: '0 4px',
};

interface ToolbarProps {
  pages: CroquisPage[];
  pageIdx: number;
  tool: CroquisToolType;
  snap: boolean;
  sid: string | null;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentShapes: CroquisElement[];

  onSetTool: (t: CroquisToolType) => void;
  onSetSnap: () => void;
  onSetPageIdx: (i: number) => void;
  onAddPage: () => void;
  onRemovePage: (id: number) => void;
  onRenamePage: (id: number, name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onDeleteLast: () => void;
  onClearAll: () => void;
}

const toolsList: { id: CroquisToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Seleccionar', icon: '⬆' },
  { id: 'line', label: 'Línea', icon: '╱' },
  { id: 'rect', label: 'Rectángulo Mesada', icon: '▭' },
  { id: 'cutout', label: 'Bacha / Anafe', icon: '⊡' },
  { id: 'text', label: 'Texto', icon: 'T' },
];

export default function Toolbar({
  pages,
  pageIdx,
  tool,
  snap,
  sid,
  readOnly,
  canUndo,
  canRedo,
  currentShapes,

  onSetTool,
  onSetSnap,
  onSetPageIdx,
  onAddPage,
  onRemovePage,
  onRenamePage,
  onUndo,
  onRedo,
  onDeleteSelected,
  onDeleteLast,
  onClearAll,
}: ToolbarProps) {
  return (
    <>
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #e5e7eb',
          fontWeight: 700,
          fontSize: 14,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>DISEÑO / CROQUIS</span>
        {snap && <span style={{ fontSize: 11, color: '#059669' }}>Imán activado</span>}
      </div>

      {!readOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '4px 8px',
            borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc',
            flexWrap: 'wrap',
            overflowX: 'auto',
          }}
        >
          {pages.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                onClick={() => onSetPageIdx(pages.indexOf(p))}
                onDoubleClick={() => {
                  const name = prompt('Renombrar página:', p.name);
                  if (name && name.trim()) onRenamePage(p.id, name.trim());
                }}
                style={{
                  padding: '3px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: 'pointer',
                  border:
                    pages.indexOf(p) === pageIdx
                      ? '2px solid #b91c1c'
                      : '1px solid #d1d5db',
                  background:
                    pages.indexOf(p) === pageIdx ? '#b91c1c' : '#fff',
                  color:
                    pages.indexOf(p) === pageIdx ? '#fff' : '#374151',
                  fontWeight: pages.indexOf(p) === pageIdx ? 700 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                {p.name}
              </button>
              {pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemovePage(p.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ef4444',
                    fontSize: 14,
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                  title="Eliminar página"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={onAddPage}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              borderRadius: 4,
              cursor: 'pointer',
              border: '1px solid #16a34a',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            + Agregar Página
          </button>
        </div>
      )}

      {!readOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: '4px 8px',
            borderBottom: '1px solid #e5e7eb',
            background: '#fafafa',
            flexWrap: 'wrap',
          }}
        >
          {toolsList.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSetTool(t.id)}
              title={t.label}
              style={tool === t.id ? TBtnOn : TBtn}
            >
              {t.icon}
            </button>
          ))}

          <div style={Separator} />

          <button
            type="button"
            onClick={onUndo}
            title="Deshacer (Ctrl+Z)"
            disabled={!canUndo}
            style={canUndo ? TBtn : TBtnOff}
          >
            ↩
          </button>
          <button
            type="button"
            onClick={onRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            disabled={!canRedo}
            style={canRedo ? TBtn : TBtnOff}
          >
            ↪
          </button>

          <div style={Separator} />

          <button
            type="button"
            onClick={onSetSnap}
            title={snap ? 'Desactivar imán' : 'Activar imán'}
            style={{
              ...TBtn,
              background: snap ? '#dbeafe' : 'transparent',
              border: snap
                ? '1px solid #3b82f6'
                : '1px solid transparent',
              fontSize: 15,
            }}
          >
            🧲
          </button>

          <div style={Separator} />

          {sid && (
            <button
              type="button"
              onClick={onDeleteSelected}
              style={{
                background: '#fee2e2',
                border: '1px solid #ef4444',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                color: '#dc2626',
                padding: '2px 10px',
              }}
            >
              Eliminar selección
            </button>
          )}

          <button
            type="button"
            onClick={onDeleteLast}
            disabled={currentShapes.length === 0}
            title="Borrar el último elemento dibujado"
            style={{
              background: currentShapes.length === 0 ? '#f3f4f6' : '#fef2f2',
              border: '1px solid #ef4444',
              borderRadius: 4,
              cursor: currentShapes.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 11,
              color: currentShapes.length === 0 ? '#9ca3af' : '#dc2626',
              padding: '2px 10px',
              opacity: currentShapes.length === 0 ? 0.6 : 1,
            }}
          >
            Borrar último
          </button>

          <button
            type="button"
            onClick={onClearAll}
            style={{
              background: '#fef2f2',
              border: '1px solid #ef4444',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 11,
              color: '#dc2626',
              padding: '2px 10px',
            }}
          >
            Limpiar todo
          </button>

          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: '#6b7280',
            }}
          >
            {pages.length} pág · {currentShapes.length} obj
          </span>
        </div>
      )}
    </>
  );
}
