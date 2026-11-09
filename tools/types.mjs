// Generates types.d.ts from the API's OpenAPI document (docs/client-types.md in broth-service).
//
//   npm run types                       # reads ../broth-service/openapi/openapi.json
//   BROTH_OPENAPI=/path/openapi.json npm run types
//
// The generated file is committed so reviews show API changes; `npm run check` fails when it
// drifts from the OpenAPI document.
import { writeFile } from 'node:fs/promises';
import { generateTypes, openapiPath } from './openapi-types.mjs';

const source = openapiPath();
await writeFile(new URL('../types.d.ts', import.meta.url), await generateTypes(source));
console.log(`types.d.ts generated from ${source}`);
