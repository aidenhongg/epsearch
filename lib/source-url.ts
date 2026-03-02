/** Build a justice.gov PDF link from source metadata. */
export function buildSourceUrl(meta: Record<string, unknown>): string | null {
  const filename = meta.filename as string | undefined;
  const dataset = meta.dataset as number | undefined;
  if (!filename || dataset == null) return null;
  return `https://www.justice.gov/epstein/files/DataSet%20${dataset}/${filename}.pdf`;
}
