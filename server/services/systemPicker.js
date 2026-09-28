const { execFile } = require('child_process');

/**
 * Open a native directory picker on Linux via zenity.
 * Resolves to { path } on success, { path: null, cancelled: true } when the
 * user cancels, or { path: null } when no picker is available.
 */
function openAppFolderPicker() {
  return new Promise((resolve) => {
    // Check availability first (throws if missing).
    try {
      require('child_process').execSync('which zenity', { stdio: 'ignore' });
    } catch {
      return resolve({ path: null });
    }

    execFile('zenity', ['--file-selection', '--directory', '--title=Select Download Folder'], (error, stdout) => {
      if (error) {
        console.log('[systemPicker] cancelled or failed:', error.message);
        return resolve({ path: null, cancelled: true });
      }
      const selected = stdout.trim();
      resolve(selected ? { path: selected } : { path: null, cancelled: true });
    });
  });
}

module.exports = { openAppFolderPicker };
