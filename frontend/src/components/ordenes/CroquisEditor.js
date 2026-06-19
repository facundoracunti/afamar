import React, { useRef, useState, useEffect, useCallback } from 'react';

const tools = [
  { id: 'select', label: 'Seleccionar', icon: '⊹' },
  { id: 'draw', label: 'Dibujar', icon: '✎' },
  { id: 'line', label: 'Línea', icon: '╱' },
  { id: 'rect', label: 'Rectángulo', icon: '▭' },
  { id: 'circle', label: 'Círculo', icon: '○' },
  { id: 'bacha', label: 'Bacha', icon: '⬡' },
  { id: 'anafe', label: 'Anafe', icon: '⊞' },
  { id: 'hole', label: 'Agujero', icon: '⊗' },
  { id: 'text', label: 'Texto', icon: 'T' },
  { id: 'measure', label: 'Medida', icon: '📏' },
];

const zoomLevels = [50, 100, 150, 200];
const GRID_SIZE = 20;

function nextId() {
  return Date.now() + Math.random();
}

function snapToGrid(v) {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function isOldFormat(croquis) {
  if (!Array.isArray(croquis)) return false;
  if (croquis.length === 0) return true;
  return !croquis[0]?.pagina_id;
}

function normalizeToPages(croquis) {
  if (!Array.isArray(croquis)) return [{ id: 1, nombre: 'Página 1', elementos: [] }];
  if (isOldFormat(croquis)) {
    return [{ id: 1, nombre: 'Página 1', elementos: croquis }];
  }
  return croquis.map((p) => ({
    id: p.pagina_id || p.id,
    nombre: p.nombre || `Página ${p.pagina_id || p.id || 1}`,
    elementos: p.dibujo || p.elementos || [],
  }));
}

function buildHistoryMap(pages) {
  const map = {};
  pages.forEach((p) => { map[p.id] = []; });
  return map;
}

function buildHistoryIdxMap(pages) {
  const map = {};
  pages.forEach((p) => { map[p.id] = -1; });
  return map;
}

const btnStyle = {
  padding: '3px 10px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
  border: '1px solid #d1d5db', background: '#fff', color: '#374151',
  whiteSpace: 'nowrap', lineHeight: 1.5,
};

const btnActiveStyle = {
  ...btnStyle, background: '#b91c1c', color: '#fff', borderColor: '#b91c1c', fontWeight: 700,
};

const btnSuccessStyle = {
  ...btnStyle, background: '#16a34a', color: '#fff', borderColor: '#16a34a',
};

const ROT_HANDLE_RADIUS = 7;
const SELECTABLE_TYPES = new Set(['bacha', 'anafe', 'hole', 'text', 'rect', 'circle']);

function hitTest(pos, el) {
  if (!SELECTABLE_TYPES.has(el.type)) return false;
  if (el.type === 'text') {
    const tw = (el.text?.length || 1) * 8;
    const th = 20;
    return pos.x >= el.x && pos.x <= el.x + tw && pos.y >= el.y - 16 && pos.y <= el.y + 4;
  }
  if (el.type === 'circle' || el.type === 'hole') {
    const r = el.r || 12;
    const dx = pos.x - el.x;
    const dy = pos.y - el.y;
    return dx * dx + dy * dy <= r * r;
  }
  if (el.type === 'rect') {
    const w = el.w || 60;
    const h = el.h || 40;
    return pos.x >= el.x && pos.x <= el.x + w && pos.y >= el.y && pos.y <= el.y + h;
  }
  const w = el.ancho || 80;
  const h = el.alto || 50;
  return pos.x >= el.x && pos.x <= el.x + w && pos.y >= el.y && pos.y <= el.y + h;
}

function getRotHandlePos(el) {
  const dim = { w: el.ancho || el.w || 80, h: el.alto || el.h || 50 };
  return { x: el.x + dim.w / 2, y: el.y - 20 };
}

function hitRotHandle(pos, el) {
  if (!SELECTABLE_TYPES.has(el.type)) return false;
  const hp = getRotHandlePos(el);
  const dx = pos.x - hp.x;
  const dy = pos.y - hp.y;
  return dx * dx + dy * dy <= ROT_HANDLE_RADIUS * ROT_HANDLE_RADIUS;
}

const B_SIZE = { bacha: { ancho: 80, alto: 50 }, anafe: { ancho: 60, alto: 60 }, hole: { ancho: 24, alto: 24 } };

export default function CroquisEditor({ croquis, onChange, readOnly = false }) {
  const [initialized, setInitialized] = useState(false);
  const [paginas, setPaginas] = useState([]);
  const [paginaActivaId, setPaginaActivaId] = useState(null);
  const [historyMap, setHistoryMap] = useState({});
  const [historyIdxMap, setHistoryIdxMap] = useState({});
  const [editingNombre, setEditingNombre] = useState(null);
  const [nombreTemp, setNombreTemp] = useState('');

  const canvasRef = useRef(null);
  const [tool, setTool] = useState('select');
  const [zoom, setZoom] = useState(100);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState(null);

  const [selectedId, setSelectedId] = useState(null);
  const [interactionMode, setInteractionMode] = useState('idle');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [textInput, setTextInput] = useState(null);

  useEffect(() => {
    const pages = normalizeToPages(croquis);
    setPaginas(pages);
    setHistoryMap(buildHistoryMap(pages));
    setHistoryIdxMap(buildHistoryIdxMap(pages));
    if (paginaActivaId === null || !pages.find((p) => p.id === paginaActivaId)) {
      setPaginaActivaId(pages[0]?.id || 1);
    }
    setInitialized(true);
  }, [croquis]);

  const paginaActiva = paginas.find((p) => p.id === paginaActivaId) || paginas[0];
  const elementos = paginaActiva?.elementos || [];

  const updateElementos = useCallback((nuevos) => {
    if (!paginaActiva) return;
    const h = historyMap[paginaActivaId] || [];
    const hi = historyIdxMap[paginaActivaId] ?? -1;
    const newHistory = h.slice(0, hi + 1);
    newHistory.push([...(nuevos)]);
    const newHMap = { ...historyMap, [paginaActivaId]: newHistory };
    const newHiMap = { ...historyIdxMap, [paginaActivaId]: newHistory.length - 1 };
    const newPages = paginas.map((p) =>
      p.id === paginaActivaId ? { ...p, elementos: nuevos } : p
    );
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(newHMap);
    setHistoryIdxMap(newHiMap);
  }, [paginaActiva, paginaActivaId, historyMap, historyIdxMap, paginas, onChange]);

  const pushHistory = useCallback((newElements) => {
    if (!paginaActiva) return;
    const nuevos = [...(elementos || []), ...newElements];
    updateElementos(nuevos);
  }, [paginaActiva, elementos, updateElementos]);

  const agregarPagina = () => {
    const maxId = paginas.reduce((m, p) => Math.max(m, p.id), 0);
    const nuevaId = maxId + 1;
    const nueva = { id: nuevaId, nombre: `Página ${nuevaId}`, elementos: [] };
    const newPages = [...paginas, nueva];
    const newHMap = { ...historyMap, [nuevaId]: [] };
    const newHiMap = { ...historyIdxMap, [nuevaId]: -1 };
    setPaginaActivaId(nuevaId);
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(newHMap);
    setHistoryIdxMap(newHiMap);
  };

  const iniciarRenombrar = (id, nombre) => {
    setEditingNombre(id);
    setNombreTemp(nombre);
  };

  const confirmarRenombrar = (id) => {
    if (!nombreTemp.trim()) { setEditingNombre(null); return; }
    const newPages = paginas.map((p) => (p.id === id ? { ...p, nombre: nombreTemp.trim() } : p));
    setEditingNombre(null);
    updateElementos(paginaActiva?.elementos || []);
  };

  const eliminarPagina = (id) => {
    if (paginas.length <= 1) return;
    const newPages = paginas.filter((p) => p.id !== id);
    const newHMap = { ...historyMap };
    const newHiMap = { ...historyIdxMap };
    delete newHMap[id];
    delete newHiMap[id];
    if (paginaActivaId === id) {
      setPaginaActivaId(newPages[0].id);
    }
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(newHMap);
    setHistoryIdxMap(newHiMap);
  };

  const getPos = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, [zoom]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = 800;
    const h = 500;
    canvas.width = w;
    canvas.height = h;
    ctx.scale(zoom / 100, zoom / 100);
    drawGrid(ctx, w, h);
    if (elementos?.length) {
      for (const el of elementos) {
        drawElement(ctx, el);
      }
    }
    if (selectedId && !readOnly) {
      const sel = elementos.find((e) => e.id === selectedId);
      if (sel && SELECTABLE_TYPES.has(sel.type)) drawSelection(ctx, sel);
    }
  }, [zoom, elementos, selectedId, readOnly]);

  useEffect(() => { redraw(); }, [redraw]);

  const drawGrid = (ctx, w, h) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  };

  function getDim(el) {
    let w = el.ancho, h = el.alto;
    if (el.type === 'rect') { w = el.w; h = el.h; }
    if (el.type === 'circle' || el.type === 'hole') { const d = (el.r || 12) * 2; w = d; h = d; }
    if (el.type === 'text') { w = (el.text?.length || 1) * 8; h = 20; }
    return { w: w || 80, h: h || 50 };
  }

  const drawElement = (ctx, el) => {
    ctx.save();
    ctx.strokeStyle = el.color || '#1e40af';
    ctx.fillStyle = el.fill || 'transparent';
    ctx.lineWidth = el.lineWidth || 1.5;
    ctx.font = el.font || '14px Inter, sans-serif';

    const rot = el.rotacion || 0;
    const dim = getDim(el);
    const cx = el.x + dim.w / 2;
    const cy = el.y + dim.h / 2;

    if (rot && SELECTABLE_TYPES.has(el.type)) {
      ctx.translate(cx, cy);
      ctx.rotate(rot * (Math.PI / 180));
      ctx.translate(-cx, -cy);
    }

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
        ctx.fillText(el.text, el.x, el.y);
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
        ctx.beginPath(); ctx.arc(el.x + 15, el.y + 15, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(el.x + 45, el.y + 15, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(el.x + 15, el.y + 45, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(el.x + 45, el.y + 45, 10, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'hole':
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.r || 12, 0, Math.PI * 2);
        ctx.fillStyle = el.fill || '#fee2e2';
        ctx.fill();
        ctx.strokeStyle = el.color || '#dc2626';
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  };

  const drawSelection = (ctx, el) => {
    ctx.save();
    const dim = { w: el.ancho || el.w || 80, h: el.alto || el.h || 50 };
    const w = dim.w;
    const h = dim.h;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(el.x - 3, el.y - 3, w + 6, h + 6);
    ctx.setLineDash([]);

    const hp = getRotHandlePos(el);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, ROT_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(el.x + w / 2, el.y);
    ctx.lineTo(hp.x, hp.y + ROT_HANDLE_RADIUS);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.restore();
  };

  const drawPoints = useRef([]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'select') {
      const objetoActivo = elementos.find((f) => f.id === selectedId);

      if (objetoActivo) {
        const dim = { w: objetoActivo.ancho || objetoActivo.w || 80, h: objetoActivo.alto || objetoActivo.h || 50 };
        const centroX = objetoActivo.x + dim.w / 2;
        const nodoRotacionY = objetoActivo.y - 20;
        const distAlNodo = Math.sqrt((pos.x - centroX) ** 2 + (pos.y - nodoRotacionY) ** 2);

        if (distAlNodo < 10) {
          setInteractionMode('rotating');
          setStart(pos);
          return;
        }
      }

      const objetoTocado = [...elementos].reverse().find((e) => hitTest(pos, e));
      if (objetoTocado) {
        setSelectedId(objetoTocado.id);
        setInteractionMode('dragging');
        setDragOffset({ x: pos.x - objetoTocado.x, y: pos.y - objetoTocado.y });
        return;
      }

      setSelectedId(null);
      setInteractionMode('idle');
      return;
    }

    if (tool === 'text') {
      setTextInput({ x: pos.x, y: pos.y });
      return;
    }
    if (tool === 'line') {
      setDrawing(true);
      setStart({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
    } else if (tool === 'rect') {
      setDrawing(true);
      setStart(pos);
    } else if (tool === 'circle' || tool === 'hole') {
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
      const s = B_SIZE.bacha;
      pushHistory([{ id: nextId(), type: 'bacha', x: pos.x, y: pos.y, ancho: s.ancho, alto: s.alto, rotacion: 0, seleccionado: false }]);
    } else if (tool === 'anafe') {
      const s = B_SIZE.anafe;
      pushHistory([{ id: nextId(), type: 'anafe', x: pos.x, y: pos.y, ancho: s.ancho, alto: s.alto, rotacion: 0, seleccionado: false }]);
    }
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    const pos = getPos(e);

    if (tool === 'select' && interactionMode === 'dragging' && selectedId) {
      const nuevos = elementos.map((el) =>
        el.id === selectedId
          ? { ...el, x: pos.x - dragOffset.x, y: pos.y - dragOffset.y }
          : el
      );
      updateElementos(nuevos);
      return;
    }

    if (tool === 'select' && interactionMode === 'rotating' && selectedId && start) {
      const el = elementos.find((e) => e.id === selectedId);
      if (el) {
        const dim = { w: el.ancho || el.w || 80, h: el.alto || el.h || 50 };
        const cx = el.x + dim.w / 2;
        const cy = el.y + dim.h / 2;
        const dx = pos.x - cx;
        const dy = pos.y - cy;
        let deg = Math.atan2(dy, dx) * (180 / Math.PI);
        deg -= 90;
        const nuevos = elementos.map((e) =>
          e.id === selectedId ? { ...e, rotacion: deg } : e
        );
        updateElementos(nuevos);
      }
      return;
    }

    if (!drawing || !start) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = 800;
    const h = 500;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(zoom / 100, zoom / 100);
    drawGrid(ctx, w, h);
    if (elementos?.length) for (const el of elementos) drawElement(ctx, el);
    if (selectedId && !readOnly) {
      const sel = elementos.find((e) => e.id === selectedId);
      if (sel && SELECTABLE_TYPES.has(sel.type)) drawSelection(ctx, sel);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    if (tool === 'line') {
      const sx = snapToGrid(pos.x);
      const sy = snapToGrid(pos.y);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    } else if (tool === 'rect') {
      ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
    } else if (tool === 'circle' || tool === 'hole') {
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

    if (tool === 'select' && (interactionMode === 'dragging' || interactionMode === 'rotating')) {
      setInteractionMode('idle');
      setStart(null);
      return;
    }

    if (!drawing || !start) return;
    const pos = getPos(e);
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;
    let newEls = [];
    if (tool === 'line' && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      newEls = [{ type: 'line', x1: start.x, y1: start.y, x2: snapToGrid(pos.x), y2: snapToGrid(pos.y), color: '#1e40af' }];
    } else if (tool === 'rect' && Math.abs(dx) > 5 && Math.abs(dy) > 5) {
      newEls = [{ id: nextId(), type: 'rect', x: Math.min(start.x, pos.x), y: Math.min(start.y, pos.y), w: Math.abs(dx), h: Math.abs(dy), ancho: Math.abs(dx), alto: Math.abs(dy), rotacion: 0, seleccionado: false, color: '#1e40af' }];
    } else if (tool === 'circle') {
      const r = Math.sqrt(dx ** 2 + dy ** 2);
      if (r > 5) newEls = [{ id: nextId(), type: 'circle', x: start.x, y: start.y, r, ancho: r * 2, alto: r * 2, rotacion: 0, seleccionado: false, color: '#1e40af' }];
    } else if (tool === 'hole') {
      const r = Math.sqrt(dx ** 2 + dy ** 2);
      if (r > 5) newEls = [{ id: nextId(), type: 'hole', x: start.x, y: start.y, r: r > 20 ? r : 12, ancho: (r > 20 ? r : 12) * 2, alto: (r > 20 ? r : 12) * 2, rotacion: 0, seleccionado: false, color: '#dc2626', fill: '#fee2e2' }];
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

  const handleTextSubmit = (value) => {
    if (value && textInput) {
      pushHistory([{ id: nextId(), type: 'text', x: textInput.x, y: textInput.y, text: value, color: '#1e40af', font: '14px Inter', rotacion: 0, seleccionado: false }]);
    }
    setTextInput(null);
  };

  const colors = ['#1e40af', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

  const undo = () => {
    const hi = historyIdxMap[paginaActivaId] ?? -1;
    if (hi <= 0) return;
    const newIdx = hi - 1;
    const h = historyMap[paginaActivaId] || [];
    const newHiMap = { ...historyIdxMap, [paginaActivaId]: newIdx };
    setHistoryIdxMap(newHiMap);
    const nuevos = h[newIdx] || [];
    const newPages = paginas.map((p) =>
      p.id === paginaActivaId ? { ...p, elementos: nuevos } : p
    );
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(historyMap);
  };

  const redo = () => {
    const hi = historyIdxMap[paginaActivaId] ?? -1;
    const h = historyMap[paginaActivaId] || [];
    if (hi >= h.length - 1) return;
    const newIdx = hi + 1;
    const newHiMap = { ...historyIdxMap, [paginaActivaId]: newIdx };
    setHistoryIdxMap(newHiMap);
    const nuevos = h[newIdx] || [];
    const newPages = paginas.map((p) =>
      p.id === paginaActivaId ? { ...p, elementos: nuevos } : p
    );
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(historyMap);
  };

  const clearAll = () => {
    const newHMap = { ...historyMap, [paginaActivaId]: [] };
    const newHiMap = { ...historyIdxMap, [paginaActivaId]: -1 };
    setHistoryIdxMap(newHiMap);
    const newPages = paginas.map((p) =>
      p.id === paginaActivaId ? { ...p, elementos: [] } : p
    );
    const payload = newPages.map((p) => ({
      pagina_id: p.id, nombre: p.nombre, dibujo: p.elementos,
    }));
    onChange(payload);
    setPaginas(newPages);
    setHistoryMap(newHMap);
    setSelectedId(null);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const nuevos = elementos.filter((e) => e.id !== selectedId);
    setSelectedId(null);
    updateElementos(nuevos);
  };

  if (!initialized) return null;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #e5e7eb',
        fontWeight: 700, fontSize: 15, background: '#f8fafc',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>DISEÑO / CROQUIS MULTI-PÁGINA</span>
        {!readOnly && paginas.length > 1 && (
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 400 }}>
            {paginas.length} páginas
          </span>
        )}
      </div>

      {!readOnly && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
          borderBottom: '1px solid #e5e7eb', overflowX: 'auto', background: '#fafafa',
        }}>
          {paginas.map((pag) => (
            <div key={pag.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {editingNombre === pag.id ? (
                <input autoFocus value={nombreTemp} onChange={(e) => setNombreTemp(e.target.value)}
                  onBlur={() => confirmarRenombrar(pag.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmarRenombrar(pag.id); if (e.key === 'Escape') setEditingNombre(null); }}
                  style={{ width: 110, padding: '2px 6px', fontSize: 12, borderRadius: 4, border: '1px solid #3b82f6', outline: 'none' }} />
              ) : (
                <button type="button" onClick={() => setPaginaActivaId(pag.id)}
                  onDoubleClick={() => iniciarRenombrar(pag.id, pag.nombre)}
                  style={paginaActivaId === pag.id ? btnActiveStyle : btnStyle}>
                  {pag.nombre}
                </button>
              )}
              {paginas.length > 1 && editingNombre !== pag.id && (
                <button type="button" onClick={() => eliminarPagina(pag.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14, padding: '0 2px', lineHeight: 1 }} title="Eliminar página">×</button>
              )}
            </div>
          ))}
          <button type="button" onClick={agregarPagina} style={btnSuccessStyle}>+ Agregar Página</button>
        </div>
      )}

      {!readOnly && paginaActiva && (
        <div style={{ padding: '2px 10px', fontSize: 11, color: '#6b7280', background: '#fefce8', borderBottom: '1px solid #e5e7eb' }}>
          Dibujando en: <strong>{paginaActiva.nombre}</strong>
          {selectedId && (
            <span style={{ marginLeft: 12 }}>
              <button type="button" onClick={deleteSelected}
                style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: '#dc2626', padding: '1px 8px' }}>
                Eliminar seleccionado
              </button>
            </span>
          )}
          {paginas.length > 1 && (
            <span style={{ marginLeft: 8, fontSize: 10, color: '#9ca3af' }}>(doble clic en pestaña para renombrar)</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex' }}>
        {!readOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, borderRight: '1px solid #e5e7eb', background: '#f8fafc' }}>
          {tools.map((t) => (
            <button type="button" key={t.id} onClick={() => setTool(t.id)} title={t.label}
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: tool === t.id ? '2px solid #3b82f6' : '1px solid transparent',
                borderRadius: 6, background: tool === t.id ? '#dbeafe' : 'transparent',
                cursor: 'pointer', fontSize: 16, color: '#374151',
              }}>{t.icon}</button>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0', paddingTop: 4 }}>
            <button type="button" onClick={undo} disabled={(historyIdxMap[paginaActivaId] ?? -1) <= 0} title="Deshacer" style={{ width: 36, height: 36, border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 16, opacity: (historyIdxMap[paginaActivaId] ?? -1) <= 0 ? 0.3 : 1 }}>↩</button>
            <button type="button" onClick={redo} disabled={(historyIdxMap[paginaActivaId] ?? -1) >= (historyMap[paginaActivaId]?.length || 1) - 1} title="Rehacer" style={{ width: 36, height: 36, border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', fontSize: 16, opacity: (historyIdxMap[paginaActivaId] ?? -1) >= (historyMap[paginaActivaId]?.length || 1) - 1 ? 0.3 : 1 }}>↪</button>
          </div>
          <button type="button" onClick={clearAll} title="Limpiar Todo" style={{ width: 36, height: 36, border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#ef4444', background: '#fef2f2' }}>✕</button>
        </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: 800 * (zoom / 100), height: 500 * (zoom / 100), cursor: readOnly ? 'default' : 'crosshair', maxWidth: '100%' }}
            onMouseDown={readOnly ? undefined : handleMouseDown}
            onMouseMove={readOnly ? undefined : handleMouseMove}
            onMouseUp={readOnly ? undefined : handleMouseUp}
            onMouseLeave={readOnly ? undefined : handleMouseUp}
          />
          {!readOnly && textInput && (
            <div style={{
              position: 'absolute', top: textInput.y * (zoom / 100) - 20, left: textInput.x * (zoom / 100),
              zIndex: 10, display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <input autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTextSubmit(e.target.value);
                  if (e.key === 'Escape') setTextInput(null);
                }}
                onBlur={(e) => handleTextSubmit(e.target.value)}
                placeholder="Texto..."
                style={{ padding: '4px 8px', border: '2px solid #3b82f6', borderRadius: 6, fontSize: 13, width: 130 }}
              />
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '6px 14px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 6, background: '#f8fafc' }}>
        <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>Zoom:</span>
        {zoomLevels.map((z) => (
          <button type="button" key={z} onClick={() => setZoom(z)}
            style={{
              padding: '2px 10px', fontSize: 12, borderRadius: 4,
              border: zoom === z ? '2px solid #3b82f6' : '1px solid #d1d5db',
              background: zoom === z ? '#dbeafe' : '#fff', cursor: 'pointer', fontWeight: zoom === z ? 600 : 400,
            }}>{z}%</button>
        ))}
      </div>
    </div>
  );
}
