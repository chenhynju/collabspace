# Business diagrams acceptance

Started 2026-10-22; completed 2026-10-23 Asia/Shanghai. Reference public share was successfully read after web fetch and browser-tool timeouts: https://chatgpt.com/share/6ada26dc-f870-83e8-a543-d8828e314ebf . Its comparison is requirements context, not evidence of this product's capabilities.

## Release

- Main implementation 47a99f76bba62dc09693085971705a7f2b494a9b; accessibility fix/deployed source 2b509d7b952d62b0efcbae52cd4b3d799d1603e4.
- Live https://collabspace.purelamp.uk ; Vercel dpl_BVAueNybqwR3GJwLUNSpLpKbjFAg, collabspace-66me5kmw9-purelamp.vercel.app. Ready and promoted.
- Frontend only; existing API r20261022-03 and WS r20261022-02 unchanged. No migration, new server resources, credentials or dependencies. Previous Vercel deployments retained for rollback; shared source remains compatible with same pinned Mermaid12.2 renderer.
- CI code revision success: https://github.com/chenhynju/collabspace/actions/runs/39810409698 . Windows isolated production build, type checks and Vercel final build passed. Temporary local component test route removed before commit/archive; not deployed.

## PASSED

1. Web unit regression 11/11: modern node definitions; source-preserving rename/style/layout; labeled edge variants; bounded clone/delete and refusal of complex references; leading collaboration comments; prior IM/tenant/date regressions.
2. Local real browser official renderer: all24 templates + all24 catalog nodes rendered, node rename/palette/direction/labeled edge operations, actual SVG/PNG downloads, readonly control and invalid-source export gate. No mocked renderer. Temporary page did not claim Yjs/production acceptance.
3. Production three-account end-to-end: owner + editor + viewer; create BOARD and grant roles; add database; rename/color; clone/delete; layout; labeled bidirectional edge; member sees updates; both editors receive server-save status; viewer cannot edit. Open template replacement dialog, let peer add a node, confirm stale replacement: refused and peer content retained. Import real .mmd using file input, confirm replacement, peer converges; owner reload retains source. Render contains Chinese label; actual SVG and PNG downloaded. Invalid source disables SVG export; valid source restored before close. Playwright1/1 passed in1.3min.
4. Production catalog journey: all24 scenarios selected through real search/template buttons and explicit replacement, exact shared source, successful SVG render and confirmed save each; final WBS survives reload. Playwright1/1 passed in1.4min. Two business specs executed in separate bounded runs, not one fabricated combined run.
5. Exported production PNG parsed: 720x112, PNG signature correct; SVG includes 支付确认. Both image and browser screenshots visually inspected.

Production synthetic document IDs: collaboration 80a18724-f26b-453c-9b99-251402e4325b; catalog d31ad8b3-efc0-43d3-bb86-bff0e234daff. No existing customer/other-project content changed.

## Failures and fixes

- Web cache and browser runtime could not read public reference initially; ordinary public HTML fetch yielded shared response content. No private API/auth bypass.
- First local development navigation exceeded30s while initial compile took69s. Subsequent wait allowed compilation.
- Chinese Sankey CSV failed official parser both bare/quoted. Installed parser's lexer allows ASCII fields. Shipped English-label template explicitly marked; kept strict security and user's invalid source untouched. All24 final renders passed.
- Palette/template cards acquired extra accessible text from shape/category hints. Stable aria-labels added; initial online run interrupted at known obsolete selector and not counted as passing. Final source above passed both journeys. No unsupported timeout/network reliability claim.

## Boundaries / NOT_RUN

This is24 scenario templates, not measured90% market coverage. Flowcharts/basic mindmaps have supported graphical operations; other types retain source editing. Simplified subgraph swimlane/use-case diagrams are not standards-compliant BPMN/UML tooling. Complex source deletion/renaming may refuse rather than rewrite unrelated content. No general geometric coordinate roundtrip, professional cloud/Cisco stencils, .drawio/.vsdx compatibility, PDF generation, CAD/electrical/P&ID, AI agent or HA claim. PNG is capped at4096px. Sources and engine limits remain32000 characters/500 edges and strict sandbox/CSP.

NOT_RUN this iteration: browser-engine/mobile matrix, large-graph/load/performance acceptance, professional file-format roundtrips, complete per-type visual editing, fresh Office editor regression. Existing tenant/API/WS safety remains backed by current green CI; no new tenant/storage schema.

Artifacts: diagram-round3-palette.png (local component only), business-diagrams-online-owner.png, business-diagrams-online-peer.png, business-diagrams-online-catalog.png. Repeatable business specs: tests/browser/business-diagrams.spec.cjs, using ignored COLLAB_BROWSER_CONFIG and optionally COLLAB_BROWSER_HTTP1=1. Raw logs, public share HTML and downloaded files remain ignored under .test-runs; no secrets committed.
