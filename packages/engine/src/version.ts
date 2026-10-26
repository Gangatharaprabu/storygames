/** Engine version. Packs declare `minEngine`; the engine refuses packs that need a newer one. */
export const ENGINE_VERSION = "0.1.0";

export function satisfiesMinEngine(minEngine: string, engine = ENGINE_VERSION): boolean {
  const a = engine.split(".").map(Number);
  const b = minEngine.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
