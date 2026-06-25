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
| `/ark backup` | Create a manual backup when the panel supports it. | Requires admin role, audit log. |
| `/ark rollback time:<duration>` | Pick the best backup at or before a requested time. | Requires admin role and button confirmation. |
| `/ark restart` | Restart after a confirmation flow. | Requires admin role and button confirmation. |

## Setup

```bash
npm install
cp .env.example .env
npm run register
npm run dev
```

Use `SERVER_PROVIDER=mock` until Legion Hosting's panel/API details are confirmed.

## Design Notes

The hosting company integration is behind `ServerProvider`. That keeps Discord command flows stable even if Legion Hosting uses a custom panel, TCAdmin, Pterodactyl, FTP/SFTP backups, or only RCON access.

Rollback is treated as destructive. The bot should always:

1. Resolve the target backup.
2. Show exact snapshot metadata.
3. Require a short typed confirmation token.
4. Announce downtime before restore.
5. Record who requested the operation and what was restored.

## Open Questions

- Does Legion Hosting expose an official customer API?
- What panel do they use for ARK: Survival Ascended?
- Are backups available through API, panel-only actions, FTP/SFTP, or manual support?
- Is RCON enabled and reachable from the bot host?
- Does restore require the server to stop first, and how long does it take?
