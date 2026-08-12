// A/B split via ad platforms directly — no middleware redirect needed.
// /  → Variant A (3.300€) — send ad traffic here
// /b → Variant B (4.400€) — send ad traffic here
export const onRequest = (_context: any, next: any) => next();
