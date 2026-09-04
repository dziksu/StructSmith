const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSuffix(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length] ?? "a";
  return out;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Stable, human-readable identifier — helps AI reason about the model. */
export function createId(seed?: string): string {
  const base = seed ? slugify(seed) : "";
  return base ? `${base}-${randomSuffix()}` : randomSuffix(12);
}

export function uniqueKey(existing: Set<string>, seed: string): string {
  const base = slugify(seed) || "view";
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export const nowIso = (): string => new Date().toISOString();
