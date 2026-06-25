# Live Server Validation Runbook

Use this before enabling real Legion Hosting rollback or restore actions.

## 1. Start in Mock Mode

```bash
SERVER_PROVIDER=mock npm run register
SERVER_PROVIDER=mock npm run dev
```

Verify in Discord:

- `/ark status`
- `/ark validate`
- Role-gated commands reject non-admin users.
- Confirmation buttons only work for the requester.

## 2. Identify the Hosting Panel

In the Legion Hosting customer panel, record:

- Panel name and version, if visible.
- API key/token location and permission scopes.
- Server identifier used by the panel API.
- Backup list, create, and restore controls.
- Whether restore requires the server to stop first.
- RCON host, port, and password availability.

Do not assume Pterodactyl just because the adapter exists. The adapter is a compatibility path, not confirmed Legion Hosting evidence.

## 3. Read-Only Provider Check

For a Pterodactyl-compatible panel:

```bash
SERVER_PROVIDER=pterodactyl npm run register
SERVER_PROVIDER=pterodactyl npm run dev
```

Verify:

- `/ark validate` returns server state and visible backup count.
- `/ark status` returns panel state.
- `/ark backups` lists expected backups and exact ids.

For RCON-only access:

```bash
SERVER_PROVIDER=rcon npm run register
SERVER_PROVIDER=rcon npm run dev
```

Verify:

- `/ark validate` connects.
- `/ark status` lists players or returns an empty player result.
- `/ark broadcast message:"Discord bot smoke test"` works.

## 4. Safe Write Check

Only after read-only checks pass:

- Run `/ark save`.
- Run `/ark backup label:"discord validation backup"`, if panel backups are supported.
- Confirm the new backup appears in `/ark backups`.

Stop here if the server has active players or unknown restore semantics.

## 5. Restore Drill

Run this only during an agreed maintenance window:

1. Warn players in Discord and in-game.
2. Run `/ark save`.
3. Run `/ark backup label:"pre-restore drill"`.
4. Confirm the backup exists in `/ark backups`.
5. Restore only that known-safe backup with `/ark restore backup_id:<id>`.
6. Confirm server state, world load, and player ability to join.

If restore fails, do not retry blindly. Check the panel activity log and confirm whether the server is stopped, starting, or locked by a running backup job.

## 6. Rollback Enablement Criteria

Treat `/ark rollback` as ready only when all are true:

- Backup timestamps are accurate enough for the group's expected rollback windows.
- Restore from an exact backup id has been tested once.
- Stop-before-restore and start-after-restore settings match the panel behavior.
- Admin role IDs are configured.
- Audit channel delivery is confirmed.

