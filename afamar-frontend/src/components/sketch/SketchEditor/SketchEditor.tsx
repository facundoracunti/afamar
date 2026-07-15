import { useEffect, useRef } from 'react';
import { useSketchState } from '../hooks/useSketchState';
import Toolbar from '../Toolbar/Toolbar';
import CanvasArea from '../CanvasArea/CanvasArea';
import type { SketchEditorProps, SketchToolType } from '../../../types/sketch';
import styles from './SketchEditor.module.css';

const s = styles as unknown as Record<string, string>;

const TOOLS: { id: SketchToolType; label: string }[] = [
  { id: 'select', label: 'Seleccionar' },
  { id: 'line', label: 'Línea' },
  { id: 'rect', label: 'Rectángulo Mesada' },
  { id: 'cutout', label: 'Bacha / Anafe' },
  { id: 'text', label: 'Texto' },
];

export default function SketchEditor({ sketch, onChange, readOnly = false }: SketchEditorProps) {
  const st = useSketchState(sketch, onChange, readOnly);
  const sRef = useRef(st);
  sRef.current = st;

  useEffect(() => {
    if (readOnly) return;
    const fn = (e: KeyboardEvent) => {
      const cur = sRef.current;
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) { e.preventDefault(); cur.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && ((isZ && e.shiftKey) || isY)) { e.preventDefault(); cur.redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && cur.tool === 'select' && cur.sid) { e.preventDefault(); cur.deleteShape(cur.sid); return; }
      if (e.key === 'Escape') { cur.setIsDrawing(false); cur.setDrawStart(null); cur.setDrawEnd(null); cur.setSid(null); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [readOnly]);

  if (!st.ready) return null;

  return (
    <div className={s['sketch-editor']}>
      <Toolbar
        pages={st.pages}
        pageIdx={st.pageIdx}
        tool={st.tool}
        snap={st.snap}
        sid={st.sid}
        readOnly={readOnly}
        canUndo={st.canUndo}
        canRedo={st.canRedo}
        currentShapes={st.currentShapes}
        onSetTool={st.setTool}
        onSetSnap={() => st.setSnap(!st.snap)}
        onSetPageIdx={st.setPageIdx}
        onAddPage={st.addPage}
        onRemovePage={st.removePage}
        onRenamePage={st.renamePage}
        onUndo={st.undo}
        onRedo={st.redo}
        onDeleteSelected={() => st.sid && st.deleteShape(st.sid)}
        onDeleteLast={st.deleteLast}
        onClearAll={st.clearAll}
      />

      <CanvasArea
        tool={st.tool}
        snap={st.snap}
        sid={st.sid}
        isDrawing={st.isDrawing}
        drawStart={st.drawStart}
        drawEnd={st.drawEnd}
        currentShapes={st.currentShapes}
        readOnly={readOnly}
        shiftRef={st.shiftRef}
        pageIdx={st.pageIdx}
        pages={st.pages}
        setSid={st.setSid}
        setIsDrawing={st.setIsDrawing}
        setDrawStart={st.setDrawStart}
        setDrawEnd={st.setDrawEnd}
        addShape={st.addShape}
        updateElementPosition={st.updateElementPosition}
        updateElementTransform={st.updateElementTransform}
        snapCoord={st.snapCoord}
        snapNear={st.snapNear}
      />

      <div className={s['sketch-editor__footer']}>
        <span>
          <strong>{TOOLS.find((t) => t.id === st.tool)?.label || st.tool}</strong>
          {st.isDrawing && ' — dibujando...'} · Página activa: <strong>{st.pages[st.pageIdx]?.name || '-'}</strong>
        </span>
        <span>Grilla: 20px {st.snap ? '| Imán ON' : '| Imán OFF'}</span>
      </div>
    </div>
  );
}
