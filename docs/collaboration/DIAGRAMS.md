# Diagram workspace — flowcharts and mind maps

The collaborative whiteboard is being extended into an editable diagram workspace. References: [draw.io connectors](https://www.drawio.com/docs/manual/connectors/), [Mermaid flowcharts](https://mermaid.js.org/syntax/flowchart.html), [Mermaid mind maps](https://mermaid.js.org/syntax/mindmap.html). These are interaction and interchange references, not a claim of file-format or feature parity.

## Product contract

- Flowcharts: rectangle, ellipse and decision diamond; node-bound labeled connectors with straight, orthogonal or curved paths. Endpoint geometry follows node movement/resize, including local drag preview. Templates are additive. Grid snapping is optional. Double click focuses the text property editor.
- Mind maps: root, child and sibling topics; Tab/Enter when the canvas is focused; explicit deterministic tree layout; parent connections rendered from current geometry. Deleting a parent keeps child content as orphan roots. This prevents implicit loss of a collaborator's branch; it is not recursive deletion.
- Mermaid source: bounded basic flowchart LR/TD/TB and indentation-based mindmap. Parse and preview entirely before an explicit additive CRDT commit. Unsupported syntax fails visibly and cannot partially mutate the shared board. Export preserves text/topology, not coordinates/styles. No subgraph, arbitrary Mermaid directives, HTML, links, plugins or code execution. Standalone legacy arrows cannot be exported as graph edges without binding, so export refuses rather than silently omitting them.
- SVG export captures the visible document content without transient cursors/resize handles. JSON draft export remains available. No raw SVG/XML import.

## Model and safety

Optional properties extend the existing bounded shape schema: type diamond/mind/connector; parent UUID for a mind topic; atomic binding {from,to,style} for a connector. Existing objects remain valid. No database migration or parallel room service. Server validation rejects wrong property/type combinations, self-links, connector endpoints referring to other connectors, cyclic/non-mind parent chains, malformed UUIDs, excessive size and unsafe values. Missing endpoints after concurrent deletion are allowed but links are hidden; deleted content is not resurrected.

Each topic and connector stays a nested Y.Map in the same Y.Doc. Text/geometry/binding remain independently mergeable properties; atomic geometry/binding avoids mixed coordinates/endpoints. Same-property concurrency follows Yjs ordering. Layout is an explicit user edit under local UndoManager origin, not a server process continuously overriding collaborator movement. User undo excludes remote edits. A fresh version copy keeps intra-board references while cloning into a new CRDT lineage; ACL and revocation stay in the existing Store.

Backend schema support must ship before frontend support. Already-open old frontends need reload to render the new shape types; they do not replace the shared state. Preserve document collaboration, tenant isolation and durable commit-before-ACK tests.

## Acceptance

DG01: two editors and a viewer; import flowchart only after preview, bind/move nodes, verify live remote path updates and no viewer mutation.
DG02: create mind template/child/sibling, deterministic layout; concurrent remote edit plus offline branch, reconnect, own undo/redo, reload consistency.
DG03: invalid Mermaid does not mutate; Unicode/special label export/import retains semantics; bounded cycle handling; SVG file contains current text without transient UI.
DG04: existing document/board/version/tenant/ACK/revocation business journeys remain valid. Results and exact tested source belong in evidence, not inferred from this design.

## Deliberate boundaries

This is not full draw.io/Visio or full Mermaid compatibility. No .drawio/.vsdx import, custom waypoints/ports, obstacle-avoiding routing, layers, swimlanes, BPMN/UML libraries, arbitrary grouping, rich HTML labels or collapsible/reparentable mind branches yet. Basic layout may overlap on very large/deep diagrams; maximum 500 objects and original coordinate limits remain. No new capacity or multi-instance claim.
