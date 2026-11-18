# Delivery and verification matrix

Status as of 2026-11-10. “API tested” refers to automated tests against actual PostgreSQL and HTTP, not a claim of full browser/device acceptance.

| Requested scenario | Implemented / verified | Remaining validation |
|---|---|---|
| 1 Register online with photo | Registration and protected photo upload API tested; UI wired | Real camera/browser end-to-end |
| 2 Second authorized user sees record | Separate viewer session reads synchronized asset in integration test | Two physical devices |
| 3 Offline registration/location/photos | Encrypted IndexedDB records/queue, image capture and queue implemented | Android camera offline |
| 4 Offline restart survival | Vault lock/reopen and queue persistence tested with fake IndexedDB | Browser termination/restart/storage eviction |
| 5 Reconnect without duplicates | Operation receipt and media replay API tested; queue replay tested | Network interruption at every commit boundary |
| 6 Conflicting disconnected edits | 409 current revision, preserved queue, per-field dialog | Full two-browser disconnected workflow |
| 7 Custom category พระเครื่องโบราณ | API + offline storage tests | UI acceptance |
| 8 Hierarchical location and movement | API-tested nested location and reasoned transfer | UI acceptance |
| 9 Movement/edit history | API tests verify retained history | None for basic API path |
| 10 Search/filter thumbnail registry | UI code implements search/type/category/location/status, sort/page/select, optional value column | Mobile card view/date filter pending; current mobile table scrolls |
| 11 Official PDF/XLSX | Draft PDF/XLSX renderer and preview implemented; real files generated and structurally tested | Recipient validation; not approved official exports |
| 12 Source template fidelity | Ten columns, three-column disposal group, identifiers, BE dates; generated PDFs rendered and compared | Paper size, continuation-page borders, XLSX physical print and recipient sign-off |
| 13 Offline inventory | Basic whole-register session and result/note editing; API persistence | Scoped sessions, photo-linked count evidence, discrepancy export, full browser acceptance |
| 14 Unauthorized disposal/other temple | Viewer edits denied; direct disposal denied for all; cross-tenant record/media checks tested | Approver workflow is not enabled |

Additional implemented Phase 1: real salted password hashes, opaque session cookies, custom field definitions, typed relational projections, separate official fields, private PDF document attachment, photo captions, primary photo selection, standard JSON export, five demo assets, setup/deployment/backup documentation.

Implemented next increment: draft versioned PDF/XLSX registers, photo catalog PDF, XLSX/CSV import preview/mapping/validation and atomic local queue. Deferred: official template approval, disposal approval, legal transfer handling beyond prohibiting direct disposal, production cloud object storage, complete admin console, background sync while the browser is closed, incremental sync, advanced column customization and mobile cards. Some schemas exist for later phases; they are not presented as completed workflows.

Browser QA limitation: browser automation host was unavailable; native Chrome observation did not reliably match the requested navigation while the desktop was active. Visual application QA and Android device tests are therefore not claimed. Build and HTTP readiness checks passed; do not equate these with verified visual layout.
