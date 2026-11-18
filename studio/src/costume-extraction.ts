import { validateReferenceFile } from './generation';
import type { ImageConfig } from './generation';

// Use the garment image unchanged. Local mode does not claim automatic extraction.
export async function extractCostume(
  _config: ImageConfig, file: File, signal: AbortSignal, _fetcher: typeof fetch = fetch,
): Promise<File> {
  await validateReferenceFile(file, 'costume');
  signal.throwIfAborted();
  return file;
}
