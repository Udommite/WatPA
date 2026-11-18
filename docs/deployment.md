# Deployment, security gates, and recovery

## Local/pilot server

`npm ci`, create `.env` from the example or `npm run setup:local`, seed, build, and start. The server listens on 127.0.0.1:3100. Embedded PostgreSQL persists under `data/postgres`; private media under `data/objects`. A single server can serve multiple authenticated clients through an HTTPS reverse proxy, while the embedded engine has one owning process.

Use a persistent volume, encrypted OS disk, dedicated service account, process supervision, and restricted filesystem ACLs. Never serve `data/`, `.env`, or the repository root as static files. Only `dist/` is public. Run behind a TLS reverse proxy and set `COOKIE_SECURE=true`. Do not enable permissive CORS. Android camera and service workers require a secure context; localhost is only a development exception on the same machine.

Example Caddy configuration on the same host:

```caddy
assets.example.org {
    reverse_proxy 127.0.0.1:3100
}
```

Replace the example domain with one controlled by the temple and configure DNS. Start the application as a Windows service or Linux systemd unit with its working directory set to the checkout. Keep logs private. Deployments were not performed or externally verified during this implementation.

## External PostgreSQL

Set `DATABASE_URL` to an authorized PostgreSQL database connection using TLS with certificate verification. The Node `pg` pool replaces PGlite automatically. Apply migrations with a migration role; before a production launch, extract automatic startup DDL/backfill into a separate migration job and use a restricted runtime role. Policies use transaction-local `app.temple_id`. Verify RLS under the actual runtime role: table owners/superusers bypass standard RLS. Do not use a database administrator or a publicly exposed direct client credential as a substitute for tenant authorization.

Current object files are a private filesystem store. For horizontally scaled hosting, implement a shared private S3-compatible store, presigned read URLs after authorization, upload checksum verification, quotas, and lifecycle policies. Do not deploy multiple hosts with independent object directories.

## Backup

1. Verify all devices have synchronized. Unsynchronized encrypted device queues are not present in central backups.
2. For embedded mode, stop the service cleanly; take a consistent encrypted backup of the entire `data/` directory, preserving both `postgres/` and `objects/`. Never copy a running embedded database as if it were a consistent snapshot.
3. For external PostgreSQL, use `pg_dump --format=custom` or managed point-in-time recovery, and coordinate the private object-store backup/versioning. Preserve migration version and deployed application source/lockfile with the backup.
4. Retain multiple encrypted generations off-host. Record checksums and restrict recovery keys to authorized administrators. Never include backups in Git or public hosting.

## Restore rehearsal

Stop a separate test instance. Restore the database and matching media into an empty data volume. Start the same application version and verify: temple/member counts; sample asset revisions; nullable prices; primary images/documents; audit and movement histories; tenant isolation; and a new idempotent mutation. Revoke old sessions after a security incident. A JSON analysis export omits binaries, authentication state, and operation history and is NOT a restorable system backup. No real production restore rehearsal has been completed here.

## Release gates

- Independent security review, non-owner RLS tests, dedicated migration job, deployment TLS verification, rate/size limits and resource quotas for media.
- Password reset + vault key-rotation/recovery, MFA/device session listing/revocation, full membership-change audit, multi-temple switcher, super-admin tenant console.
- Browser-level Windows/Android offline restart, camera/gallery, service worker update, multi-tab concurrency, storage eviction and quota recovery tests.
- Storage adapter, checksum/object cleanup, malware scanning for uploaded PDFs, primary thumbnail serving, and approved original-retention policy.
- Cursor-based/paginated sync and scale testing. One in-flight edit per asset is an MVP restriction.
- Complete approval/disposal workflow and recipient validation of draft PDF/XLSX templates. Import mapping and photo catalog are implemented but still require browser/device acceptance.
- At implementation time, npm audit still reported seven low/moderate findings, including transitive ExcelJS/uuid and build-tool findings in Workbox/glob/minimatch/deepmerge after the compatible fix command. No high or critical findings remained. Recheck the lockfile before release; do not assume build-time findings are permanently irrelevant.
