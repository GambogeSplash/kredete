// Globals shared by the browser modules, which load as classic scripts (see index.html).
type ApiModule = typeof import('./api.js');

declare global {
  /** The network module (api.js). */
  var API: ReturnType<ApiModule['createApi']>;
  /** How sync runs read in the UI (sync.js). */
  var SYNC: typeof import('./sync.js');
  /** How domains nest, for every list of domains (domain-tree.js). */
  var DOMAIN_TREE: typeof import('./domain-tree.js');
  /** The Library's mode and documents query (library-browse.js). */
  var LIBRARY_BROWSE: typeof import('./library-browse.js');
  /** The bot admin's field rules, allowed sites and status (bot-form.js). */
  var BOT_FORM: typeof import('./bot-form.js');
  /** The shell (app.js). */
  var BRAIN: any;
  /** Surfaces by name; the router renders them into #app. */
  var SURFACES: Record<string, any>;
  var AUTH: any;
  var ASK: any;
  var BROTH_LOGO: { mount: (root: ParentNode, opts?: { domain?: () => string; toast?: (m: string) => void }) => void; LOGO_LOOKUP: boolean } | undefined;
  var BROTH_RAIL: (() => void) | undefined;
  var BOOKMARKS: { has: (turn: any) => boolean; toggle: (turn: any) => boolean } | undefined;
  var INBOX: { open: () => number; load: () => Promise<void> } | undefined;
  var BROTH_FX: { trashRow: (row: Element | null) => Promise<void>; renamed: (title: string) => void } | undefined;
  var SETUP: any;
  /** The Library (library.js). */
  var LIBRARY: any;
  /** The document drawer, and how a document reads in lists (document-drawer.js). */
  var DOCUMENTS: any;
  var ADMIN: any;
  var DOCS: Record<string, any>;
  /** The Support agent's shell, page registry and form helpers (agent.js). */
  var AGENT: any;
  /** The support bot widget, loaded with data-preview for the Experience preview (embed.js). */
  var BrothBot: any;
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
