export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const downloadText = (text: string, filename: string, type = "text/plain"): void =>
  downloadBlob(new Blob([text], { type }), filename);

export const downloadJson = (value: unknown, filename: string): void =>
  downloadText(JSON.stringify(value, null, 2), filename, "application/json");
