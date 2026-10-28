import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type Konva from 'konva';
import { useState } from 'react';
import { useCanvasHandlers } from './CanvasArea.handlers';
import { logicalPointerPosition } from './CanvasArea.geometry';
import type { SketchToolType } from '@/types/sketch';

function makeStage(x = 0, y = 0, scale = 1) {
  const container = document.createElement('div');
  const content = document.createElement('div');
  const stage = {
    getRelativePointerPosition: vi.fn(() => ({ x, y })),
    getStage: () => stage,
    container: () => container,
    getContent: () => content,
    setPointerCapture: vi.fn(),
  } as unknown as Konva.Stage;
  Object.defineProperty(container, 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(container, 'releasePointerCapture', { value: vi.fn() });
  Object.defineProperty(container, 'hasPointerCapture', { value: vi.fn(() => true) });
  Object.defineProperty(content, 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(content, 'releasePointerCapture', { value: vi.fn() });
  Object.defineProperty(content, 'hasPointerCapture', { value: vi.fn(() => true) });
  return { stage, container, content, scale };
}

function event(stage: Konva.Stage, pointerId: number, pointerType: string) {
  return {
    evt: { pointerId, pointerType, clientX: 100, clientY: 100 },
    target: { getStage: () => stage },
  } as unknown as Konva.KonvaEventObject<PointerEvent>;
}

function renderHandlers(overrides: Partial<Parameters<typeof useCanvasHandlers>[0]> = {}) {
  const addShape = vi.fn();
  const setSid = vi.fn();
  const setIsDrawing = vi.fn();
  const setDrawStart = vi.fn();
  const setDrawEnd = vi.fn();
  const stageFixture = makeStage(120, 80);
  const stage = stageFixture.stage;
  const result = renderHook(() => useCanvasHandlers({
    tool: 'rect',
    snap: false,
    readOnly: false,
    isDrawing: false,
    drawStart: null,
    drawEnd: null,
    currentShapes: [],
    shiftRef: { current: false },
    setSid,
    setIsDrawing,
    setDrawStart,
    setDrawEnd,
    addShape,
    updateElementPosition: vi.fn(),
    updateElementTransform: vi.fn(),
    snapCoord: (v) => v,
    snapNear: (v) => v,
    ...overrides,
  }));
  return { ...result, addShape, setSid, setIsDrawing, setDrawStart, setDrawEnd, ...stageFixture, stage };
}

function renderStatefulHandlers() {
  const stageFixture = makeStage(120, 80);
  const result = renderHook(({ revision }) => {
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
    const [shapes, setShapes] = useState<unknown[]>([]);
    const handlers = useCanvasHandlers({
      tool: 'rect',
      snap: false,
      readOnly: false,
      isDrawing,
      drawStart,
      drawEnd,
      currentShapes: [],
      shiftRef: { current: false },
      setSid: vi.fn(),
      setIsDrawing,
      setDrawStart,
      setDrawEnd,
      addShape: (shape) => setShapes((current) => [...current, shape]),
      updateElementPosition: vi.fn(),
      updateElementTransform: vi.fn(),
      snapCoord: (v) => v,
      snapNear: (v) => v,
    });
    return { ...handlers, isDrawing, drawStart, drawEnd, shapes, revision };
  }, { initialProps: { revision: 0 } });
  return { ...result, ...stageFixture };
}

describe('CanvasArea pointer events', () => {
  it('runs the real pointerDown -> pointerMove -> pointerUp drawing sequence', () => {
    const handlers = renderStatefulHandlers();

    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 1, 'mouse')));
    expect(handlers.result.current.isDrawing).toBe(true);
    expect(handlers.result.current.drawStart).toEqual({ x: 120, y: 80 });

    vi.mocked(handlers.stage.getRelativePointerPosition).mockReturnValue({ x: 180, y: 140 });
    act(() => handlers.result.current.handlePointerMove(event(handlers.stage, 1, 'mouse')));
    expect(handlers.result.current.drawEnd).toEqual({ x: 180, y: 140 });

    act(() => handlers.result.current.handlePointerUp(event(handlers.stage, 1, 'mouse')));
    expect(handlers.result.current.shapes).toHaveLength(1);
    expect(handlers.result.current.isDrawing).toBe(false);
  });

  it('keeps drawing state through an unrelated render and cancels it correctly', () => {
    const handlers = renderStatefulHandlers();
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 4, 'touch')));
    handlers.rerender({ revision: 1 });
    expect(handlers.result.current.isDrawing).toBe(true);
    expect(handlers.result.current.drawStart).toEqual({ x: 120, y: 80 });

    act(() => handlers.result.current.handlePointerCancel(event(handlers.stage, 4, 'touch')));
    expect(handlers.result.current.isDrawing).toBe(false);
    expect(handlers.result.current.drawStart).toBeNull();
    expect(handlers.result.current.drawEnd).toBeNull();
  });

  it.each(['mouse', 'touch', 'pen'])('starts and completes a %s drawing gesture', (pointerType) => {
    const handlers = renderHandlers({
      isDrawing: true,
      drawStart: { x: 120, y: 80 },
      drawEnd: { x: 180, y: 140 },
    });
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 1, pointerType)));
    act(() => handlers.result.current.handlePointerUp(event(handlers.stage, 1, pointerType)));
    expect(handlers.addShape).toHaveBeenCalledOnce();
  });

  it.each([
    [1, { x: 300, y: 200 }],
    [0.75, { x: 400, y: 266.6666666666667 }],
    [0.5, { x: 600, y: 400 }],
  ])('uses Konva inverse transforms for logical coordinates at scale %s', (_scale, logical) => {
    const stage = makeStage(logical.x, logical.y, _scale).stage;
    expect(logicalPointerPosition(stage)).toEqual(logical);
  });

  it('cancels without saving an incomplete shape', () => {
    const handlers = renderHandlers({
      isDrawing: true,
      drawStart: { x: 120, y: 80 },
      drawEnd: { x: 180, y: 140 },
    });
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 7, 'touch')));
    act(() => handlers.result.current.handlePointerCancel(event(handlers.stage, 7, 'touch')));
    expect(handlers.addShape).not.toHaveBeenCalled();
    expect((handlers.stage.getContent() as HTMLDivElement).releasePointerCapture).toHaveBeenCalledWith(7);
    expect(handlers.setIsDrawing).toHaveBeenCalledWith(false);
    expect(handlers.setDrawStart).toHaveBeenCalledWith(null);
    expect(handlers.setDrawEnd).toHaveBeenCalledWith(null);
  });

  it('ignores a second pointer while the first gesture is active', () => {
    const handlers = renderHandlers();
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 1, 'touch')));
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 2, 'touch')));
    expect(handlers.setIsDrawing).toHaveBeenCalledTimes(1);
  });

  it.each(['mouse', 'touch', 'pen'])('deselects only when a %s pointer clicks the empty stage', (pointerType) => {
    const handlers = renderHandlers({ tool: 'select' });
    const emptyStageEvent = {
      evt: { pointerId: 1, pointerType },
      target: handlers.stage,
    } as unknown as Konva.KonvaEventObject<PointerEvent>;
    act(() => handlers.result.current.handleStageClick(emptyStageEvent));
    expect(handlers.setSid).toHaveBeenCalledOnce();
    expect(handlers.setSid).toHaveBeenCalledWith(null);

    const shapeEvent = event(handlers.stage, 2, pointerType);
    act(() => handlers.result.current.handleStageClick(shapeEvent));
    expect(handlers.setSid).toHaveBeenCalledOnce();
  });

  it('does not let a changed tool leave the previous pointer active', () => {
    const stage = makeStage().stage;
    const setIsDrawing = vi.fn();
    const base = {
      tool: 'rect' as SketchToolType,
      snap: false,
      readOnly: false,
      isDrawing: true,
      drawStart: null,
      drawEnd: null,
      currentShapes: [],
      shiftRef: { current: false },
      setSid: vi.fn(),
      setIsDrawing,
      setDrawStart: vi.fn(),
      setDrawEnd: vi.fn(),
      addShape: vi.fn(),
      updateElementPosition: vi.fn(),
      updateElementTransform: vi.fn(),
      snapCoord: (v: number) => v,
      snapNear: (v: number) => v,
    };
    const { result, rerender } = renderHook(
      ({ tool }) => useCanvasHandlers({ ...base, tool }),
      { initialProps: { tool: 'rect' as SketchToolType } },
    );
    act(() => result.current.handlePointerDown(event(stage, 1, 'touch')));
    rerender({ tool: 'select' });
    expect(setIsDrawing).toHaveBeenCalledWith(false);
    rerender({ tool: 'rect' });
    act(() => result.current.handlePointerDown(event(stage, 2, 'touch')));
    expect(setIsDrawing).toHaveBeenCalledTimes(3);
  });

  it('captures and releases the pointer on Konva content, not the outer container', () => {
    const handlers = renderHandlers({
      isDrawing: true,
      drawStart: { x: 120, y: 80 },
      drawEnd: { x: 180, y: 140 },
    });
    const down = event(handlers.stage, 3, 'pen');
    act(() => handlers.result.current.handlePointerDown(down));
    expect(handlers.container.setPointerCapture).not.toHaveBeenCalled();
    expect((handlers.stage.getContent() as HTMLDivElement).setPointerCapture).toHaveBeenCalledWith(3);
    act(() => handlers.result.current.handlePointerUp(event(handlers.stage, 3, 'pen')));
    expect((handlers.stage.getContent() as HTMLDivElement).releasePointerCapture).toHaveBeenCalledWith(3);
    expect(handlers.addShape).toHaveBeenCalledOnce();
  });

  it('does not mutate in readOnly mode', () => {
    const handlers = renderHandlers({ readOnly: true });
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 1, 'pen')));
    expect(handlers.setIsDrawing).not.toHaveBeenCalled();
    expect(handlers.addShape).not.toHaveBeenCalled();
  });
});
