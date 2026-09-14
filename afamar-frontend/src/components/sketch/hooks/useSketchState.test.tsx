/**
 * Tests for the `useSketchState` hook.
 *
 * Regression for the toolbar material select: picking a material on a page
 * must NOT re-init the editor (jump back to page 0 / lose undo history).
 * The root cause was the re-init guard comparing `prev` (raw state, keys in
 * editor order) with `pp` (re-normalised wire with defaults like `x/y`,
 * `rotation` filled in) via `JSON.stringify` â€” byte-different even for a
 * faithful round-trip, so EVERY material pick triggered a re-init.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSketchState } from './useSketchState';
import type { SketchLine } from '../../../types/sketch';

// The hook receives `sketch` in WIRE shape (`pagina_id`/`dibujo`), i.e. the
// result of `unflattenSketchElements`, not the editor's internal page shape.
function makeWireSketch(): unknown[] {
  return [
    { pagina_id: 1, name: 'barra', dibujo: [{ type: 'rect', x: 0, y: 0, width: 100, height: 40 }] },
    { pagina_id: 2, name: 'baÃ±o', dibujo: [{ type: 'line', points: [0, 0, 80, 80] }] },
  ];
}

describe('useSketchState', () => {
  it('setPageMaterial keeps the active page AND the chosen material (no re-init)', () => {
    const onChange = vi.fn();
    const initial = makeWireSketch();

    const { result, rerender } = renderHook(
      ({ sketch }) => useSketchState(sketch, onChange, false),
      { initialProps: { sketch: initial as unknown } },
    );

    // Move to page 2 ("baÃ±o"), then fill in the material â€” this is what the
    // toolbar `<select>` does on change.
    act(() => result.current.setPageIdx(1));
    act(() => result.current.setPageMaterial(2, 'ROSA DE SALTO'));

    // Simulate the parent form round-trip: `onChange` feeds savePayload()
    // back into `sketch`, exactly like EntityFormLayout â†’ update('sketch_elements').
    const wire = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    act(() => rerender({ sketch: wire }));

    // Material on page 2 persisted AND pageIdx survived the prop round-trip.
    expect(result.current.pages[1].material).toBe('ROSA DE SALTO');
    expect(result.current.pageIdx).toBe(1);

    // Page 1 untouched.
    expect(result.current.pages[0].material).toBeUndefined();
  });

it('switching pages keeps existing materials (no re-init on setPageIdx)', () => {
    const onChange = vi.fn();
    const pagesWithMaterial = makeWireSketch().map((p) =>
      (p as Record<string, unknown>).pagina_id === 2
        ? { ...(p as Record<string, unknown>), material: 'VÍA LÁCTEA' }
        : p,
    );

    const { result, rerender } = renderHook(
      ({ sketch }) => useSketchState(sketch, onChange, false),
      { initialProps: { sketch: pagesWithMaterial as unknown } },
    );

    act(() => result.current.setPageIdx(1));

    // Real round-trip: renamePage triggers onChange(savePayload(next)) which
    // the parent feeds back into `sketch` (same content, new reference).
    act(() => result.current.renamePage(2, 'baño'));
    const wire = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0];
    act(() => rerender({ sketch: wire }));

    // Round-trip preserves the material set at load time + active page.
    expect(result.current.pages[1].material).toBe('VÍA LÁCTEA');
    expect(result.current.pageIdx).toBe(1);
  });

  it('trims catalog names with a trailing space (ROSA DE SALTO )', () => {
    // Catalog rows may carry trailing spaces ("ROSA DE SALTO " in the DB) while
    // setPageMaterial persists the trimmed value. The toolbar <select> options
    // come from the SAME catalog names (trimmed at the source in
    // EntityFormLayout), so the loaded page material must ALSO be trimmed —
    // otherwise value != option → browser falls back to "Material…".
    const onChange = vi.fn();
    const wireWithSpaces = makeWireSketch().map((p) =>
      (p as Record<string, unknown>).pagina_id === 2
        ? { ...(p as Record<string, unknown>), material: 'ROSA DE SALTO ' }
        : p,
    );

    const { result } = renderHook(
      ({ sketch }) => useSketchState(sketch, onChange, false),
      { initialProps: { sketch: wireWithSpaces as unknown } },
    );

    expect(result.current.pages[1].material).toBe('ROSA DE SALTO');
  });

  it('normalizes circle elements (círculo tool) with center + radius', () => {
    // The circle tool stores `cx/cy/radius`; legacy wire circles used
    // `x/y/r`. Both must normalize to the same sketch-circle shape.
    const onChange = vi.fn();
    const wireWithCircle = makeWireSketch().map((p) =>
      (p as Record<string, unknown>).pagina_id === 2
        ? {
            ...(p as Record<string, unknown>),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dibujo: [{ type: 'circle', cx: 120, cy: 80, radius: 40 }] as any[],
          }
        : p,
    );

    const { result } = renderHook(
      ({ sketch }) => useSketchState(sketch, onChange, false),
      { initialProps: { sketch: wireWithCircle as unknown } },
    );

    const circle = result.current.pages[1].elements[0];
    expect(circle.type).toBe('circle');
    if (circle.type === 'circle') {
      expect(circle.cx).toBe(120);
      expect(circle.cy).toBe(80);
      expect(circle.radius).toBe(40);
      expect(circle.stroke).toBe('#000');
      expect(circle.strokeWidth).toBe(2);
    }
  });

  it('updateElementTransform replaces the element with the baked geometry (lines keep new points)', () => {
    // Regression: the old implementation discarded the scale for lines
    // (`return { ...el }`), so the Transformer could never actually resize a
    // line. The new contract receives the ALREADY-baked element (points/size
    // computed from the node's abs transform) and just persists it.
    const onChange = vi.fn();
    const initial = makeWireSketch();

    const { result } = renderHook(
      ({ sketch }) => useSketchState(sketch, onChange, false),
      { initialProps: { sketch: initial as unknown } },
    );

    act(() => result.current.setPageIdx(1));

    const line = result.current.pages[1].elements[0] as SketchLine;
    const baked = {
      ...line,
      points: [0, 0, 160, 160],
      x: 0,
      y: 0,
    };
    act(() => result.current.updateElementTransform(line.id, baked));

    const updated = result.current.pages[1].elements[0];
    expect(updated).toMatchObject({ id: line.id, type: 'line', points: [0, 0, 160, 160] });
    expect(onChange).toHaveBeenCalled();
  });
});