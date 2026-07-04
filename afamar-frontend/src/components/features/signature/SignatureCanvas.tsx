import React, { useRef, useState, useEffect } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import styles from './SignatureCanvas.module.css';

const s = styles as unknown as Record<string, string>;

interface SignatureCanvasProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
  readOnly?: boolean;
}

/**
 * Signature pad.
 *
 * Adapts its background and ink color to the active theme so the canvas
 * blends with the surrounding card instead of looking like a bright
 * "white paper" pinned onto a dark surface.
 */
export default function SignatureCanvas({ value, onChange, label = 'Firma', height = 120, readOnly = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<boolean>(false);
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const canvasBg = isDark ? '#0f172a' : '#ffffff';
  const baselineColor = isDark ? '#475569' : '#d1d5db';
  const labelColor = isDark ? '#94a3b8' : '#9ca3af';
  const inkColor = isDark ? '#f1f5f9' : '#1e293b';

  const drawBase = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = baselineColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 20);
    ctx.lineTo(canvas.width - 20, canvas.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = labelColor;
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(label, 20, canvas.height - 30);
  };

  // Paint base layer whenever the theme changes.
  useEffect(() => {
    drawBase();
  }, [theme, label]);

  // Re-paint the existing signature on top whenever theme changes so the
  // ink color matches. If no value is stored yet, leave the base layer.
  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    drawBase();
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = value;
  }, [theme, value, label]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawing) return;
    setDrawing(false);
    const dataUrl = canvasRef.current!.toDataURL();
    onChange(dataUrl);
  };

  const clear = () => {
    drawBase();
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className={`${s['signatureCanvas']}${readOnly ? ' ' + s['signatureCanvas--readonly'] : ''}`}
        style={{ height }}
        onMouseDown={readOnly ? undefined : startDraw}
        onMouseMove={readOnly ? undefined : draw}
        onMouseUp={readOnly ? undefined : endDraw}
        onMouseLeave={readOnly ? undefined : endDraw}
      />
      {!readOnly && (
      <button type="button" className="btn btn-outline" onClick={clear}>
        Borrar firma
      </button>
      )}
    </div>
  );
}