/**
 * Airtable attachment -> dynamic ESM loader helper.
 * Fetches raw source, round-trips it through escaped Base64, then imports a data URL.
 */
/** @typedef {{url:string,filename?:string}} Attachment */
/** @param {string|Attachment} attachment @returns {Promise<Record<string,unknown>>} */
export async function importAttachmentModule(attachment) {
  const url = typeof attachment === 'string' ? attachment : attachment?.url;
  if (!url) throw new TypeError('Attachment URL is required.');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch module source: ${response.status} ${response.statusText}`);
  const source = await response.text();
  const base64 = encodeSourceBase64(source);
  const decoded = decodeSourceBase64(base64);
  return import(`data:text/javascript;charset=utf-8;base64,${encodeSourceBase64(decoded)}`);
}
/** @param {string} source */
export function encodeSourceBase64(source) { return btoa(unescape(encodeURIComponent(source))); }
/** @param {string} base64 */
export function decodeSourceBase64(base64) { return decodeURIComponent(escape(atob(base64))); }
export default importAttachmentModule;
