/**
 * `MaterialForm` — query keys.
 *
 * Centralized so the categories / colors / settings / material queries
 * always hit the SAME cache entries as the rest of the app.
 */

export const CATEGORIES_KEY = ['material-categories'] as const;
export const COLORS_KEY = ['material-colors'] as const;
export const SETTINGS_KEY = ['settings'] as const;
export const MATERIAL_KEY = (id: string | number | undefined) => ['material', id] as const;
