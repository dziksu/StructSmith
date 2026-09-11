/** React Flow uses the same platform split for its built-in multi-selection key. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function primaryModifierLabel(): string {
  return isApplePlatform() ? "⌘" : "Ctrl";
}

export function primaryModifierKeyCode(): "Meta" | "Control" {
  return isApplePlatform() ? "Meta" : "Control";
}

export function hasPrimaryModifier(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey">): boolean {
  return isApplePlatform() ? event.metaKey : event.ctrlKey;
}
