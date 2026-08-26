/** Hands a fetched blob to the browser's save-file flow. The anchor must be
    in the document for reliable click semantics, and the object URL must
    outlive the click's task — a same-tick revoke can abort the download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
