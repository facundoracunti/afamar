import React from 'react';
import type { CroquisToolType, CroquisPage, CroquisElement } from '../../../types/croquis';
import styles from './Toolbar.module.css';

const s = styles as unknown as Record<string, string>;

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

const btn = (active: boolean) =>
  active ? `${s['toolbar__button']} ${s['toolbar__button--active']}` : s['toolbar__button'];

const btnDisabled = (enabled: boolean) =>
  enabled ? s['toolbar__button'] : `${s['toolbar__button']} ${s['toolbar__button--disabled']}`;

const pageBtn = (isActive: boolean) =>
  isActive
    ? `${s['toolbar__page-button']} ${s['toolbar__page-button--active']}`
    : s['toolbar__page-button'];

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
      <div className={s['toolbar__title-bar']}>
        <span>DISEÑO / CROQUIS</span>
        {snap && <span className={s['toolbar__snap-indicator']}>Imán activado</span>}
      </div>

      {!readOnly && (
        <div className={s['toolbar__pages-row']}>
          {pages.map((p) => {
            const i = pages.indexOf(p);
            const isActive = i === pageIdx;
            return (
              <div key={p.id} className={s['toolbar__page-item']}>
                <button
                  type="button"
                  className={pageBtn(isActive)}
                  onClick={() => onSetPageIdx(i)}
                  onDoubleClick={() => {
                    const name = prompt('Renombrar página:', p.name);
                    if (name && name.trim()) onRenamePage(p.id, name.trim());
                  }}
                >
                  {p.name}
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemovePage(p.id)}
                    className={s['toolbar__page-remove']}
                    title="Eliminar página"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={onAddPage}
            className={s['toolbar__add-page']}
          >
            + Agregar Página
          </button>
        </div>
      )}

      {!readOnly && (
        <div className={s['toolbar__tools-row']}>
          {toolsList.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSetTool(t.id)}
              title={t.label}
              className={btn(tool === t.id)}
            >
              {t.icon}
            </button>
          ))}

          <div className={s['toolbar__separator']} />

          <button
            type="button"
            onClick={onUndo}
            title="Deshacer (Ctrl+Z)"
            disabled={!canUndo}
            className={btnDisabled(canUndo)}
          >
            ↩
          </button>
          <button
            type="button"
            onClick={onRedo}
            title="Rehacer (Ctrl+Shift+Z)"
            disabled={!canRedo}
            className={btnDisabled(canRedo)}
          >
            ↪
          </button>

          <div className={s['toolbar__separator']} />

          <button
            type="button"
            onClick={onSetSnap}
            title={snap ? 'Desactivar imán' : 'Activar imán'}
            className={snap ? `${s['toolbar__button']} ${s['toolbar__button--snap-active']}` : s['toolbar__button']}
          >
            🧲
          </button>

          <div className={s['toolbar__separator']} />

          {sid && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className={s['toolbar__action-danger']}
            >
              Eliminar selección
            </button>
          )}

          <button
            type="button"
            onClick={onDeleteLast}
            disabled={currentShapes.length === 0}
            title="Borrar el último elemento dibujado"
            className={currentShapes.length === 0 ? s['toolbar__action-danger--disabled'] : s['toolbar__action-danger']}
          >
            Borrar último
          </button>

          <button
            type="button"
            onClick={onClearAll}
            className={s['toolbar__action-danger']}
          >
            Limpiar todo
          </button>

          <span className={s['toolbar__status']}>
            {pages.length} pág · {currentShapes.length} obj
          </span>
        </div>
      )}
    </>
  );
}
