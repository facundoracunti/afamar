import React from 'react';
import type { SketchToolType, SketchPage, SketchElement } from '../../../types/sketch';
import styles from './Toolbar.module.css';

const s = styles as unknown as Record<string, string>;

interface ToolbarProps {
  pages: SketchPage[];
  pageIdx: number;
  tool: SketchToolType;
  snap: boolean;
  sid: string | null;
  readOnly: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentShapes: SketchElement[];
  /** Unique material names available for labeling the active page ('' = none). */
  materials: string[];
  pageMaterial: string;

  onSetTool: (t: SketchToolType) => void;
  onSetSnap: () => void;
  onSetPageIdx: (i: number) => void;
  onAddPage: () => void;
  onRemovePage: (id: number) => void;
  onRenamePage: (id: number, name: string) => void;
  onSetPageMaterial: (v: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onDeleteLast: () => void;
  onClearAll: () => void;
}

const toolsList: { id: SketchToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Seleccionar', icon: '⬆' },
  { id: 'line', label: 'Línea', icon: '╱' },
  { id: 'rect', label: 'Rectángulo Mesada', icon: '▭' },
  { id: 'cutout', label: 'Bacha / Anafe', icon: '⊡' },
  { id: 'circle', label: 'Círculo (pileta redonda / grifería)', icon: '◯' },
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
  materials,
  pageMaterial,

  onSetTool,
  onSetSnap,
  onSetPageIdx,
  onAddPage,
  onRemovePage,
  onRenamePage,
  onSetPageMaterial,
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
        <div className={s['toolbar__title-right']}>
          {readOnly && pageMaterial && (
            <span className={s['toolbar__material-badge']}>{pageMaterial}</span>
          )}
          {snap && <span className={s['toolbar__snap-indicator']}>Imán activado</span>}
        </div>
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
          <select
            className={s['toolbar__material-select']}
            value={pageMaterial}
            onChange={(e) => onSetPageMaterial(e.target.value)}
            aria-label="Material de la página activa"
            title="Material de esta página (se imprime en la Ficha de Taller)"
          >
            <option value="">Material…</option>
            {materials.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
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