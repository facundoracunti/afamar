import { useEffect, useRef } from 'react';
import { useCroquisState } from '../hooks/useSketchState';
import Toolbar from '../Toolbar/Toolbar';
import CanvasArea from '../CanvasArea/CanvasArea';
import type { SketchEditorProps, SketchToolType } from '../../../types/sketch';

const TOOLS: { id: SketchToolType; label: string }[] = [
  { id: 'select', label: 'Seleccionar' },
  { id: 'line', label: 'Línea' },
  { id: 'rect', label: 'Rectángulo Mesada' },
  { id: 'cutout', label: 'Bacha / Anafe' },
  { id: 'text', label: 'Texto' },
];

export default function SketchEditor({ sketch, onChange, readOnly = false }: SketchEditorProps) {
  const s = useCroquisState(sketch, onChange, readOnly);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    if (readOnly) return;
    const fn = (e: KeyboardEvent) => {
      const st = sRef.current;
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) { e.preventDefault(); st.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && ((isZ && e.shiftKey) || isY)) { e.preventDefault(); st.redo(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && st.tool === 'select' && st.sid) { e.preventDefault(); st.deleteShape(st.sid); return; }
      if (e.key === 'Escape') { st.setIsDrawing(false); st.setDrawStart(null); st.setDrawEnd(null); st.setSid(null); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [readOnly]);

  if (!s.ready) return null;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <Toolbar
        pages={s.pages}
        pageIdx={s.pageIdx}
        tool={s.tool}
        snap={s.snap}
        sid={s.sid}
        readOnly={readOnly}
        canUndo={s.canUndo}
        canRedo={s.canRedo}
        currentShapes={s.currentShapes}
        onSetTool={s.setTool}
        onSetSnap={() => s.setSnap(!s.snap)}
        onSetPageIdx={s.setPageIdx}
        onAddPage={s.addPage}
        onRemovePage={s.removePage}
        onRenamePage={s.renamePage}
        onUndo={s.undo}
        onRedo={s.redo}
        onDeleteSelected={() => s.sid && s.deleteShape(s.sid)}
        onDeleteLast={s.deleteLast}
        onClearAll={s.clearAll}
      />

      <CanvasArea
        tool={s.tool}
        snap={s.snap}
        sid={s.sid}
        isDrawing={s.isDrawing}
        drawStart={s.drawStart}
        drawEnd={s.drawEnd}
        currentShapes={s.currentShapes}
        readOnly={readOnly}
        shiftRef={s.shiftRef}
        pageIdx={s.pageIdx}
        pages={s.pages}
        setSid={s.setSid}
        setIsDrawing={s.setIsDrawing}
        setDrawStart={s.setDrawStart}
        setDrawEnd={s.setDrawEnd}
        addShape={s.addShape}
        updateElementPosition={s.updateElementPosition}
        updateElementTransform={s.updateElementTransform}
        snapCoord={s.snapCoord}
        snapNear={s.snapNear}
      />

      <div
        style={{
          padding: '4px 14px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: '#6b7280',
          background: '#f8fafc',
        }}
      >
        <span>
          <strong>{TOOLS.find((t) => t.id === s.tool)?.label || s.tool}</strong>
          {s.isDrawing && ' — dibujando...'} · Página activa: <strong>{s.pages[s.pageIdx]?.name || '-'}</strong>
        </span>
        <span>Grilla: 20px {s.snap ? '| Imán ON' : '| Imán OFF'}</span>
      </div>
    </div>
  );
}