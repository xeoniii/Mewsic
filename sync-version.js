import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

console.log(`Syncing version v${version} across project configurations...`);

// 1. Sync src-tauri/Cargo.toml
const cargoPath = path.join(__dirname, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  // Replace version = "X.Y.Z" under [package]
  const updatedCargo = cargoContent.replace(
    /^(version\s*=\s*")([^"]+)(")/m,
    `$1${version}$3`
  );
  if (cargoContent !== updatedCargo) {
    fs.writeFileSync(cargoPath, updatedCargo, 'utf8');
    console.log(`- Synced src-tauri/Cargo.toml version to ${version}`);
  }
}

// 2. Sync package-lock.json
const lockPath = path.join(__dirname, 'package-lock.json');
if (fs.existsSync(lockPath)) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    let modified = false;
    if (lock.version !== version) {
      lock.version = version;
      modified = true;
    }
    if (lock.packages && lock.packages[""] && lock.packages[""].version !== version) {
      lock.packages[""].version = version;
      modified = true;
    }
    if (modified) {
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');
      console.log(`- Synced package-lock.json version to ${version}`);
    }
  } catch (e) {
    console.warn('Failed to sync package-lock.json', e);
  }
}

