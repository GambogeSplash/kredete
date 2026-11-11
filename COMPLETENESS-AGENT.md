# Support agent: completeness

Every screen, state and control of the Support agent area (bots, widget, demo page). Status: Done = restyled and looked at in a browser; Kept = behaviour unchanged, no visible change needed.

| # | Screen, state or control | Before | After (prototype language) | Status |
|---|---|---|---|---|
| 1 | Rail on every page | Plain list, no group headings | Heading "Support agent", All bots, bot name heading, Overview, separator, "Build" heading, Knowledge, Experience, Products; one sliding highlight (the ask.js pattern); horizontal tab strip on phones | Done |
| 2 | Page title row | h1 plus a paragraph under it | `.ds-head` with the title, an (i) hint, status tag and docs link on the right | Done |
| 3 | Bots list, filled | `.dt` table | `.ds-table` with icon tile, name, sources, products, status tag (Live on N sites / Needs setup); rows are links with hover and focus | Done |
| 4 | Bots list, empty | Floating text | Framed `.ds-empty` with New bot | Done |
| 5 | Bots list, loading and load error | Skeleton rows, bare error | Skeleton rows; framed error with Try again | Done |
| 6 | Bot not found | Bare text | Framed `.ds-empty` with All bots | Done |
| 7 | New bot dialog | Modal | Modal with the design-system body rhythm; counters, hints | Done |
| 8 | New bot, each field error (Required, bad link) | Red text | `.agerr` in the design-system error colour, red border on the field | Done |
| 9 | New bot, server 422 under the field named, other errors in the dialog | as before | Kept, restyled | Done |
| 10 | Overview: status tag | Live on N sites / Not live | Live on N sites / Needs setup | Done |
| 11 | Overview: tiles (sources, Public pages, live sites, daily limit) | none | Four `.astat` tiles from real data, count up once, reduced motion shows them at once | Done |
| 12 | Overview: Getting it live checklist | `.acard` | `.ds-card` with (i), done marks, Go to buttons | Done |
| 13 | Overview: Knowledge, Experience, Products cards with Edit | `.acard` | `.ds-card`, (i) hint on each heading, Edit button, warnings, links without underline | Done |
| 14 | Overview: no products | Muted line | Framed `.ds-empty` | Done |
| 15 | Knowledge: tables per connection with checkboxes, counts, Open in Library | `.dt` | `.ds-table` per connection, brand focus outline on the row, mobile layout | Done |
| 16 | Knowledge: Public page counts, No Public pages tag, excluded or disconnected note | as before | Kept, restyled | Done |
| 17 | Knowledge: container filter by connection groups and totals line | as before | Kept | Done |
| 18 | Knowledge: unsaved changes bar (Discard, Save, error) | sticky bar | Sticky bar kept; leaving prompts | Done |
| 19 | Knowledge: no sources | Floating text | Framed `.ds-empty` with Open Connectors | Done |
| 20 | Experience: Conversation, Getting help, Trust, Limit groups | Plain fieldsets | `.ds-card` per group, (i) on each heading | Done |
| 21 | Experience: fields, counters, starters add and remove, 422 and local errors | as before | Same rules (bot-form.js untouched), prototype field focus ring and label spacing | Done |
| 22 | Experience: live preview with Start and Can't answer, Preview as | as before | Same behaviour; segmented control and the app's select menu | Done |
| 23 | Experience: unsaved bar and leave prompt | as before | Kept, restyled | Done |
| 24 | Products: product cards, selected state, add tile, revoked | solid discs | Tinted squircle icon, tag, hover lift, focus ring, dashed add tile | Done |
| 25 | Products: Snippet card with Copy, CSP guidance, demo link | one long card | Own card with (i); Copy is the primary button | Done |
| 26 | Products: Settings card (name, sites add and remove, colour, side) with unsaved bar | same card | Own card; swatches with hover; bar kept | Done |
| 27 | Products: Key card (Replace key, Revoke) | in the long card | Own card; confirm dialogs | Done |
| 28 | Products: revoked product read only | card | Card with (i) carrying the explanation | Done |
| 29 | Products: no products | Floating text | Framed `.ds-empty` | Done |
| 30 | Add a product dialog and its errors | modal | Same rhythm as New bot | Done |
| 31 | Confirm dialogs (replace key, revoke) | modal | Danger button in the prototype's red | Done |
| 32 | Widget: launcher closed and open | accent disc | Same; Broth tokens (radius 12 / 18 / 24, neutral dark) | Done |
| 33 | Widget: header avatar | Initial letter | Broth mark on the accent colour | Done |
| 34 | Widget: greeting, starters, messages, sources, contact, feedback, thanks, error and unavailable states | as before | Broth radii and tails; links without underline; same markup and API | Styles changed; only the start and open states were viewed (no bot API stub for answers) |
| 35 | Widget in preview-in-app mode follows light and dark | yes | Kept | Done |
| 36 | Widget on host pages follows prefers-color-scheme | yes | Kept, with the neutral Broth dark | Done |
| 37 | Embed demo page | Plain page | Broth wordmark header, Broth radii and colours, light and dark | Done |
| 38 | Admin-only gating, unsaved-leave guards, 422 handling, keys | n/a | Kept, no code changes | Kept |

Counts: 38 rows; 36 done and viewed, 1 kept (row 38), 1 styles changed but not viewed in every state (row 34).
