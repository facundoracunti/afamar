import React, { useRef, useState, useEffect } from 'react';

interface FirmaCanvasProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
  readOnly?: boolean;
}

export default function FirmaCanvas({ value, onChange, label = 'Firma', height = 120, readOnly = false }: FirmaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 20);
    ctx.lineTo(canvas.width - 20, canvas.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(label, 20, canvas.height - 30);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
    }
  }, [value, label]);

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
    ctx.strokeStyle = '#1e293b';
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
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 20);
    ctx.lineTo(canvas.width - 20, canvas.height - 20);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(label, 20, canvas.height - 30);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        style={{ width: '100%', height, border: '1px solid #e5e7eb', borderRadius: 8, cursor: readOnly ? 'default' : 'crosshair' } as React.CSSProperties}
        onMouseDown={readOnly ? undefined : startDraw}
        onMouseMove={readOnly ? undefined : draw}
        onMouseUp={readOnly ? undefined : endDraw}
        onMouseLeave={readOnly ? undefined : endDraw}
      />
      {!readOnly && (
      <button type="button" className="btn btn-outline" onClick={clear} style={{ marginTop: 6, fontSize: 12, padding: '4px 12px' } as React.CSSProperties}>
        Borrar firma
      </button>
      )}
    </div>
  );
}
