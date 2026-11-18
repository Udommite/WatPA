# Verification result — 2026-11-10

- `npm test`: 16 tests passed, zero failures.
- `npm run build`: TypeScript check and Vite production/PWA build passed.
- Running production app and service worker responded HTTP 200 on localhost:3100.
- Server restarted successfully using the persistent seeded database after relational migrations.
- No high/critical npm audit findings after upgrading Sharp and Zod. Seven low/moderate findings remain (ExcelJS/uuid and build tools); see deployment release gates.
- Real browser visual inspection, Android camera testing, external PostgreSQL runtime-role RLS, managed object storage, recipient approval of official templates, XLSX physical printing, and production restore were not verified. Draft PDF outputs were rendered and visually inspected; both 30-record samples span six pages with repeated headers.

Test coverage: unauthenticated/CSRF rejection; custom category/location persistence; registration with nullable value; operation replay and changed-payload rejection; second-user visibility; revision conflict preservation; viewer/tenant authorization; private/idempotent photographs and PDF evidence; transfer reason/history; category cycle and duplicate-code rejection; inventory completion validation; permission revocation; encrypted IndexedDB vault, wrong password, lock/reopen, queued reconnect and replay.

Additional coverage: source-form mapping, donation price suppression, 10-column XLSX structure and merged groups, real PDF generation, invalid dates and duplicates in imports, and atomic import rollback/persistence in encrypted IndexedDB.

The client PDF bundle was also exercised directly: it generated a valid PDF using the local Thai font, then generated another while network fetch was disabled. This verifies renderer/font reuse, not a complete real-browser service-worker restart scenario.
