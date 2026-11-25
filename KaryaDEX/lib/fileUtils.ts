/**
 * KaryaDEX — File Utilities (Phase 12.2)
 *
 * Cross-platform helpers for file-to-base64 reading and magic-byte extraction.
 * Supports Web (FileReader / fetch blob) and Native (expo-file-system).
 */

import { Platform } from 'react-native';

export interface ParsedFileResult {
  base64: string;
  mimeType?: string;
}

/**
 * Parses file output (e.g. data URL or raw base64):
 * - Separates MIME type from Base64 content
 * - Strips any "data:<mime-type>;base64," prefix so only pure Base64 characters remain
 * - Strips all whitespace characters (\s)
 */
export function parseFileBase64AndMime(input: string, fallbackMime?: string): ParsedFileResult {
  if (!input || typeof input !== 'string') {
    return { base64: '', mimeType: fallbackMime };
  }

  let str = input.trim();
  let mimeType = fallbackMime;

  if (str.includes(',')) {
    const parts = str.split(',');
    const header = parts[0];
    const match = header.match(/^data:([^;]+)/i);
    if (match && match[1]) {
      mimeType = match[1];
    }
    str = parts.slice(1).join(',');
  } else if (str.startsWith('data:')) {
    const commaIndex = str.indexOf(',');
    if (commaIndex !== -1) {
      const header = str.slice(0, commaIndex);
      const match = header.match(/^data:([^;]+)/i);
      if (match && match[1]) {
        mimeType = match[1];
      }
      str = str.slice(commaIndex + 1);
    }
  }

  // Strip all whitespace (\s)
  const cleanBase64 = str.replace(/\s/g, '');

  return {
    base64: cleanBase64,
    mimeType,
  };
}

/**
 * Strips data URL prefix and whitespace, returning pure Base64 characters.
 */
export function cleanBase64(input: string): string {
  return parseFileBase64AndMime(input).base64;
}

/**
 * Reads a file asset across Web and Native platforms, returning pure Base64 and detected MIME type.
 */
export async function readFileAsset(asset: {
  uri: string;
  file?: any;
  base64?: string | null;
  mimeType?: string | null;
}): Promise<ParsedFileResult> {
  // 1. If base64 was already provided by picker
  if (asset.base64) {
    return parseFileBase64AndMime(asset.base64, asset.mimeType || undefined);
  }

  // 2. Web File / Blob instance via FileReader
  if (asset.file && typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const parsed = parseFileBase64AndMime(result, asset.file?.type || asset.mimeType || undefined);
        resolve(parsed);
      };
      reader.onerror = reject;
      reader.readAsDataURL(asset.file);
    });
  }

  // 3. Web or Native via fetch blob -> FileReader
  if (Platform.OS === 'web' || typeof fetch !== 'undefined') {
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const parsed = parseFileBase64AndMime(result, blob?.type || asset.mimeType || undefined);
          resolve(parsed);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (fetchErr) {
      // Fall through to native FileSystem
    }
  }

  // 4. Native iOS / Android via expo-file-system
  if (Platform.OS !== 'web') {
    // If uri is already a data URI
    if (asset.uri && asset.uri.startsWith('data:')) {
      return parseFileBase64AndMime(asset.uri, asset.mimeType || undefined);
    }

    try {
      const FileSystem = require('expo-file-system/legacy');
      const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      return parseFileBase64AndMime(raw, asset.mimeType || undefined);
    } catch (fsErr) {
      console.warn('[FileUtils] FileSystem base64 read error:', fsErr);
    }
  }

  throw new Error('Unable to convert file to base64 on this platform.');
}

/**
 * Converts a file asset (from expo-document-picker or expo-image-picker) to pure base64.
 * Strips any data URL prefix and whitespace.
 */
export async function fileAssetToBase64(asset: {
  uri: string;
  file?: any;
  base64?: string | null;
  mimeType?: string | null;
}): Promise<string> {
  const result = await readFileAsset(asset);
  return result.base64;
}

/**
 * Extracts magic bytes (first 4 to 8 bytes) from a base64 string.
 * Defensively cleans any data URI prefix or whitespace before decoding.
 */
export function extractMagicBytesFromBase64(base64: string): number[] {
  try {
    const clean = cleanBase64(base64);
    const binary = atob(clean.slice(0, 32));
    const bytes: number[] = [];
    for (let i = 0; i < Math.min(8, binary.length); i++) {
      bytes.push(binary.charCodeAt(i));
    }
    return bytes;
  } catch {
    return [];
  }
}

/**
 * Reads a chunk of a Blob as text in a cross-platform manner.
 */
async function readBlobChunkAsText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === 'function') {
    return await (blob as any).text();
  }
  if (typeof (blob as any).arrayBuffer === 'function') {
    const buffer = await (blob as any).arrayBuffer();
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('latin1').decode(buffer);
    }
    if (typeof (globalThis as any).Buffer !== 'undefined') {
      return (globalThis as any).Buffer.from(buffer).toString('latin1');
    }
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = reject;
      reader.readAsText(blob);
    });
  }
  return '';
}

/**
 * Validates whether a PDF file/blob exceeds the specified page limit (default 40).
 *
 * Lightweight estimation/counting:
 * Reads first/last chunks to check catalog /Count or counts `/Type\s*\/Page[^s]` occurrences
 * in chunks without loading the entire document into memory.
 */
export async function validatePdfPageLimit(
  file: File | Blob | any,
  maxPages: number = 40
): Promise<{ valid: boolean; pageCount: number }> {
  if (!file) {
    return { valid: true, pageCount: 0 };
  }

  if (typeof file?.pageCount === 'number') {
    return { valid: file.pageCount <= maxPages, pageCount: file.pageCount };
  }

  // 1. Resolve Blob or string content
  let blob: Blob | null = null;
  if (file instanceof Blob || (typeof file?.slice === 'function' && typeof file?.size === 'number')) {
    blob = file;
  } else if (file?.file && (file.file instanceof Blob || typeof file.file?.slice === 'function')) {
    blob = file.file;
  } else if (typeof file?.text === 'string') {
    const str = file.text as string;
    const matches = str.match(/\/Type\s*\/Page[^s]/g);
    const count = matches ? matches.length : 0;
    return { valid: count <= maxPages, pageCount: count };
  } else if (typeof file?.uri === 'string') {
    if (Platform.OS === 'web' || typeof fetch !== 'undefined') {
      try {
        const response = await fetch(file.uri);
        blob = await response.blob();
      } catch {}
    } else {
      try {
        const FileSystem = require('expo-file-system/legacy');
        const raw = await FileSystem.readAsStringAsync(file.uri, { encoding: 'latin1' });
        const matches = raw.match(/\/Type\s*\/Page[^s]/g);
        const count = matches ? matches.length : 0;
        return { valid: count <= maxPages, pageCount: count };
      } catch {}
    }
  }

  if (!blob) {
    return { valid: true, pageCount: 0 };
  }

  const size = blob.size;
  if (size === 0) {
    return { valid: true, pageCount: 0 };
  }

  const CHUNK_SIZE = 65536; // 64 KB chunk size

  // 2. Read first chunk (up to 64KB)
  const firstChunkBlob = blob.slice(0, Math.min(size, CHUNK_SIZE));
  const firstChunkText = await readBlobChunkAsText(firstChunkBlob);

  // 3. Read last chunk (up to 64KB) if file is larger than CHUNK_SIZE
  let lastChunkText = '';
  if (size > CHUNK_SIZE) {
    const lastChunkBlob = blob.slice(Math.max(0, size - CHUNK_SIZE), size);
    lastChunkText = await readBlobChunkAsText(lastChunkBlob);
  }

  // Check for catalog /Pages /Count (\d+) in first or last chunk
  const countRegex1 = /\/Type\s*\/Pages[\s\S]{0,300}?\/Count\s+(\d+)/i;
  const countRegex2 = /\/Count\s+(\d+)[\s\S]{0,300}?\/Type\s*\/Pages/i;
  let countFromCatalog = 0;
  const matchCatalog =
    firstChunkText.match(countRegex1) ||
    firstChunkText.match(countRegex2) ||
    lastChunkText.match(countRegex1) ||
    lastChunkText.match(countRegex2);
  if (matchCatalog && matchCatalog[1]) {
    countFromCatalog = parseInt(matchCatalog[1], 10);
  }

  // 4. Count /Type /Page[^s] occurrences
  const pageObjectRegex = /\/Type\s*\/Page[^s]/g;
  let pageObjectCount = 0;

  if (size <= CHUNK_SIZE) {
    const matches = firstChunkText.match(pageObjectRegex);
    pageObjectCount = matches ? matches.length : 0;
  } else {
    // If catalog count already decisively exceeds maxPages, return immediately
    if (countFromCatalog > maxPages) {
      return { valid: false, pageCount: countFromCatalog };
    }

    // Stream through chunks without buffering the full document in memory
    let offset = 0;
    while (offset < size) {
      const chunkBlob = blob.slice(offset, Math.min(size, offset + CHUNK_SIZE));
      const chunkText = await readBlobChunkAsText(chunkBlob);
      const matches = chunkText.match(pageObjectRegex);
      if (matches) {
        pageObjectCount += matches.length;
        if (pageObjectCount > maxPages) {
          break; // Early exit once limit exceeded
        }
      }
      offset += CHUNK_SIZE;
    }
  }

  const finalPageCount = Math.max(countFromCatalog, pageObjectCount);
  return {
    valid: finalPageCount <= maxPages,
    pageCount: finalPageCount,
  };
}

