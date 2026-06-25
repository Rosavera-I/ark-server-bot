# ark-server-bot

Discord bot for trusted friends administering an ARK: Survival Ascended server.

The first version is intentionally small:

- Discord slash commands with role-gated destructive actions.
- A provider interface for hosting-panel and RCON operations.
- A mock provider for local testing before wiring real Legion Hosting access.
- Safety prompts for rollback, restart, restore, broadcast, and RCON-style commands.

## MVP Commands

| Command | Purpose | Safety |
| --- | --- | --- |
| `/ark status` | Show server state, players, and provider capabilities. | Read-only. |
| `/ark validate` | Check provider credentials and reachable operations. | Read-only. |
| `/ark backup` | Create a manual backup when the panel supports it. | Requires admin role, audit log. |
| `/ark backups` | List recent backups and copy exact backup ids. | Requires admin role. |
| `/ark restore backup_id:<id>` | Restore a specific backup id. | Requires admin role and button confirmation. |
| `/ark rollback time:<duration>` | Pick the best backup at or before a requested time. | Requires admin role and button confirmation. |
| `/ark restart` | Restart after a confirmation flow. | Requires admin role and button confirmation. |
| `/ark broadcast message:<text>` | Send a short message to online players. | Requires admin role, audit log. |
| `/ark save` | Trigger `SaveWorld`. | Requires admin role, audit log. |

## Setup

```bash
npm install
cp .env.example .env
npm run register
npm run dev
```

Use `SERVER_PROVIDER=mock` until Legion Hosting's panel/API details are confirmed.

## Provider Modes

### `mock`

Local dry-run mode. Use this while registering Discord commands and testing role permissions.

### `pterodactyl`

Use this if the Legion Hosting customer panel exposes a Pterodactyl-compatible client API token. Configure:

- `PTERODACTYL_BASE_URL`
- `PTERODACTYL_API_KEY`
- `PTERODACTYL_SERVER_ID`

The bot uses the Pterodactyl client API for resources, power actions, backups, backup restore, and console commands.

### `rcon`

Use this when panel automation is not available but ARK RCON is exposed. RCON mode supports status, `SaveWorld`, broadcast, and allowlisted commands only. It cannot create or restore hosting-panel backups.

## Legion Hosting Discovery Checklist

Before enabling real rollback automation:

1. Log in to the actual Legion Hosting customer panel.
2. Identify whether the panel is Pterodactyl, TCAdmin, or custom.
3. Confirm whether an API/application token can be created.
4. Confirm backups are visible and restorable through the API, not just manually in the panel.
5. Confirm whether restore requires stopping the ARK server first.
6. Run `/ark validate` with the real provider configuration.

Use `docs/live-validation-runbook.md` for the step-by-step live server validation sequence.

## Design Notes

The hosting company integration is behind `ServerProvider`. That keeps Discord command flows stable even if Legion Hosting uses a custom panel, TCAdmin, Pterodactyl, FTP/SFTP backups, or only RCON access.

Rollback is treated as destructive. The bot should always:

1. Resolve the target backup.
2. Show exact snapshot metadata.
3. Require requester-only button confirmation.
4. Announce downtime before restore when broadcast support is enabled.
5. Record who requested the operation and what was restored.

## Open Questions

- Does the actual Legion Hosting customer panel expose an official customer API?
- What panel do they use for ARK: Survival Ascended?
- Are backups available through API, panel-only actions, FTP/SFTP, or manual support?
- Is RCON enabled and reachable from the bot host?
- Does restore require the server to stop first, and how long does it take?
