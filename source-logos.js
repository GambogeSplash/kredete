/* source-logos.js: one shared set of source logos, inline SVG, no requests.
 *
 *   SRCLOGO(system, size)       the logo as an <svg> string; an unknown system returns ''
 *   SRCLOGO.has(system)         whether there is a logo for it
 *   SRCLOGO.key(system)         the canonical key, or ''
 *
 * `system` is a connection system (confluence, gdrive, github_docs), a display name (Confluence,
 * Google Drive, Docs repositories) or a key below. Confluence, Google Drive and Notion use the
 * marks the prototype already had; the others are simplified drawings of the official marks. GitHub
 * is drawn in currentColor, so it reads in the dark theme too; Notion keeps its white tile.
 */
(() => {
'use strict';
const LOGOS = {
 "confluence": [
  "0 0 63.8 63.8",
  "<defs><linearGradient id=\"srcg-c1\" x1=\"59.68\" y1=\"67.65\" x2=\"20.35\" y2=\"45.05\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".18\" stop-color=\"#0052cc\"/><stop offset=\"1\" stop-color=\"#2684ff\"/></linearGradient><linearGradient id=\"srcg-c2\" x1=\"3.07\" y1=\"-.37\" x2=\"42.41\" y2=\"22.24\" gradientUnits=\"userSpaceOnUse\"><stop offset=\".18\" stop-color=\"#0052cc\"/><stop offset=\"1\" stop-color=\"#2684ff\"/></linearGradient></defs><path fill=\"url(#srcg-c1)\" d=\"M2.23,49.53c-.65,1.06-1.38,2.29-2,3.27a2,2,0,0,0,.67,2.72l13,8a2,2,0,0,0,2.77-.68c.52-.87,1.19-2,1.92-3.21,5.15-8.5,10.33-7.46,19.67-3l12.89,6.13a2,2,0,0,0,2.69-1l6.19-14a2,2,0,0,0-1-2.62c-2.72-1.28-8.13-3.83-13-6.18C28.51,30.45,13.62,31,2.23,49.53Z\"/><path fill=\"url(#srcg-c2)\" d=\"M60.52,17.76c.65-1.06,1.38-2.29,2-3.27a2,2,0,0,0-.67-2.72l-13-8A2,2,0,0,0,46,4.43c-.52.87-1.19,2-1.92,3.21-5.15,8.5-10.33,7.46-19.67,3L11.56,4.54a2,2,0,0,0-2.69,1l-6.19,14a2,2,0,0,0,1,2.62c2.72,1.28,8.13,3.83,13,6.18C34.24,36.84,49.13,36.27,60.52,17.76Z\"/>"
 ],
 "github": [
  "0 0 24 24",
  "<path fill=\"currentColor\" d=\"M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12\"/>"
 ],
 "google-drive": [
  "0 0 87.3 78",
  "<path d=\"m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z\" fill=\"#0066da\"/><path d=\"m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z\" fill=\"#00ac47\"/><path d=\"m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z\" fill=\"#ea4335\"/><path d=\"m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z\" fill=\"#00832d\"/><path d=\"m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z\" fill=\"#2684fc\"/><path d=\"m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z\" fill=\"#ffba00\"/>"
 ],
 "notion": [
  "0 0 100 100",
  "<path d=\"M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z\" fill=\"#fff\"/><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M61.35 0.227l-55.333 4.087C1.553 4.7 0 7.617 0 11.113v60.66c0 2.723 0.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257 -3.89c5.433 -0.387 6.99 -2.917 6.99 -7.193V20.64c0 -2.21 -0.873 -2.847 -3.443 -4.733L74.167 3.143c-4.273 -3.107 -6.02 -3.5 -12.817 -2.917zM25.92 19.523c-5.247 0.353 -6.437 0.433 -9.417 -1.99L8.927 11.507c-0.77 -0.78 -0.383 -1.753 1.557 -1.947l53.193 -3.887c4.467 -0.39 6.793 1.167 8.54 2.527l9.123 6.61c0.39 0.197 1.36 1.36 0.193 1.36l-54.933 3.307 -0.68 0.047zM19.803 88.3V30.367c0 -2.53 0.777 -3.697 3.103 -3.893L86 22.78c2.14 -0.193 3.107 1.167 3.107 3.693v57.547c0 2.53 -0.39 4.67 -3.883 4.863l-60.377 3.5c-3.493 0.193 -5.043 -0.97 -5.043 -4.083zm59.6 -54.827c0.387 1.75 0 3.5 -1.75 3.7l-2.91 0.577v42.773c-2.527 1.36 -4.853 2.137 -6.797 2.137 -3.107 0 -3.883 -0.973 -6.21 -3.887l-19.03 -29.94v28.967l6.02 1.363s0 3.5 -4.857 3.5l-13.39 0.777c-0.39 -0.78 0 -2.723 1.357 -3.11l3.497 -0.97v-38.3L30.48 40.667c-0.39 -1.75 0.58 -4.277 3.3 -4.473l14.367 -0.967 19.8 30.327v-26.83l-5.047 -0.58c-0.39 -2.143 1.163 -3.7 3.103 -3.89l13.4 -0.78z\" fill=\"#000\"/>"
 ],
 "slack": [
  "0 0 24 24",
  "<g><rect x=\"9.6\" y=\"1.5\" width=\"3.2\" height=\"8.3\" rx=\"1.6\" fill=\"#36c5f0\"/><circle cx=\"6.4\" cy=\"3.1\" r=\"1.6\" fill=\"#36c5f0\"/><rect x=\"14.2\" y=\"9.6\" width=\"8.3\" height=\"3.2\" rx=\"1.6\" fill=\"#2eb67d\"/><circle cx=\"20.9\" cy=\"6.4\" r=\"1.6\" fill=\"#2eb67d\"/><rect x=\"11.2\" y=\"14.2\" width=\"3.2\" height=\"8.3\" rx=\"1.6\" fill=\"#ecb22e\"/><circle cx=\"17.6\" cy=\"20.9\" r=\"1.6\" fill=\"#ecb22e\"/><rect x=\"1.5\" y=\"11.2\" width=\"8.3\" height=\"3.2\" rx=\"1.6\" fill=\"#e01e5a\"/><circle cx=\"3.1\" cy=\"17.6\" r=\"1.6\" fill=\"#e01e5a\"/></g>"
 ],
 "sharepoint": [
  "0 0 24 24",
  "<circle cx=\"14\" cy=\"9\" r=\"7\" fill=\"#036c70\"/><circle cx=\"18\" cy=\"15\" r=\"6\" fill=\"#1a9ba1\"/><circle cx=\"12\" cy=\"19\" r=\"4.5\" fill=\"#37c6d0\"/><rect x=\"1.5\" y=\"7\" width=\"12\" height=\"12\" rx=\"2\" fill=\"#03787c\"/><path fill=\"#fff\" d=\"M9.2 15.9c-.7.4-1.5.6-2.4.6-.9 0-1.6-.2-2.1-.5v-1.2c.6.5 1.3.7 2 .7.9 0 1.3-.3 1.3-.8 0-.3-.2-.5-.6-.7l-.9-.4c-.9-.4-1.3-.9-1.3-1.7 0-1.1.8-1.8 2.2-1.8.7 0 1.3.1 1.7.4v1.2c-.5-.3-1-.5-1.6-.5-.7 0-1 .3-1 .7 0 .3.2.5.7.7l.8.4c.9.4 1.4.9 1.4 1.7 0 .6-.2 1-.2 1.2z\"/>"
 ],
 "google-cloud-storage": [
  "0 0 24 24",
  "<path fill=\"#4285f4\" d=\"M12 1.5l9 5.25v10.5L12 22.5 3 17.25V6.75z\"/><path fill=\"#669df6\" d=\"M12 1.5l9 5.25-9 5.25-9-5.25z\"/><path fill=\"#1a73e8\" d=\"M12 12l9-5.25v10.5L12 22.5z\"/><path fill=\"#fff\" d=\"M8.5 9.4h7v2.2h-7zM8.5 13h7v2.2h-7z\" opacity=\".95\"/>"
 ]
};
const ALIASES = {
  confluence: 'confluence', 'github': 'github', 'github_docs': 'github', 'github-docs': 'github', 'docs repositories': 'github', 'docs repository': 'github',
  gdrive: 'google-drive', 'google drive': 'google-drive', 'google-drive': 'google-drive', drive: 'google-drive',
  notion: 'notion', slack: 'slack', sharepoint: 'sharepoint',
  gcs: 'google-cloud-storage', 'google cloud': 'google-cloud-storage', 'google cloud storage': 'google-cloud-storage', 'google-cloud-storage': 'google-cloud-storage',
};
const key = (system) => ALIASES[String(system || '').toLowerCase()] || '';
/** @param {string} system @param {number} [size] */
function SRCLOGO(system, size) {
  const k = key(system);
  if (!k) return '';
  const [box, body] = LOGOS[k];
  const px = size || 20;
  return `<svg class="srclogo srclogo-${k}" width="${px}" height="${px}" viewBox="${box}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${k.replace(/-/g, ' ')}" focusable="false">${body}</svg>`;
}
SRCLOGO.has = (system) => !!key(system);
SRCLOGO.key = key;
window.SRCLOGO = SRCLOGO;
})();
