# Editing experience — 2026-10-22

Office uses the complete native ONLYOFFICE ribbon, not a reduced cell/text wrapper. Supported upload/edit formats remain .docx/.xlsx/.pptx; legacy .xls requires conversion first. Spreadsheet sheets use the bottom + control; formulas may be entered in cells or the formula bar (e.g. VLOOKUP). Presentation images/shapes/text boxes use Insert. Viewer permissions intentionally disable mutation.

UI: consistent collaboration/project document/design-space cards, larger Office canvas, collapsible tool guide. Preserve existing resource routes and access checks. History dates and file saved dates use Asia/Shanghai yyyy-mm-dd, independent of browser locale. Files table scrolls horizontally on small screens.

Metadata: Files list returns current Office revision and confirmed version created_at, never the mutable session/heartbeat updated_at. For new successful callbacks, the signed users array containing exactly one engine identity is resolved through organization/document/generation-scoped editor/owner leases to the server-owned user record. Save audit records persist this lastEditor atomically with the version. Unknown/ambiguous identities remain null; old versions without the field display 历史作者未记录 rather than attributing edits to the uploader or checkpoint requester. Initial uploads use upload author/date. Failures, quarantine and duplicate callbacks do not create new confirmed metadata. Existing project/document ACL and tenant RLS remain authoritative; no schema migration.

Verification and release status: see evidence/collaboration/EDITOR-EXPERIENCE-2026-10-22.md.
