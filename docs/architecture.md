# WatAssets architecture

This repository implements the first deployable foundation, with a working early offline synchronization path. It is not a completed implementation of every phase in the product brief.

## Runtime

React + TypeScript + Vite PWA serves a Thai interface. An Express API authenticates users through bcrypt password hashes and opaque HttpOnly, SameSite=Strict session cookies. The database stores only SHA-256 hashes of session tokens. A session selects one temple membership; every request rechecks that membership. Anonymous access is not supported. No inventory is exposed through static files.

One Node process owns embedded PGlite PostgreSQL on disk for local evaluation. `DATABASE_URL` selects an external PostgreSQL server for shared deployment. Browser clients never access either database directly. Embedded mode supports concurrent HTTP clients through one serialized transaction queue, but must not run in multiple Node processes against the same database directory.

## Data model

`server/migrations/001.sql` defines tenants, users, memberships, sessions, replication envelopes, operation receipts, audit events, image/document metadata, and movement history. `002-domain.sql` adds typed relational assets, asset types, categories, category custom fields, hierarchical locations, separate official registration details, inventory sessions/items, and the schema foundation for future status/disposal/export workflows.

The `records` envelope is the sync representation. `project.ts` writes typed relational tables in the SAME transaction as the envelope, audit log, movement event, and idempotency receipt. Writes must use the API, never modify the typed projection independently. New installations backfill projections from existing envelopes on startup. Prices are nullable numeric values; quantity is strictly positive. Official registration fields are kept in `asset_registration`, apart from operational metadata.

All tenant references in normalized tables use composite `(temple_id, id)` foreign keys. The API validates category type, active references, ancestor chains, and tenant ownership before writes. Category/location cycles are rejected. Parent ordering is handled through deferred constraints. Tombstone columns are reserved; no ordinary deletion endpoint exists.

## Offline vault and synchronization

IndexedDB through Dexie persists encrypted records, operation payloads, image data, and PDF documents. AES-256-GCM uses a fresh nonce per value; PBKDF2-SHA256 with 310,000 iterations derives a memory-only key from the login password and a per-account salt. Passwords and derived keys are never persisted. Local record/queue updates are atomic IndexedDB transactions after encryption. The browser stores image/document binary content as encrypted data URLs; this has base64 overhead and should move to streaming encrypted blobs for large deployments.

An online login establishes an eight-hour offline lease. Returning users re-enter the same password to unlock. New devices require online authentication. Logout locks the vault while preserving unsynchronized edits. Password reset/key rotation recovery is not yet provided: recover and synchronize pending records before changing credentials. Local OS disk encryption and strong passwords remain important. A user controlling the device can modify its software; this application does not claim hardware-backed offline revocation enforcement.

The queue creates client UUIDs and sends one immutable operation identifier, entity ID, base revision, and desired value. The server commits the operation receipt with its transaction. Replays return the saved response; reuse with a changed payload fails. Revision mismatch returns HTTP 409 and the current record. Both versions remain encrypted locally until the user selects fields. Nested metadata is resolved as a whole field in this MVP. The server does not silently merge or overwrite stale edits. Edits to an entity with an unresolved or in-flight operation are blocked; rejected validation payloads may be corrected.

The foreground/reconnect loop authenticates, sends records, sends photographs/documents, then downloads a tenant snapshot. It retries transient failures with bounded exponential backoff. Web Locks serialize sync between tabs. A pending local record is never overwritten by snapshot download. Browser background execution after closing the app is not guaranteed and is not implemented as Background Sync; reopening/resuming performs retries. Snapshot pagination and incremental change cursors remain Phase 2 scaling work.

## Media

Images are compressed to WebP on the device, encrypted locally, and queued. Server decoding enforces a pixel limit, strips source metadata, re-encodes, and creates thumbnails. Primary image selection is versioned asset metadata. Captions accompany uploads. PDF evidence is uploaded separately without rendering it as HTML. Files reside in a private disk object namespace keyed by tenant and UUID, outside `dist`; reads always require session authorization. The current storage adapter is a private filesystem object store, not managed S3/Supabase storage. Original photographs are not retained; supporting PDFs retain their submitted bytes. An object-store adapter, signed URLs, malware scanning, quotas, and evidence-original retention policy remain production hardening tasks.

## Authorization

Temple admins manage members, categories, and locations. Managers and staff edit assets and counts. Viewers and approvers are read-only through normal mutation endpoints. Direct disposal is denied to every role; no approval workflow is faked. Super-admin membership is recognized but a cross-tenant administration console is not supplied. Tenant selection currently chooses the first active membership at login.

SQL RLS policies supplement server-side tenant predicates. The local embedded database uses its owner role, which bypasses RLS; passing API isolation tests does not certify a restricted PostgreSQL production role. Production must separate schema migration credentials from runtime credentials and verify policies with a non-owner, non-BYPASSRLS role. Startup migration/backfill currently requires the schema owner, so extracting a dedicated migration job is a release gate.

## Reporting boundary

Source transcription and scanned evidence are in `docs/regulatory-reference.md`. The UI provides draft PDF/XLSX exports with a version selector, preview and validation warnings. `shared/reports.ts` maps only the ten source columns; `src/report-engine.ts` creates files entirely on the client, with the Sarabun font and renderer chunks precached for offline use. Source structure was reviewed and generated PDF samples were rendered, but paper size, donor-value exceptions and final print fidelity still require recipient validation. The draft intentionally leaves disposal columns blank because the approval workflow is not implemented. CSV/XLSX import parses one sheet, maps fields, rejects duplicate/invalid rows, preserves unknown values, and atomically queues the entire valid batch locally. Synchronization commits each asset independently; this is not a central all-or-nothing bulk import. ZIP declared expansion, file size, row count and column count are bounded. Formula cells are rejected. Standard JSON export is functional; it is an analysis export, not a complete backup. Do not call it an approved official register or use it as a substitute for the later PDF/XLSX engine.
