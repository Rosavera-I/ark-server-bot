# Legion Hosting Research

## Current Finding

Legion Hosting's ARK: Survival Ascended page is at `https://legionhosting.net/gservers/ark-survival-ascended?language=english`. Public marketing copy lists:

- Full API access for automation/integration.
- Live console support.
- Scheduled restarts, backups, and commands.
- File manager and database manager access.

That is enough to keep the bot API-first, but it is not enough to assume an exact API shape. Treat Legion Hosting as an API-capable provider with account-specific discovery still required.

## Likely Integration Paths

1. **Official API**
   - Best case: token-based API for status, backups, restore, restart, and console/RCON.
   - Cleanest bot implementation.
   - Public Legion Hosting copy says API access exists, but does not publish endpoint details on the game page.

2. **Panel API**
   - Many game hosts run Pterodactyl, TCAdmin, or a custom panel.
   - If the panel exposes an API token page, the bot can wrap that provider-specific API.
   - Pterodactyl-compatible panels expose client backup endpoints for listing, creating, downloading, deleting, and restoring backups.

3. **RCON + SFTP/FTP**
   - RCON can handle status-ish commands, broadcasts, save commands, and some admin utilities.
   - SFTP/FTP can inspect or copy backups if the host exposes backup folders.
   - Restore may still require panel access.

4. **Manual/Assisted Restore**
   - If restore is panel-only, the bot can still be valuable for backup discovery, restart/broadcast via RCON, and guided rollback runbooks.

## Validation Checklist

- Log into Legion Hosting and identify the panel name/version.
- Check account/server settings for API keys or application tokens.
- Check whether ARK backups are visible, downloadable, and restorable.
- Check whether restore can target a specific timestamp.
- Check whether RCON host/port/password are available.
- Check whether FTP/SFTP credentials expose saved worlds and backup snapshots.

## Recommendation

Build the Discord command layer now against `ServerProvider`, then validate the real provider after one account-level discovery pass. Do not enable real rollback automation until restore semantics are confirmed.

The current bot implements a Pterodactyl-compatible provider because that is a common game-panel integration path and has public client API documentation. This is a compatibility adapter, not confirmed evidence that Legion Hosting itself uses Pterodactyl. The safest first real-server test is `/ark validate` with read-only expectations, followed by `/ark backups`, before trying any restore.

If the panel is TCAdmin or custom, keep the Discord command layer unchanged and add a new provider implementation behind `ServerProvider`.

## Source Notes

- Legion Hosting ARK: Survival Ascended page: `https://legionhosting.net/gservers/ark-survival-ascended?language=english`.
- NETVPX's Pterodactyl Client API reference documents bearer-token auth, server management/power actions, file operations, and backup management availability in some installations: `https://pterodactyl-api-docs.netvpx.com/docs/api/client`.
- Pterodactyl-compatible backup list/create/restore endpoints are documented as:
  - `GET /api/client/servers/{server}/backups`
  - `POST /api/client/servers/{server}/backups`
  - `POST /api/client/servers/{server}/backups/{backup}/restore`
