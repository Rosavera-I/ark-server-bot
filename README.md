# ark-server-bot

Discord bot for trusted friends administering an ARK: Survival Ascended server.

The first version is intentionally small:

- Discord slash commands with role-gated destructive actions.
- A provider interface for GPanel/Pterodactyl and RCON operations.
- A mock provider for local testing before wiring real Legion Hosting access.
- Safety prompts for rollback, restart, restore, broadcast, and RCON-style commands.

## MVP Commands

| Command | Purpose | Safety |
| --- | --- | --- |
| `/ark status` | Show server state, players, and provider capabilities. | Read-only. |
| `/ark validate` | Check provider credentials and reachable operations. | Read-only. |
| `/ark backup` | Create a manual ARK save snapshot from the live map file. | Requires admin role, audit log. |
| `/ark backups` | List recent ARK save snapshots and copy exact filenames. | Requires admin role. |
| `/ark restore backup_id:<filename>` | Restore a specific ARK save snapshot filename. | Requires admin role and button confirmation. |
| `/ark rollback time:<duration>` | Pick the best ARK save snapshot at or before a requested time. | Requires admin role and button confirmation. |
| `/ark restart` | Restart after a confirmation flow. | Requires admin role and button confirmation. |
| `/ark broadcast message:<text>` | Send a short message to online players. | Requires admin role, audit log. |
| `/ark save` | Trigger `SaveWorld`. | Requires admin role, audit log. |
| `/dino-wipe` | Run `DestroyWildDinos` after confirmation. | Requires admin role and button confirmation. |

## Setup

```bash
npm install
cp .env.example .env
npm run validate:provider
npm run register
npm run dev
```

For Legion Hosting GPanel, use `SERVER_PROVIDER=pterodactyl` with `PTERODACTYL_BASE_URL=https://gpanel.legionhosting.net`.
Set `ARK_ADMIN_ROLE_IDS` before inviting the bot broadly; destructive commands fail closed when no admin role is configured.

## Provider Modes

### `mock`

Local dry-run mode. Use this while registering Discord commands and testing role permissions.

### `pterodactyl`

Use this for Legion Hosting GPanel's Pterodactyl-compatible client API. Configure:

- `PTERODACTYL_BASE_URL`
- `PTERODACTYL_API_KEY`
- `PTERODACTYL_SERVER_ID`
- `ARK_SAVE_DIR`
- `ARK_MAP_NAME`

The bot uses the Pterodactyl client API for resources, power actions, file-manager save snapshots, binary file restore, and console commands. Normal rollback restores timestamped ARK map files such as `Ragnarok_WP_03.07.2026_14.47.11.ark`, not full panel backups.

### `rcon`

RCON is optional for the Legion Hosting setup because GPanel already handles power, console commands, file-manager snapshots, and rollback. Add RCON when you want better live game-state checks, especially accurate online player lists from `ListPlayers`.

Configure:

- `RCON_HOST`
- `RCON_PORT`
- `RCON_PASSWORD`

`RCON_PASSWORD` is usually the ARK `ServerAdminPassword`.

For Legion Hosting, two things must match:

1. `GameUserSettings.ini` must enable RCON:

   ```ini
   RCONEnabled=True
   RCONPort=<allocated-rcon-port>
   ServerAdminPassword=<same password used in .env>
   ```

2. GPanel must expose that same RCON port in the **Network** tab.

If the config says `RCONPort=37015` but GPanel only shows a different default/game allocation, external RCON clients will fail with `ECONNREFUSED`. Add or request a dedicated RCON allocation, set `RCONPort` to that allocated port, restart the ARK server, then update `.env`.

## Legion Hosting Discovery Checklist

Before enabling real rollback automation:

1. Log in to the actual Legion Hosting customer panel.
2. Identify whether the panel is Pterodactyl, TCAdmin, or custom.
3. Confirm whether an API/application token can be created.
4. Confirm ARK save snapshots are visible in `ARK_SAVE_DIR`.
5. Confirm whether restore requires stopping the ARK server first.
6. Run `/ark validate` with the real provider configuration.

Use `docs/live-validation-runbook.md` for the step-by-step live server validation sequence.

## Design Notes

The hosting company integration is behind `ServerProvider`. That keeps Discord command flows stable even if Legion Hosting uses a custom panel, TCAdmin, Pterodactyl, FTP/SFTP backups, or only RCON access.

Rollback is treated as destructive. The bot should always:

1. Resolve the target ARK save snapshot.
2. Show exact snapshot metadata.
3. Require requester-only button confirmation.
4. Announce downtime before restore when broadcast support is enabled.
5. Preserve the current live `.ark` as a timestamped safety file before overwrite.
6. Record who requested the operation and what was restored.

## Open Questions

- Is RCON enabled and reachable from the bot host?
