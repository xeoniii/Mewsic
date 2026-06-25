#!/usr/bin/env bash

set -e

REPO="xeoniii/Mewsic"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detecting OS and Architecture..."
echo "OS: $OS"
echo "Architecture: $ARCH"

# Create target directories
mkdir -p "$INSTALL_DIR"

get_latest_release() {
  curl -s "https://api.github.com/repos/$REPO/releases/latest" | \
    grep -oP '"browser_download_url":\s*"\K[^"]+'
}

install_mac() {
  echo "Installing for macOS..."
  urls=$(get_latest_release)
  
  if [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
    dmg_url=$(echo "$urls" | grep -i "aarch64.*\.dmg$" | head -n 1)
  else
    dmg_url=$(echo "$urls" | grep -i "x64.*\.dmg$" | head -n 1)
  fi

  # Fallback to any DMG if architecture-specific one is not found
  if [ -z "$dmg_url" ]; then
    dmg_url=$(echo "$urls" | grep -i "\.dmg$" | head -n 1)
  fi

  if [ -z "$dmg_url" ]; then
    echo "Error: No macOS .dmg release found."
    exit 1
  fi

  temp_dmg="/tmp/mewsic_temp.dmg"
  echo "Downloading $dmg_url..."
  curl -L "$dmg_url" -o "$temp_dmg"

  echo "Mounting disk image..."
  mount_point=$(hdiutil mount "$temp_dmg" | tail -n 1 | awk -F'\t' '{print $NF}')

  echo "Copying Mewsic to Applications folder..."
  # Locate the .app in the mount point
  app_path=$(find "$mount_point" -name "Mewsic.app" -maxdepth 2 | head -n 1)
  if [ -z "$app_path" ]; then
    app_path=$(find "$mount_point" -name "*.app" -maxdepth 2 | head -n 1)
  fi

  if [ -n "$app_path" ]; then
    cp -R "$app_path" /Applications/
    echo "Successfully installed to /Applications."
  else
    echo "Error: Could not find application in mounted image."
  fi

  echo "Unmounting..."
  hdiutil unmount "$mount_point"
  rm "$temp_dmg"
}

install_linux() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "Linux distribution detected: $NAME"
  else
    echo "Installing for Linux (unknown distribution)..."
  fi
  urls=$(get_latest_release)
  
  # Prefer AppImage for universal linux install
  appimage_url=$(echo "$urls" | grep -i "\.appimage$" | head -n 1)

  if [ -z "$appimage_url" ]; then
    echo "Error: No Linux AppImage release found."
    exit 1
  fi

  echo "Downloading $appimage_url..."
  curl -L "$appimage_url" -o "$INSTALL_DIR/mewsic"
  chmod +x "$INSTALL_DIR/mewsic"

  echo "Setting up desktop integration..."
  # Create a basic desktop entry
  mkdir -p "$DESKTOP_DIR"
  cat <<EOF > "$DESKTOP_DIR/mewsic.desktop"
[Desktop Entry]
Name=Mewsic
Comment=Offline Music Player
Exec=$INSTALL_DIR/mewsic
Icon=mewsic
Type=Application
Categories=AudioVideo;Audio;Player;Qt;
Terminal=false
EOF

  echo "Installed successfully to $INSTALL_DIR/mewsic."
  echo "You can launch it by running 'mewsic' (ensure $INSTALL_DIR is in your PATH) or from your desktop application menu."
}

case "$OS" in
  Darwin)
    install_mac
    ;;
  Linux)
    install_linux
    ;;
  *)
    echo "Unsupported operating system: $OS"
    echo "If you are on Windows, please run the install.ps1 script using PowerShell."
    exit 1
    ;;
esac
