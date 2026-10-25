import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type Konva from 'konva';
import { useCanvasHandlers } from './CanvasArea.handlers';
import { logicalPointerPosition } from './CanvasArea.geometry';
import type { SketchToolType } from '@/types/sketch';

function makeStage(x = 0, y = 0, scale = 1) {
  const container = document.createElement('div');
  const stage = {
    getRelativePointerPosition: () => ({ x, y }),
    getStage: () => stage,
    container: () => container,
    setPointerCapture: vi.fn(),
  } as unknown as Konva.Stage;
  Object.defineProperty(container, 'setPointerCapture', { value: vi.fn() });
  Object.defineProperty(container, 'releasePointerCapture', { value: vi.fn() });
  Object.defineProperty(container, 'hasPointerCapture', { value: vi.fn(() => true) });
  return { stage, container, scale };
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
  const stage = makeStage(120, 80).stage;
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
  return { ...result, addShape, setSid, setIsDrawing, setDrawStart, setDrawEnd, stage };
}

describe('CanvasArea pointer events', () => {
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

  it('keeps the gesture finalizable outside the canvas through pointer capture', () => {
    const handlers = renderHandlers({
      isDrawing: true,
      drawStart: { x: 120, y: 80 },
      drawEnd: { x: 180, y: 140 },
    });
    const down = event(handlers.stage, 3, 'pen');
    act(() => handlers.result.current.handlePointerDown(down));
    expect(handlers.stage.container().setPointerCapture).toHaveBeenCalledWith(3);
    act(() => handlers.result.current.handlePointerUp(event(handlers.stage, 3, 'pen')));
    expect(handlers.addShape).toHaveBeenCalledOnce();
  });

  it('does not mutate in readOnly mode', () => {
    const handlers = renderHandlers({ readOnly: true });
    act(() => handlers.result.current.handlePointerDown(event(handlers.stage, 1, 'pen')));
    expect(handlers.setIsDrawing).not.toHaveBeenCalled();
    expect(handlers.addShape).not.toHaveBeenCalled();
  });
});
