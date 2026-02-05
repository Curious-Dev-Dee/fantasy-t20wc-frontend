export const getJSON = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const setJSON = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
};

export const scopedKey = (base: string, userId?: string | null) => {
  const suffix = userId ? userId : "anon";
  return `${base}_${suffix}`;
};
