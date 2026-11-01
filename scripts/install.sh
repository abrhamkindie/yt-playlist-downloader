#!/usr/bin/env bash
#
# StreamPull installer for Linux.
#
# Picks the build that matches this machine (deb on apt systems, rpm on
# dnf/yum/zypper systems, AppImage or a plain tarball when you would rather not
# touch the system package manager), checks it against the published checksums,
# and installs it.
#
#   curl -fsSL https://raw.githubusercontent.com/abrhamkindie/yt-playlist-downloader/HEAD/scripts/install.sh | bash
#
# yt-dlp and ffmpeg ship inside the app, so nothing else is installed.
# Only x86_64 Linux builds are published today.
set -euo pipefail

REPO="${STREAMPULL_REPO:-abrhamkindie/yt-playlist-downloader}"
TAG="${STREAMPULL_TAG:-}"
FORMAT=""
DRY_RUN=0
VERIFY=1

DEB_ASSET="StreamPull-amd64.deb"
RPM_ASSET="StreamPull-x86_64.rpm"
APPIMAGE_ASSET="StreamPull-x86_64.AppImage"
TAR_ASSET="StreamPull-x64.tar.gz"
CHECKSUMS_ASSET="StreamPull-checksums.txt"
BIN_NAME="streampull"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

usage() {
    cat <<'EOF'
StreamPull installer

Usage: install.sh [options]

  --format <deb|rpm|appimage|tar>
                        Force a build format. Default: pick the one that fits
                        this system (apt -> deb, dnf/yum/zypper -> rpm,
                        otherwise AppImage, falling back to the tarball).
  --version <tag>       Install a specific release tag (for example v1.2.2)
                        instead of the latest one.
  --no-verify           Skip the published-checksum check.
  --dry-run             Resolve and report what would happen; change nothing.
  -h, --help            Show this help.

Environment:
  STREAMPULL_REPO       owner/name of the releases repository to use.
  GITHUB_TOKEN          Raises the GitHub API rate limit when it is set.
EOF
}

say() { printf '  %s\n' "$*"; }
warn() { printf '  ! %s\n' "$*" >&2; }
die() { printf 'install.sh: %s\n' "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# Commands are echoed in dry-run mode instead of executed.
run() {
    if [ "$DRY_RUN" = 1 ]; then
        say "dry-run: $*"
        return 0
    fi
    "$@"
}

# Root is only needed for the system packages. `curl | bash` leaves stdin busy
# with the script itself, so hand sudo a terminal when there is one.
run_root() {
    if [ "$DRY_RUN" = 1 ]; then
        say "dry-run: ${SUDO:+$SUDO }$*"
        return 0
    fi
    if [ -n "$SUDO" ]; then
        if [ -r /dev/tty ]; then
            $SUDO "$@" < /dev/tty
        else
            $SUDO "$@"
        fi
    else
        "$@"
    fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        --help | -h) usage; exit 0 ;;
        --dry-run) DRY_RUN=1 ;;
        --no-verify) VERIFY=0 ;;
        --format) FORMAT="${2:-}"; [ -n "$FORMAT" ] || die "--format needs a value"; shift ;;
        --format=*) FORMAT="${1#*=}" ;;
        --version) TAG="${2:-}"; [ -n "$TAG" ] || die "--version needs a tag"; shift ;;
        --version=*) TAG="${1#*=}" ;;
        *) die "unknown option '$1' — try --help" ;;
    esac
    shift
done

[ "$(uname -s)" = "Linux" ] || die "this installer is for Linux only."
[ "$(uname -m)" = "x86_64" ] ||
    die "no StreamPull build for $(uname -m) yet — only x86_64 is published."
have curl || die "curl is required to download the app."

if [ "$(id -u)" = 0 ]; then
    SUDO=""
elif have sudo; then
    SUDO="sudo"
else
    SUDO=""
fi

case "$FORMAT" in
    "" | deb | rpm | appimage | tar) ;;
    *) die "--format must be deb, rpm, appimage or tar." ;;
esac

# --------------------------------------------------------------------------
# Which release, and which asset inside it
# --------------------------------------------------------------------------
RELEASE_API="https://api.github.com/repos/$REPO/releases"
if [ -n "$TAG" ]; then
    RELEASE_API="$RELEASE_API/tags/$TAG"
else
    RELEASE_API="$RELEASE_API/latest"
fi

say "Looking up the release to install from $REPO…"
AUTH_ARGS=()
if [ -n "${GITHUB_TOKEN:-}" ]; then
    AUTH_ARGS=(-H "Authorization: Bearer $GITHUB_TOKEN")
fi
RELEASE_JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
    ${AUTH_ARGS[@]+"${AUTH_ARGS[@]}"} "$RELEASE_API" 2>/dev/null || true)"

ASSETS_FILE="$WORK/assets.txt"
: >"$ASSETS_FILE"
RESOLVED_TAG=""
if [ -n "$RELEASE_JSON" ]; then
    RESOLVED_TAG="$(printf '%s' "$RELEASE_JSON" |
        grep -oE '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' |
        head -1 | sed -E 's/.*"([^"]*)"$/\1/')"
    printf '%s' "$RELEASE_JSON" |
        grep -oE '"name"[[:space:]]*:[[:space:]]*"[^"]*"' |
        sed -E 's/.*"([^"]*)"$/\1/' >"$ASSETS_FILE"
fi

asset_url() {
    if [ -n "$RESOLVED_TAG" ]; then
        printf 'https://github.com/%s/releases/download/%s/%s' "$REPO" "$RESOLVED_TAG" "$1"
    else
        printf 'https://github.com/%s/releases/latest/download/%s' "$REPO" "$1"
    fi
}

# Prefer the API listing; when it is rate-limited or unreachable, ask GitHub
# directly whether the file exists (a 404 on the download URL means it does not).
asset_exists() {
    if [ -s "$ASSETS_FILE" ]; then
        grep -qxF "$1" "$ASSETS_FILE" && return 0
        return 1
    fi
    curl -fsIL -o /dev/null "$(asset_url "$1")" 2>/dev/null
}

# No API answer but an explicit tag from the user: still build pinned URLs.
if [ -z "$RESOLVED_TAG" ] && [ -n "$TAG" ]; then
    RESOLVED_TAG="$TAG"
fi

ASSET=""
case "$FORMAT" in
    deb) ASSET="$DEB_ASSET" ;;
    rpm) ASSET="$RPM_ASSET" ;;
    appimage) ASSET="$APPIMAGE_ASSET" ;;
    tar) ASSET="$TAR_ASSET" ;;
    "")
        if have apt && asset_exists "$DEB_ASSET"; then
            ASSET="$DEB_ASSET"
            say "apt found — installing the Debian package."
        elif have apt-get && asset_exists "$DEB_ASSET"; then
            ASSET="$DEB_ASSET"
            say "apt-get found — installing the Debian package."
        elif have dnf && asset_exists "$RPM_ASSET"; then
            ASSET="$RPM_ASSET"
            say "dnf found — installing the RPM."
        elif have yum && asset_exists "$RPM_ASSET"; then
            ASSET="$RPM_ASSET"
            say "yum found — installing the RPM."
        elif have zypper && asset_exists "$RPM_ASSET"; then
            ASSET="$RPM_ASSET"
            say "zypper found — installing the RPM."
        elif [ -e /dev/fuse ] && asset_exists "$APPIMAGE_ASSET"; then
            ASSET="$APPIMAGE_ASSET"
            say "No distro package manager — installing the AppImage for your user."
        elif asset_exists "$TAR_ASSET"; then
            ASSET="$TAR_ASSET"
            say "No distro package manager and no FUSE — unpacking the tarball for your user."
        elif asset_exists "$APPIMAGE_ASSET"; then
            ASSET="$APPIMAGE_ASSET"
            say "Installing the AppImage for your user (FUSE support looks missing; if it"
            say "will not start, re-run with: --format tar)."
        else
            die "could not find a StreamPull build to install. See $(asset_url "$DEB_ASSET")."
        fi
        ;;
esac

if ! asset_exists "$ASSET"; then
    die "$ASSET is not in this release. Try another --format, or run without --version."
fi

# --------------------------------------------------------------------------
# Download and verify
# --------------------------------------------------------------------------
URL="$(asset_url "$ASSET")"
FILE="$WORK/$ASSET"
say "Downloading $ASSET"
say "from $URL"
if [ "$DRY_RUN" = 1 ]; then
    say "dry-run: download skipped"
else
    curl -fL --retry 3 --progress-bar -o "$FILE" "$URL" || die "download failed."
fi

verify() {
    [ "$VERIFY" = 1 ] || { warn "verification skipped (--no-verify)."; return 0; }
    [ "$DRY_RUN" = 1 ] && { say "dry-run: checksum check skipped"; return 0; }

    local sums="$WORK/checksums.txt"
    if ! curl -fsSL -o "$sums" "$(asset_url "$CHECKSUMS_ASSET")" 2>/dev/null; then
        warn "no $CHECKSUMS_ASSET published for this release — cannot verify the download."
        return 0
    fi

    local want got
    want="$(awk -v f="$ASSET" '{ name = $2; sub(/^\*/, "", name); if (name == f) print $1 }' "$sums" | head -1)"
    if [ -z "$want" ]; then
        warn "$ASSET is not listed in $CHECKSUMS_ASSET — cannot verify the download."
        return 0
    fi
    if ! have sha256sum; then
        warn "sha256sum is missing — cannot verify the download."
        return 0
    fi
    got="$(sha256sum "$FILE" | cut -d' ' -f1)"
    if [ "$got" != "$want" ]; then
        die "checksum mismatch for $ASSET — refusing to install."
    fi
    say "Checksum matches the published sha256."
}
verify

# --------------------------------------------------------------------------
# Install
# --------------------------------------------------------------------------
# AppImage and the tarball run from a user directory, so the setuid sandbox
# helper that the packages fix up is not root-owned here. Electron needs either
# that helper or unprivileged user namespaces.
warn_if_sandbox_blocked() {
    local dir="$1"
    [ -f "$dir/chrome-sandbox" ] || return 0
    local restricted=0
    if [ -r /proc/sys/kernel/unprivileged_userns_clone ] &&
        [ "$(cat /proc/sys/kernel/unprivileged_userns_clone)" = "0" ]; then
        restricted=1
    fi
    if [ -r /proc/sys/kernel/apparmor_restrict_unprivileged_userns ] &&
        [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns)" = "1" ]; then
        restricted=1
    fi
    [ "$restricted" = 0 ] && return 0
    say ""
    say "This system blocks unprivileged user namespaces. If StreamPull refuses to"
    say "start, give it the sandbox helper the way the packages do:"
    say "  sudo chown root:root \"$dir/chrome-sandbox\""
    say "  sudo chmod 4755 \"$dir/chrome-sandbox\""
}

make_desktop_entry() {
    local exec_path="$1"
    local apps_dir="$HOME/.local/share/applications"
    [ "$DRY_RUN" = 1 ] && { say "dry-run: would write $apps_dir/streampull.desktop"; return 0; }
    mkdir -p "$apps_dir"
    cat >"$apps_dir/streampull.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=StreamPull
Comment=Download YouTube videos and playlists on this machine
Exec=$exec_path
Icon=streampull
Terminal=false
Categories=Utility;AudioVideo;
EOF
    have update-desktop-database && update-desktop-database "$apps_dir" 2>/dev/null || true
    say "Added a StreamPull entry to your applications menu."
}

ensure_path_note() {
    case ":$PATH:" in
        *":$HOME/.local/bin:"*) ;;
        *)
            say ""
            say "$HOME/.local/bin is not in your PATH yet — log out and back in, or add it:"
            say '  export PATH="$HOME/.local/bin:$PATH"'
            ;;
    esac
}

install_package() {
    # fpm packages need the installer to resolve dependencies from a local file.
    if have apt; then
        run_root apt install -y "./$ASSET"
    elif have apt-get; then
        run_root apt-get install -y "./$ASSET"
    elif have dnf; then
        run_root dnf install -y "./$ASSET"
    elif have yum; then
        run_root yum localinstall -y "./$ASSET"
    elif have zypper; then
        run_root zypper --non-interactive install "./$ASSET"
    else
        return 1
    fi
}

case "$ASSET" in
    "$DEB_ASSET" | "$RPM_ASSET")
        say "Installing $ASSET (this needs root; StreamPull lands in /opt/StreamPull)."
        cd "$WORK"
        if ! install_package; then
            die "no supported package manager found for $ASSET — re-run with --format appimage or --format tar."
        fi
        say "Done. Start it from your applications menu or with: $BIN_NAME"
        ;;
    "$APPIMAGE_ASSET")
        TARGET="$HOME/.local/bin/$BIN_NAME"
        say "Installing the AppImage to $TARGET"
        if [ "$DRY_RUN" = 1 ]; then
            say "dry-run: download, chmod and desktop entry skipped"
        else
            mkdir -p "$HOME/.local/bin"
            mv "$FILE" "$TARGET"
            chmod +x "$TARGET"
        fi
        make_desktop_entry "$TARGET"
        ensure_path_note
        say ""
        say "AppImages need FUSE. If it fails to start with a fuse error, run it once as"
        say "\"$TARGET --appimage-extract-and-run\" or reinstall with: --format tar"
        ;;
    "$TAR_ASSET")
        PREFIX="$HOME/.local/opt"
        APP_DIR="$PREFIX/StreamPull"
        LINK="$HOME/.local/bin/$BIN_NAME"
        say "Unpacking to $APP_DIR"
        if [ "$DRY_RUN" = 1 ]; then
            say "dry-run: extract, symlink and desktop entry skipped"
        else
            EXTRACT="$WORK/extract"
            mkdir -p "$EXTRACT"
            tar -xzf "$FILE" -C "$EXTRACT"
            FOUND="$(find "$EXTRACT" -maxdepth 2 -type f -name "$BIN_NAME" | head -1)"
            SRC="$(dirname "$FOUND")"
            [ -n "$FOUND" ] && [ -d "$SRC" ] || die "the tarball did not contain $BIN_NAME."
            mkdir -p "$PREFIX"
            rm -rf "$APP_DIR"
            mv "$SRC" "$APP_DIR"
            chmod +x "$APP_DIR/$BIN_NAME"
            mkdir -p "$HOME/.local/bin"
            ln -sf "$APP_DIR/$BIN_NAME" "$LINK"
            make_desktop_entry "$LINK"
            warn_if_sandbox_blocked "$APP_DIR"
        fi
        ensure_path_note
        ;;
esac

if [ "$DRY_RUN" = 1 ]; then
    say ""
    say "dry-run finished — nothing was changed."
else
    say ""
    say "StreamPull is installed. Playlists download to your own folders, from your own"
    say "connection; nothing about your library leaves this machine."
fi
