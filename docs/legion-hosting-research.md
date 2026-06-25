# Legion Hosting Research

## Current Finding

No reliable public API documentation was found from the current workspace searches. Treat Legion Hosting as an unknown provider until we confirm the actual customer panel and access methods from the account.

## Likely Integration Paths

1. **Official API**
   - Best case: token-based API for status, backups, restore, restart, and console/RCON.
   - Cleanest bot implementation.

2. **Panel API**
   - Many game hosts run Pterodactyl, TCAdmin, or a custom panel.
   - If the panel exposes an API token page, the bot can wrap that provider-specific API.

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

Build the Discord command layer now against `ServerProvider`, then implement the real provider after one account-level discovery pass. Do not enable real rollback automation until restore semantics are confirmed.
