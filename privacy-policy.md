# Privacy Policy — Chess Turn Reminder

_Last updated: June 20, 2026_

## Overview

Chess Turn Reminder is a Chrome extension that notifies you when it is your turn in a chess game on chess.com. This policy explains what data the extension accesses and how it is handled.

## Data collected

**No personal data is collected, stored, or transmitted.**

The extension does not collect, share, or send any information to external servers. All processing happens locally in your browser.

## What the extension accesses

| What | Why |
|---|---|
| chess.com game pages | To detect whose turn it is by reading the page's DOM |
| Browser window state | To open and manage the alert popup window |
| Local extension storage | To remember the position of the popup window between turns |

## Data storage

The only data written to storage is the screen position (x, y coordinates) of the alert popup window. This is stored locally using the Chrome extension storage API and never leaves your device.

## Third-party services

This extension does not communicate with any third-party service. It only reads the chess.com page you are already visiting.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Save and restore the popup window position |
| `host_permissions` on chess.com | Read the game page DOM to detect your turn |

## Changes to this policy

If this policy changes, the updated version will be committed to this repository with a new date above.

## Contact

For questions, open an issue at [github.com/ettomarett/chessstay](https://github.com/ettomarett/chessstay).
