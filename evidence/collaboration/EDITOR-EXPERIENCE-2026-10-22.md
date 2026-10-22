# Editor experience acceptance — 2026-10-22

## Release

Code a80462eae3a69d9e9ad7c9534c7244c0959d55f5, pushed private chenhynju/collabspace. Frontend https://collabspace.purelamp.uk promoted to dpl_6gScjDqsYRScaR3j2swdrJbyYSLp (collabspace-hr9b1pgth-purelamp.vercel.app). API r20261022-03, WS r20261022-02. No schema migration.

Live API image 2dd7ab2cf41d1dfcae6b213e41a42ada328375ad4acc057516c067a7ac3d3c87. Live store SHA256 e47e7a600f9755c1b80ab4928472f5f23e8b0ee42b2c54238e41d176c89989ec equals committed source. API/WS/PG/Redis healthy; ~1.2GB disk free /98% used. Bounded before-r03 DB dump 913420 bytes (catalog checked), uploads archive 157640 bytes and private environment snapshot retained. Full restore NOT_RUN; r02 retained for rollback.

Full image built on new server. Slow full-image transfers cancelled. Final production image uses a bounded source-only overlay on existing base: <128KB context, no network/install/compilation, 128MB memory limit, >1GB free-space gate. No unrelated cleanup.

## PASSED

- Real nonprivileged PG/Yjs/WS regression 32/32, including last-editor identity and tenant isolation. Web tests 8/8 including yyyy-mm-dd timezone boundary. TypeScript and Windows frontend build passed with isolated .next-editor-polish; initial old .next EPERM was an environment failure.
- Code CI success: https://github.com/chenhynju/collabspace/actions/runs/39797075986 . Vercel build/lint/types passed (existing img performance warning).
- Four production UI journeys: collaboration hub, project design/board list, files and native Office/history. Final screenshots wait for actual resource responses.
- Native spreadsheet bottom + adds sheet: downloaded workbook has 3 sheets vs baseline2. Baseline!F2 stores =VLOOKUP(2,A2:A3,1,FALSE), cached result2. Actual downloaded OOXML parsed with openpyxl.
- Native PPT: drag rectangle; Insert → Image → local file chooser uploads article.png. Downloaded slide1 XML has 2 pictures +2 shapes vs baseline1+1. Actual operations/save/download, not toolbar-only proof.
- Distinct accounts: member edits and saves synthetic spreadsheet; owner files listing resolves lastEditor to member 陆小鹿 at confirmed revision4, saved2026-10-22T14:54:19.019Z. Subsequent close-save revision5 and same author appear in Files screenshot.

## Boundaries / failed attempts

Legacy .xls unsupported; convert to .xlsx. No claim of all formulas or full Microsoft compatibility. Old version authors were not recorded: display 历史作者未记录. Unknown/ambiguous signed identities remain unknown. Office edit date is confirmed save date; plain attachments use upload author/date.

Initial DB startup was inaccessible from the test execution environment (18 timeouts); restarted same persistent isolated DB in permitted environment, then32/32 passed; no reset/reseed. One PPT ready wait timed out240s; state subsequently CLOSED/error=null/revision1. Stable-release retry inserted shape/image successfully. Harness duplicate hidden toolbar/sheet locators and pending promise errors corrected before final success. These failed attempts are retained in ignored local logs; not counted as passes.

NOT_RUN: desktop Microsoft roundtrip for these new samples, all-browser/mobile coverage, load/HA, full offline Office. Browser acceptance disables HTTP2/QUIC as before; no network reliability claim.

Screenshots: editor-experience-{hub,design,files,office}-2026-10-22.png; editor-metadata-peer-2026-10-22.png; editor-ppt-image-menu-2026-10-22.png; editor-ppt-inserted-2026-10-22.png. Private credentials/raw logs/test files remain ignored under .test-runs.
