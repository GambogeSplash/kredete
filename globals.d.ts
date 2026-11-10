// Globals shared by the browser modules, which load as classic scripts (see index.html).
type ApiModule = typeof import('./api.js');

declare global {
  /** The network module (api.js). */
  var API: ReturnType<ApiModule['createApi']>;
  /** How sync runs read in the UI (sync.js). */
  var SYNC: typeof import('./sync.js');
  /** The shell (app.js). */
  var BRAIN: any;
  /** Surfaces by name; the router renders them into #app. */
  var SURFACES: Record<string, any>;
  var AUTH: any;
  var ASK: any;
  var SETUP: any;
  var LIBRARY: any;
  var ADMIN: any;
  var DOCS: Record<string, any>;
  var LEVELS: string[];
  var LEVEL_COL: string[];
  var Motion: any;
  function ICON(name: string, size?: number): string;
  function SRCICON(system: string, size?: number): string;
  function AVATAR(name: string, cls?: string, size?: number): string;
  function PERSON(name: string, size?: number, cls?: string): string;
  interface Window {
    API: Global['API'];
  }
}
type Global = typeof globalThis;

export {};
