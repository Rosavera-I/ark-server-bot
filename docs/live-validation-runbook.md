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

## 2. Confirm the Hosting Panel and Save Folder

In the Legion Hosting customer panel, record:

- Panel name and version, if visible.
- API key/token location and permission scopes.
- Server identifier used by the panel API.
- ARK save folder path, map name, and live `.ark` filename.
- Whether restore requires the server to stop first.
- RCON host, port, and password availability.

For Legion Hosting GPanel, the validated API host is `https://gpanel.legionhosting.net`.

## 3. Read-Only Provider Check

For a Pterodactyl-compatible panel:

```bash
SERVER_PROVIDER=pterodactyl npm run register
SERVER_PROVIDER=pterodactyl npm run dev
```

Verify:

- `/ark validate` returns server state and visible ARK save snapshot count.
- `/ark status` returns panel state.
- `/ark backups` lists expected `Ragnarok_WP_*.ark` / `.arkrbf` snapshots and exact filenames.

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
- Run `/ark backup label:"discord validation snapshot"`.
- Confirm the new timestamped snapshot appears in `/ark backups`.

Stop here if the server has active players or unknown restore semantics.

## 5. Restore Drill

Run this only during an agreed maintenance window:

1. Warn players in Discord and in-game.
2. Run `/ark save`.
3. Run `/ark backup label:"pre-restore drill"`.
4. Confirm the snapshot exists in `/ark backups`.
5. Restore only that known-safe snapshot with `/ark restore backup_id:<filename>`.
6. Confirm server state, world load, and player ability to join.

If restore fails, do not retry blindly. Check the panel activity log and the timestamped `discord-restore-safety-*.ark` file preserved beside the live save.

## 6. Rollback Enablement Criteria

Treat `/ark rollback` as ready only when all are true:

- Save snapshot timestamps are accurate enough for the group's expected rollback windows.
- Restore from an exact snapshot filename has been tested once.
- Stop-before-restore and start-after-restore settings match the panel behavior.
- Admin role IDs are configured.
- Audit channel delivery is confirmed.

