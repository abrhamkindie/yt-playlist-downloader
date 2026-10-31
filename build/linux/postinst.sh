#!/bin/bash
# Post-install script for StreamPull .deb package.
# Fixes Chrome sandbox permissions so Electron doesn't abort on launch.
set -e

INSTALL_DIR="/opt/StreamPull"

if [ -f "$INSTALL_DIR/chrome-sandbox" ]; then
    chown root:root "$INSTALL_DIR/chrome-sandbox"
    chmod 4755 "$INSTALL_DIR/chrome-sandbox"
fi

# Also fix the helper binary if present (newer Electron versions)
if [ -f "$INSTALL_DIR/chrome_crashpad_handler" ]; then
    chmod 755 "$INSTALL_DIR/chrome_crashpad_handler"
fi

exit 0
