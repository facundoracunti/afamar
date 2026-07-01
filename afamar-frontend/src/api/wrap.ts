export const wrap = <T>(fn: () => Promise<any>): Promise<T> => fn().then((r) => r.data);
