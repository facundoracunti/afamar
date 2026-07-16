// TODO: completed-works is part of a future phase (out of refactor scope).
// The new backend doesn't include this module yet. Keeping stubs so the
// import surface stays intact.

export const getCompletedWorks = async () => ({ data: [] as unknown[] });
export const getCompletedWork = async (_id: number | string) => ({ data: null as Record<string, unknown> | null });
export const createCompletedWork = async (_data: Record<string, unknown>) => ({ data: null as Record<string, unknown> | null });
export const updateCompletedWork = async (_id: number | string, _data: Record<string, unknown>) => ({ data: null as Record<string, unknown> | null });
export const deleteCompletedWork = async (_id: number | string) => ({ data: null as Record<string, unknown> | null });
export const uploadCompletedWorkPhoto = async (_id: number | string, _file: File) => ({ data: null as Record<string, unknown> | null });