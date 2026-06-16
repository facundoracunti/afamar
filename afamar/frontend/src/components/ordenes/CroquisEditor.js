import React, { useRef, useState, useEffect, useCallback } from 'react';

const tools = [
  { id: 'select', label: 'Seleccionar', icon: '⊹' },
  { id: 'draw', label: 'Dibujar', icon: '✎' },
  { id: 'rect', label: 'Rectángulo', icon: '▭' },
  { id: 'circle', label: 'Círculo', icon: '○' },
  { id: 'bacha', label: 'Bacha', icon: '⬡' },
  { id: 'anafe', label: 'Anafe', icon: '⊞' },
  { id: 'hole', label: 'Agujero', icon: '⊗' },
  { id: 'text', label: 'Texto', icon: 'T' },
  { id: 'measure', label: 'Medida', icon: '📏' },
];

const zoomLevels = [50, 100, 150, 200];

export default function CroquisEditor({ croquis, onChange, readOnly = false }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [zoom, setZoom] = useState(100);
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState(null);
  const [addText, setAddText] = useState(false);
  const [textPos, setTextPos] = useState({ x: 100, y: 100 });
  const [textRotation, setTextRotation] = useState(0);

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, [zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = 800;
    const h = 500;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(zoom / 100, zoom / 100);
    drawGrid(ctx, w, h);
    if (croquis?.length) {
      for (const el of croquis) drawElement(ctx, el);
    }
  }, [zoom, croquis]);

  const drawGrid = (ctx, w, h) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  };

  const drawElement = (ctx, el) => {
    ctx.save();
    ctx.strokeStyle = el.color || '#1e40af';
    ctx.fillStyle = el.fill || 'transparent';
    ctx.lineWidth = el.lineWidth || 1.5;
    ctx.font = el.font || '14px Inter, sans-serif';
    switch (el.type) {
      case 'rect':
        ctx.fillRect(el.x, el.y, el.w, el.h);
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'line':
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        break;
      case 'path':
        if (el.points?.length > 1) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
          ctx.stroke();
        }
        break;
      case 'text':
        ctx.fillStyle = el.color || '#1e40af';
        if (el.rotation) {
          ctx.translate(el.x, el.y);
          ctx.rotate((el.rotation * Math.PI) / 180);
          ctx.fillText(el.text, 0, 0);
        } else {
          ctx.fillText(el.text, el.x, el.y);
        }
        break;
      case 'measure':
        ctx.beginPath();
        ctx.moveTo(el.x1, el.y1);
        ctx.lineTo(el.x2, el.y2);
        ctx.stroke();
        ctx.fillStyle = '#2563eb';
        ctx.font = '12px Inter, sans-serif';
        const mx = (el.x1 + el.x2) / 2;
        const my = (el.y1 + el.y2) / 2;
        ctx.fillText(el.label || '', mx + 5, my - 5);
        break;
      case 'bacha':
        ctx.beginPath();
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 2;
        ctx.rect(el.x, el.y, 80, 50);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x + 40, el.y + 25, 18, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'anafe':
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.strokeRect(el.x, el.y, 60, 60);
        ctx.beginPath();
        ctx.arc(el.x + 15, el.y + 15, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x + 45, el.y + 15, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x + 15, el.y + 45, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(el.x + 45, el.y + 45, 10, 0, Math.PI * 2);
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  };

  const pushHistory = (newElements) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push([...(croquis || []), ...newElements]);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    onChange(newHistory[newHistory.length - 1]);
  };

  const drawPoints = useRef([]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'text') {
      setTextPos(pos);
      setAddText(true);
      return;
    }
    if (tool === 'rect') {
      setDrawing(true);
      setStart(pos);
    } else if (tool === 'circle') {
      setDrawing(true);
      setStart(pos);
    } else if (tool === 'draw') {
      setDrawing(true);
      setStart(pos);
      drawPoints.current = [{ x: pos.x, y: pos.y }];
    } else if (tool === 'measure') {
      setDrawing(true);
      setStart(pos);
    } else if (tool === 'bacha') {
      pushHistory([{ type: 'bacha', x: pos.x, y: pos.y }]);
    } else if (tool === 'anafe') {
      pushHistory([{ type: 'anafe', x: pos.x, y: pos.y }]);
    } else if (tool === 'hole') {
      pushHistory([{ type: 'circle', x: pos.x, y: pos.y, r: 8, color: '#dc2626', fill: '#fee2e2' }]);
    }
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    if (!drawing || !start) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = 800;
    const h = 500;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(zoom / 100, zoom / 100);
    drawGrid(ctx, w, h);
    if (croquis?.length) for (const el of croquis) drawElement(ctx, el);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    if (tool === 'rect') {
      ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
    } else if (tool === 'circle') {
      const r = Math.sqrt((pos.x - start.x) ** 2 + (pos.y - start.y) ** 2);
      ctx.beginPath();
      ctx.arc(start.x, start.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === 'draw') {
      ctx.beginPath();
      const pts = drawPoints.current;
      if (pts.length > 1) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      drawPoints.current = [...pts, { x: pos.x, y: pos.y }];
    } else if (tool === 'measure') {
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const mx = (start.x + pos.x) / 2;
      const my = (start.y + pos.y) / 2;
      ctx.fillStyle = '#2563eb';
      ctx.font = '12px Inter, sans-serif';
      const dist = Math.round(Math.sqrt((pos.x - start.x) ** 2 + (pos.y - start.y) ** 2) * 2.5);
      ctx.fillText(`${dist} mm`, mx + 5, my - 5);
    }
    ctx.restore();
  };

  const handleMouseUp = (e) => {
    e.preventDefault();
    if (!drawing || !start) return;
    const pos = getPos(e);
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;
    let newEls = [];
    if (tool === 'rect' && Math.abs(dx) > 5 && Math.abs(dy) > 5) {
      newEls = [{ type: 'rect', x: Math.min(start.x, pos.x), y: Math.min(start.y, pos.y), w: Math.abs(dx), h: Math.abs(dy), color: '#1e40af' }];
    } else if (tool === 'circle') {
      const r = Math.sqrt(dx ** 2 + dy ** 2);
      if (r > 5) newEls = [{ type: 'circle', x: start.x, y: start.y, r, color: '#1e40af' }];
    } else if (tool === 'draw' && drawPoints.current.length > 1) {
      newEls = [{ type: 'path', points: drawPoints.current, color: '#1e40af' }];
    } else if (tool === 'measure') {
      const dist = Math.round(Math.sqrt(dx ** 2 + dy ** 2) * 2.5);
      const label = window.prompt('Medida:', `${dist} mm`);
      if (label) {
        newEls = [{ type: 'measure', x1: start.x, y1: start.y, x2: pos.x, y2: pos.y, label, color: '#2563eb' }];
      }
    }
    if (newEls.length) pushHistory(newEls);
    setDrawing(false);
    setStart(null);
    drawPoints.current = [];
  };

  const handleTextSubmit = (e) => {
    if (e.key === 'Enter' && e.target.value) {
      const scale = zoom / 100;
      pushHistory([{ type: 'text', x: textPos.x, y: textPos.y, text: e.target.value, color: '#1e40af', font: '14px Inter', rotation: textRotation }]);
      setAddText(false);
      setTextRotation(0);
      e.target.value = '';
    }
  };

  const undo = () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    onChange(history[newIdx]);
  };

  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    onChange(history[newIdx]);
  };

  const clearAll = () => {
    setHistory([]);
    setHistoryIdx(-1);
    onChange([]);
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 15, background: '#f8fafc' }}>
        DISEÑO / CROQUIS
      </div>
      <div style={{ display: 'flex' }}>
        {!readOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, borderRight: '1px solid #e5e7eb', background: '#f8fafc' }}>
          {tools.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: tool === t.id ? '2px solid #3b82f6' : '1px solid transparent',
                borderRadius: 6, background: tool === t.id ? '#dbeafe' : 'transparent',
                cursor: 'pointer', fontSize: 16, color: '#374151',
              }}
            >{t.icon}</button>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0', paddingTop: 4 }}>
            <button type="button" onClick={undo} disabled={historyIdx <= 0} title="Deshacer" style={{ width: 36, height: 36, border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 16, opacity: historyIdx <= 0 ? 0.3 : 1 }}>↩</button>
            <button type="button" onClick={redo} disabled={historyIdx >= history.length - 1} title="Rehacer" style={{ width: 36, height: 36, border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 16, opacity: historyIdx >= history.length - 1 ? 0.3 : 1 }}>↪</button>
          </div>
          <button type="button" onClick={clearAll} title="Limpiar Todo" style={{ width: 36, height: 36, border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#ef4444', background: '#fef2f2' }}>✕</button>
        </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: 800 * (zoom / 100), height: 500 * (zoom / 100), cursor: readOnly ? 'default' : (tool === 'select' ? 'default' : 'crosshair'), maxWidth: '100%' }}
            onMouseDown={readOnly ? undefined : handleMouseDown}
            onMouseMove={readOnly ? undefined : handleMouseMove}
            onMouseUp={readOnly ? undefined : handleMouseUp}
            onMouseLeave={readOnly ? undefined : handleMouseUp}
          />
          {!readOnly && addText && (
            <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', zIndex: 10 }}>
              <input
                autoFocus
                onKeyDown={handleTextSubmit}
                placeholder="Escribir texto..."
                style={{ padding: '6px 12px', border: '2px solid #3b82f6', borderRadius: 6, fontSize: 14, width: 160 }}
              />
              <select value={textRotation} onChange={(e) => setTextRotation(Number(e.target.value))}
                style={{ padding: '6px 8px', border: '2px solid #3b82f6', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
                <option value={45}>45°</option>
                <option value={-45}>-45°</option>
                <option value={-90}>-90°</option>
              </select>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '6px 14px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 6, background: '#f8fafc' }}>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>Zoom:</span>
        {zoomLevels.map((z) => (
          <button
            type="button"
            key={z}
            onClick={() => setZoom(z)}
            style={{
              padding: '2px 10px', fontSize: 12, borderRadius: 4,
              border: zoom === z ? '2px solid #3b82f6' : '1px solid #d1d5db',
              background: zoom === z ? '#dbeafe' : '#fff', cursor: 'pointer', fontWeight: zoom === z ? 600 : 400,
            }}
          >{z}%</button>
        ))}
      </div>
    </div>
  );
}
