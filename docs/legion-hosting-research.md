# Legion Hosting Research

## Current Finding

Legion Hosting's ARK: Survival Ascended page is at `https://legionhosting.net/gservers/ark-survival-ascended?language=english`. Public marketing copy lists:

- Full API access for automation/integration.
- Live console support.
- Scheduled restarts, backups, and commands.
- File manager and database manager access.

Live validation confirmed Legion Hosting GPanel is reachable at `https://gpanel.legionhosting.net` and accepts Pterodactyl-style client API requests for server resources, console commands, power actions, and file-manager operations.

The normal rollback path should use ARK save files under `ShooterGame/Saved/SavedArks/<map>` rather than full panel backups. Panel backups are large full-server/container backups and are not the same thing as timestamped ARK world snapshots.

## Likely Integration Paths

1. **GPanel/Pterodactyl Client API**
   - Validated path for status, power, console commands, and file-manager access.
   - File-manager APIs can list timestamped `Ragnarok_WP_*.ark` / `.arkrbf` snapshots, download selected files, and write the live map file during restore.

2. **RCON + SFTP/FTP**
   - RCON can handle status-ish commands, broadcasts, save commands, and some admin utilities.
   - SFTP/FTP can inspect or copy backups if the host exposes backup folders.
   - Restore is currently handled through GPanel file-manager APIs instead.

3. **Full Panel Backups**
   - Useful as a broad safety net.
   - Too large and coarse for normal Discord rollback UX.
   - Not the same inventory as ARK's own `.ark`, `.arkprofile`, `.arktribe`, `.profilebak`, or `.tribebak` files.

## Validation Checklist

- Log into Legion Hosting and create a Client API key.
- Check account/server settings for API key permissions.
- Check whether ARK save snapshots are visible, downloadable, and restorable from `ARK_SAVE_DIR`.
- Check whether restore can target a specific timestamp.
- Check whether RCON host/port/password are available.
- Check whether FTP/SFTP credentials expose saved worlds and backup snapshots.

## Recommendation

Use the Pterodactyl-compatible provider for Legion Hosting GPanel. Keep rollback focused on map `.ark` snapshots first. Treat player `.arkprofile` / `.profilebak` restoration as a separate future workflow because it has different ownership and identity risks.

## Source Notes

- Legion Hosting ARK: Survival Ascended page: `https://legionhosting.net/gservers/ark-survival-ascended?language=english`.
- Pterodactyl Client API documents bearer-token auth, server resources, power actions, console commands, and file operations: `https://pterodactyl-panel.mintlify.app/api/client/files`.
- File rollback uses:
  - `GET /api/client/servers/{server}/files/list`
  - `GET /api/client/servers/{server}/files/download`
  - `POST /api/client/servers/{server}/files/write`
