# Unified Workspace — 2026-10-24

## Delivered

P-HUB / BR-HUB / D-HUB / AT-HUB: see [UNIFIED-WORKSPACE](../../docs/collaboration/UNIFIED-WORKSPACE.md).
Single global `/collaboration` and scoped `/projects/:id/content` for rich text, Markdown, Mermaid board and Word/Excel/PowerPoint. Existing routes remain valid. Attachment management keeps ordinary file operations. Blank Office creation uses existing Office permissions, storage, immutable versions and engine.

## Verification

- PASSED: API build; Web production build, TypeScript and lint (existing register effect/image warnings remain).
- PASSED: Web unit 18/18; API unit 24 passed, 4 skipped; real nonprivileged PostgreSQL/WebSocket integration 35/35.
- PASSED: blank template OOXML validation, concurrent idempotent creation, conflicting retry, forged organization, restricted READ ceiling, last-editor metadata and board source import.
- PASSED: local unified browser journey and local blank Office routing/roles/isolation. Local Office used an explicitly labelled engine stub; this does not prove native editing.
- PASSED ONLINE: `tests/browser/workspace-hub.spec.cjs`, 2/2, 3.8 minutes. Created rich text/Markdown/board; imported .md/.mmd; searched and filtered; verified date/editor/roles, project and legacy routes, mobile navigation. Created blank DOCX/XLSX/PPTX through shared UI and opened each in actual native Office engine iframe. Three independent account sessions verified EDITOR, VIEWER, save refusal, revocation, de-duplication, restricted file filter and forged tenant refusal.
- PASSED ONLINE: Mermaid two-user editing, comments, SVG export and recent list via `figma-layout.spec.cjs` after exact-label selector update.
- Initial supplemental Markdown/Mermaid test attempt FAILED at ambiguous `所属项目` selector after adding a project filter. Updated exact selection; project-scoped import asserts the locked project rather than trying to change it. No production permission/quota weakening.
- PASSED: downloaded Word checkpoint contains both real users' edit markers in OOXML (not merely an HTTP response).

## Release and rollback

Source `70f7cebcbc8533bda106198177b335697f8a84b0`; GitHub CI run 40090126663 SUCCESS. Follow-up `51ba3e5` contains selector corrections and excludes a concurrently developed unfinished assistant menu from the release; its working source is preserved.

API `collabspace-api:r20261024-03`, image `sha256:63cdb32b1db92a8061c4283bcd0744e5b887d9185cc04b7ed514cf02911147aa`. Only API recreated. WS remains r20261024-02/schema4/image e4862c6eb6ef3e283dee9a85ae287d1c9d6a6dd76221642bc02d0db9a279c307. No dependencies or database migrations added to production. Bounded overlay includes compiled controllers, store modules and validated blank OOXML templates; other workspace features excluded.

Pre-release DB backup `/opt/collabspace/shared/before-r20261024-03.dump` 1,074,428 bytes; attachment archive 157,645 bytes; pg_restore catalog validated. NOT_RUN: full restore rehearsal. Private environment backup retained. Server had 9.3GB free. First pre-switch gate failed because deployment script passed a filename instead of extension to template validation; corrected script passed, prior services stayed untouched until checks succeeded.

Initial frontend candidate dpl_4t3qvxCkVmXkvjWs5rjrdcQ82SDB was promoted and used for above online acceptance. Final navigation-only frontend recorded below after readiness and smoke verification.

Rollback API to prior compatible image with prior compose/env; keep database/files and schema4 WS. Never downgrade WS/frontend to schema3 after formula writes. Office engine/license and provider credentials unchanged.

## Boundaries

NOT_RUN: full Microsoft desktop round-trip matrix, newly repeated Excel/PPT simultaneous-edit/save regression, broad browser compatibility/HA/load tests. Native open of all three formats is verified; this iteration does not expand Office engine functionality or promise Office offline editing. Existing offline document behavior preserved. Disk write followed by uncertain transaction failure can leave a small unreferenced object; no blind deletion. Physical Office first-open still requires uploader and canonical document grants. Ordinary attachments remain under Attachment Management.

Screenshots: [desktop](unified-workspace-20261024.png), [mobile](unified-workspace-mobile-20261024.png). Synthetic acceptance resources remain in demo project; no unrelated projects removed.

## Final acceptance

- PASSED ONLINE: Word native three-account regression, 1/1 (4.5 minutes): actual owner/peer writes and revision 2 persistence, viewer refusal, revoked engine blocked despite suppressed app heartbeat, private history copy and reload. Both markers found in downloaded OOXML.
- PASSED ONLINE: full Markdown source import, safe GFM/Mermaid preview, two-editor convergence, offline export/reconnect, comments and private history copy (1.5 minutes). The previous retry also exposed an obsolete `/files` Markdown link assertion; moved test to the unified scoped list and injected one list failure, then verified the real Reload action recovers it.
- Final frontend: source `51ba3e5b2584d821d63bd11cdac60b530f17e371`, CI 40090985527 SUCCESS, Vercel `dpl_DMkjtTz24PQUw72Q4cgsfGBhJ7WX`, https://collabspace-1jzytn6f5-purelamp.vercel.app, promoted to https://collabspace.purelamp.uk. Backend source remains 70f7ceb; follow-up production code change only removes unfinished navigation item.

Final promoted frontend smoke: Markdown + unified workspace 2/2 PASSED (2.6 minutes); final desktop/mobile screenshots replaced from this run. Workspace contains separate in-progress assistant/mail edits; they were preserved and excluded from this release. Local shared services left running for that development; no unrelated processes stopped.
