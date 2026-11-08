// Globals shared by the browser modules, which load as classic scripts (see index.html).
type ApiModule = typeof import('./api.js');

declare global {
  /** The network module (api.js). */
  var API: ReturnType<ApiModule['createApi']>;
}

export {};
