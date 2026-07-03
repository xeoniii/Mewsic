// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/*
 * Copyright (C) 2026 xeoniii <https://github.com/xeoniii>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

use base64::{engine::general_purpose, Engine as _};
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use image::io::Reader as ImageReader;
use lofty::{
    Accessor, AudioFile, ItemKey, MimeType, Picture, PictureType, Tag, TagType, TaggedFileExt,
};
use percent_encoding::percent_decode_str;
use rayon::prelude::*;
use rustc_hash::FxHasher;
use serde::{Deserialize, Serialize};
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager};
use tiny_http::{Header, Response, Server};
use url::Url;
use sysinfo::{System};
use mimalloc::MiMalloc;
use walkdir::WalkDir;

mod media_controls;
use media_controls::{MediaManagerState, update_media_metadata, update_media_playback, clear_media_controls};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_artist: String,
    pub genre: String,
    pub year: Option<u32>,
    pub duration: f64,
    pub track_number: Option<u32>,
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub format: String,
    pub lyrics: Option<String>,
    pub date_added: u64,
    pub source_id: Option<String>,
    pub provider: Option<String>,
    pub cover_art: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub track_ids: Vec<String>,
    pub created_at: u64,
    pub tracks: Option<Vec<Track>>,
    pub cover_art: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppStats {
    pub cpu: f32,
    pub memory: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub tracks: Vec<Track>,
    pub total: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppPaths {
    pub music_dir: String,
    pub playlists_dir: String,
    pub covers_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginData {
    pub id: String,
    pub manifest: serde_json::Value,
    pub js_content: Option<String>,
    pub css_content: Option<String>,
}

enum DiscordCommand {
    Update {
        title: String,
        artist: String,
        is_playing: bool,
        current_time: f64,
        duration: f64,
        playlist_name: String,
        cover_url: Option<String>,
    },
    Clear,
}

pub struct DiscordState {
    tx: Mutex<std::sync::mpsc::Sender<DiscordCommand>>,
    connected: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

impl DiscordState {
    fn new() -> Self {
        let (tx, rx) = std::sync::mpsc::channel::<DiscordCommand>();
        let connected = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let connected_clone = connected.clone();

        std::thread::spawn(move || {
            let mut client: Option<DiscordIpcClient> = None;
            let mut last_attempt = 0;

            for cmd in rx {
                match cmd {
                    DiscordCommand::Update {
                        title,
                        artist,
                        is_playing,
                        current_time,
                        duration,
                        playlist_name,
                        cover_url,
                    } => {
                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();

                        if client.is_none() && now - last_attempt > 10 {
                            last_attempt = now;
                            if let Ok(mut c) = DiscordIpcClient::new("1497554583726329938") {
                                if c.connect().is_ok() {
                                    client = Some(c);
                                    connected_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                                }
                            }
                        }

                        if let Some(c) = client.as_mut() {
                            let mut activity = activity::Activity::new();
                            let large_image = cover_url.unwrap_or_else(|| "cover".to_string());

                            let large_text = if is_playing { 
                                playlist_name.clone() 
                            } else { 
                                "PAUSED".to_string() 
                            };
                            let details = title.clone();
                            let state_str = format!("by {}", artist);
                            let (small_image, small_text) = if is_playing {
                                ("icon".to_string(), "Playing".to_string())
                            } else {
                                let mins = (current_time / 60.0).floor() as u32;
                                let secs = (current_time % 60.0).floor() as u32;
                                ("pause".to_string(), format!("Paused at {:02}:{:02}", mins, secs))
                            };

                            if title == "Idle" {
                                activity = activity
                                    .details("Idle")
                                    .state("Nothing playing")
                                    .assets(
                                        activity::Assets::new()
                                            .large_image(&large_image)
                                            .large_text("Mewsic")
                                    )
                                    .buttons(vec![activity::Button::new(
                                        "Download Mewsic",
                                        "https://xeoniii.github.io/Mewsic",
                                    )]);
                            } else {
                                activity = activity
                                    .details(&details)
                                    .state(&state_str)
                                    .activity_type(activity::ActivityType::Listening)
                                    .assets(
                                        activity::Assets::new()
                                            .large_image(&large_image)
                                            .small_image(&small_image)
                                            .large_text(&large_text)
                                            .small_text(&small_text),
                                    )
                                    .buttons(vec![activity::Button::new(
                                        "Download Mewsic",
                                        "https://xeoniii.github.io/Mewsic",
                                    )]);

                                let (start_time, bar_duration) = if is_playing {
                                    (now as i64 - current_time as i64, if duration > 0.0 { duration as i64 } else { 0 })
                                } else {
                                    (now as i64, 3600)
                                };

                                let mut timestamps = activity::Timestamps::new().start(start_time);
                                if bar_duration > 0 {
                                    timestamps = timestamps.end(start_time + bar_duration);
                                }
                                activity = activity.timestamps(timestamps);
                            }

                            if c.set_activity(activity).is_err() {
                                client = None;
                                connected_clone.store(false, std::sync::atomic::Ordering::Relaxed);
                            } else {
                                connected_clone.store(true, std::sync::atomic::Ordering::Relaxed);
                            }
                        } else {
                            connected_clone.store(false, std::sync::atomic::Ordering::Relaxed);
                        }
                    }
                    DiscordCommand::Clear => {
                        if let Some(mut c) = client.take() {
                            let _ = c.clear_activity();
                            let _ = c.close();
                        }
                        connected_clone.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                }
            }
        });

        Self {
            tx: Mutex::new(tx),
            connected,
        }
    }
}

pub struct AppState {
    pub tray_enabled: AtomicBool,
    pub dev_mode_enabled: AtomicBool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HarbourSearchResult {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: f64,
    pub cover_art: String,
    pub url: String,
    pub preview_url: Option<String>,
}

pub struct HarbourState {
    pub token: Mutex<Option<String>>,
    pub token_expiry: Mutex<u64>,
}

static COVERS_CACHE_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);
// Simple in-memory cache for recent thumbnail requests to avoid disk I/O and re-decoding
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;


fn is_audio_file(path: &Path) -> bool {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) => matches!(
            ext.to_lowercase().as_str(),
            "mp3" | "flac" | "ogg" | "wav" | "aac" | "m4a" | "opus" | "wma" | "aiff"
        ),
        None => false,
    }
}

fn hash_string(s: &str) -> u64 {
    let mut h = FxHasher::default();
    s.hash(&mut h);
    h.finish()
}

fn parse_track(path: &Path) -> Result<Track, String> {
    let file_path = path.to_string_lossy().to_string();
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let format = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("unknown")
        .to_uppercase();

    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    let tagged =
        lofty::read_from_path(path).map_err(|e| format!("lofty error on {}: {}", file_path, e))?;

    let duration = tagged.properties().duration().as_secs_f64();

    let tag = tagged.primary_tag().or_else(|| tagged.first_tag());

    let lyrics: Option<String> = if let Some(t) = &tag {
        if let Some(item) = t.get(&ItemKey::Lyrics) {
            if let Some(val) = item.value().text() {
                let txt = val.to_string();
                if txt.trim().is_empty() {
                    None
                } else {
                    Some(txt)
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let (title, artist, album, album_artist, genre, year, track_number) = if let Some(t) = tag {
        (
            t.title()
                .map(|s| s.to_string())
                .unwrap_or_else(|| stem_from_path(path)),
            t.artist()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            t.album()
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Album".to_string()),
            t.get_string(&ItemKey::AlbumArtist)
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown Artist".to_string()),
            t.genre().map(|s| s.to_string()).unwrap_or_default(),
            t.year(),
            t.track(),
        )
    } else {
        (
            stem_from_path(path),
            "Unknown Artist".to_string(),
            "Unknown Album".to_string(),
            "Unknown Artist".to_string(),
            String::new(),
            None,
            None,
        )
    };

    let date_added = fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or_default();

    let id_seed = if title != "Unknown Title" || artist != "Unknown Artist" {
        format!("{}|{}|{}|{:.0}", title, artist, album, duration)
    } else {
        // Fallback to filename for unknown tracks to avoid collisions
        file_name.clone()
    };
    let id = format!("{:x}", hash_string(&id_seed));

    let source_id = tag.and_then(|t| {
        t.get(&ItemKey::Comment)
            .and_then(|item| item.value().text())
            .and_then(|txt| {
                txt.lines().find(|l| l.starts_with("mws-id:")).map(|l| l[7..].to_string())
            })
    });

    let provider = tag.and_then(|t| {
        t.get(&ItemKey::Comment)
            .and_then(|item| item.value().text())
            .and_then(|txt| {
                txt.lines().find(|l| l.starts_with("mws-provider:")).map(|l| l[13..].to_string())
            })
    });

    Ok(Track {
        id,
        title,
        artist,
        album,
        album_artist,
        genre,
        year,
        duration,
        track_number,
        file_path,
        file_name,
        file_size,
        format,
        lyrics,
        date_added,
        source_id,
        provider,
        cover_art: None,
    })
}

fn stem_from_path(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string())
}

#[tauri::command]
fn get_app_paths(app_handle: tauri::AppHandle) -> Result<AppPaths, String> {
    let music_home = app_handle.path().audio_dir().map_err(|e| e.to_string())?;
    let base = music_home.join("Mewsic");

    let music_dir = base.join("Music");
    let playlists_dir = base.join("Playlists");
    let covers_dir = app_handle
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("covers");

    fs::create_dir_all(&music_dir).map_err(|e| format!("Cannot create music dir: {}", e))?;
    fs::create_dir_all(&playlists_dir)
        .map_err(|e| format!("Cannot create playlists dir: {}", e))?;
    fs::create_dir_all(&covers_dir).map_err(|e| format!("Cannot create covers dir: {}", e))?;

    if let Ok(mut lock) = COVERS_CACHE_DIR.lock() {
        *lock = Some(covers_dir.clone());
    }

    Ok(AppPaths {
        music_dir: music_dir.to_string_lossy().to_string(),
        playlists_dir: playlists_dir.to_string_lossy().to_string(),
        covers_dir: covers_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn get_downloads_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    app_handle
        .path()
        .download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_plugins(app_handle: tauri::AppHandle) -> Result<Vec<PluginData>, String> {
    let plugins_dir = app_handle
        .path()
        .app_config_dir()
        .map(|p| p.join("plugins"))
        .unwrap_or_else(|_| PathBuf::from("plugins"));

    println!("[PluginLoader] Scanning plugins dir: {:?}", plugins_dir);

    if !plugins_dir.exists() {
        if let Err(e) = fs::create_dir_all(&plugins_dir) {
            eprintln!("[PluginLoader] Failed to create plugins directory: {}", e);
            return Ok(vec![]);
        }
    }

    let mut plugins = Vec::new();

    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            println!("[PluginLoader] Examining path: {:?}", path);
            if path.is_dir() && path.extension().and_then(|s| s.to_str()) == Some("mewsic") {
                let manifest_path = path.join("manifest.json");
                println!("[PluginLoader] Found .mewsic dir, checking manifest: {:?}", manifest_path);
                if manifest_path.exists() {
                    let id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                    println!("[PluginLoader] Loaded plugin id: {}", id);
                    
                    let manifest_str = fs::read_to_string(&manifest_path).unwrap_or_default();
                    let manifest: serde_json::Value = serde_json::from_str(&manifest_str).unwrap_or(serde_json::json!({}));

                    let js_content = fs::read_to_string(path.join("plugin.js")).ok();
                    let css_content = fs::read_to_string(path.join("styles.css")).ok();

                    plugins.push(PluginData {
                        id,
                        manifest,
                        js_content,
                        css_content,
                    });
                } else {
                    println!("[PluginLoader] Manifest missing!");
                }
            }
        }
    }

    Ok(plugins)
}

#[tauri::command]
async fn delete_plugin(app_handle: tauri::AppHandle, plugin_id: String) -> Result<(), String> {
    let plugins_dir = app_handle
        .path()
        .app_config_dir()
        .map(|p| p.join("plugins"))
        .unwrap_or_else(|_| PathBuf::from("plugins"));

    if !plugins_dir.exists() {
        return Err("Plugins directory not found".into());
    }

    if let Ok(entries) = fs::read_dir(&plugins_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.extension().and_then(|s| s.to_str()) == Some("mewsic") {
                let id = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                if id == plugin_id {
                    fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
                    return Ok(());
                }
            }
        }
    }
    
    Err("Plugin not found".into())
}

#[tauri::command]
fn get_plugins_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let plugins_dir = app_handle
        .path()
        .app_config_dir()
        .map(|p| p.join("plugins"))
        .map_err(|e| e.to_string())?;
    if !plugins_dir.exists() {
        fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;
    }
    Ok(plugins_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn install_plugin_from_path(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let src = PathBuf::from(&path);

    let plugins_dir = app_handle
        .path()
        .app_config_dir()
        .map(|p| p.join("plugins"))
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&plugins_dir).map_err(|e| e.to_string())?;

    fn copy_dir(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
        fs::create_dir_all(dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            if ty.is_dir() {
                copy_dir(&entry.path(), &dst.join(entry.file_name()))?;
            } else {
                fs::copy(entry.path(), dst.join(entry.file_name()))?;
            }
        }
        Ok(())
    }

    // Case 1: it's already a .mewsic directory
    if src.is_dir() && src.extension().and_then(|s| s.to_str()) == Some("mewsic") {
        if !src.join("manifest.json").exists() {
            return Err("Missing manifest.json".into());
        }
        let dest = plugins_dir.join(src.file_name().unwrap_or_default());
        if dest.exists() { fs::remove_dir_all(&dest).map_err(|e| e.to_string())?; }
        copy_dir(&src, &dest).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Case 2: it's a zip archive (extension is .mewsic or .zip — we treat both the same)
    if src.is_file() {
        let file = fs::File::open(&src).map_err(|e| e.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

        // Detect common path prefix inside the zip (some zippers wrap everything in a folder)
        let prefix: Option<String> = {
            let first = archive.by_index(0).map_err(|e| e.to_string())?;
            let name = first.name().to_string();
            if name.contains('/') {
                Some(name.split('/').next().unwrap_or("").to_string())
            } else {
                None
            }
        };

        // Use the archive filename (without extension) as the plugin folder name
        let plugin_stem = src.file_stem().unwrap_or_default().to_string_lossy().to_string();
        let plugin_folder = format!("{}.mewsic", plugin_stem.trim_end_matches(".mewsic"));
        let dest = plugins_dir.join(&plugin_folder);
        if dest.exists() { fs::remove_dir_all(&dest).map_err(|e| e.to_string())?; }
        fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let raw_name = file.name().to_string();

            // Strip the common prefix if present
            let relative = if let Some(ref pfx) = prefix {
                raw_name.strip_prefix(&format!("{}/", pfx)).unwrap_or(&raw_name).to_string()
            } else {
                raw_name.clone()
            };

            if relative.is_empty() { continue; }

            let out_path = dest.join(&relative);
            if file.is_dir() {
                fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
            } else {
                if let Some(parent) = out_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut out = fs::File::create(&out_path).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut out).map_err(|e| e.to_string())?;
            }
        }

        if !dest.join("manifest.json").exists() {
            fs::remove_dir_all(&dest).ok();
            return Err("Invalid plugin archive: missing manifest.json".into());
        }
        return Ok(());
    }

    Err("Path must be a .mewsic folder or a .mewsic/.zip archive".into())
}


#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("Path does not exist".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn import_files(sources: Vec<String>, target_dir: String) -> Result<u32, String> {
    let target = Path::new(&target_dir);
    if !target.exists() {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
    }

    let mut imported = 0;
    for src_path in sources {
        let src = Path::new(&src_path);
        if src.is_file() {
            if let Some(file_name) = src.file_name() {
                let dest = target.join(file_name);
                // Don't overwrite if it exists to be safe
                if !dest.exists() {
                    if let Err(e) = fs::copy(src, dest) {
                        eprintln!("Failed to copy {}: {}", src_path, e);
                    } else {
                        imported += 1;
                    }
                }
            }
        }
    }
    Ok(imported)
}

#[tauri::command]
async fn scan_music_directory(dir_path: String) -> Result<ScanResult, String> {
    let root = PathBuf::from(&dir_path);
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", dir_path));
    }

    let entries: Vec<_> = WalkDir::new(&root)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') && name != "node_modules" && name != "vendor"
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .collect();

    let mut tracks = Vec::with_capacity(entries.len());
    let mut errors = Vec::new();

    let results: Vec<_> = entries
        .par_iter()
        .map(|entry| {
            let path = entry.path();
            if is_audio_file(path) {
                match parse_track(path) {
                    Ok(track) => (Some(track), None),
                    Err(e) => (None, Some(e)),
                }
            } else {
                (None, None)
            }
        })
        .collect();

    for (t, e) in results {
        if let Some(track) = t {
            tracks.push(track);
        }
        if let Some(err) = e {
            errors.push(err);
        }
    }

    let mut tracks = tracks;

    tracks.sort_by(|a, b| {
        a.artist
            .cmp(&b.artist)
            .then(a.album.cmp(&b.album))
            .then(a.track_number.cmp(&b.track_number))
            .then(a.title.cmp(&b.title))
            .then(a.id.cmp(&b.id))
    });

    let total = tracks.len();
    Ok(ScanResult {
        tracks,
        total,
        errors,
    })
}

#[tauri::command]
async fn get_track_metadata(file_path: String) -> Result<Track, String> {
    parse_track(Path::new(&file_path))
}

#[tauri::command]
async fn list_playlists(playlists_dir: String) -> Result<Vec<Playlist>, String> {
    let root = PathBuf::from(&playlists_dir);
    if !root.exists() {
        return Ok(vec![]);
    }

    let mut playlists = Vec::new();

    for entry in fs::read_dir(&root)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut pl) = serde_json::from_str::<Playlist>(&content) {
                    pl.file_path = path.to_string_lossy().to_string();
                    playlists.push(pl);
                }
            }
        }
    }

    playlists.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(playlists)
}

#[tauri::command]
async fn create_playlist(playlists_dir: String, name: String) -> Result<Playlist, String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let id = format!("{:x}", hash_string(&format!("{}{}", name, created_at)));

    let safe_name: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let safe_name = safe_name.trim().to_string();

    let file_path = PathBuf::from(&playlists_dir).join(format!("{}.json", safe_name));

    if file_path.exists() {
        return Err("A playlist with this name already exists".to_string());
    }

    let playlist = Playlist {
        id,
        name,
        file_path: file_path.to_string_lossy().to_string(),
        track_ids: vec![],
        created_at,
        tracks: None,
        cover_art: None,
    };

    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;
    fs::write(&file_path, manifest).map_err(|e| e.to_string())?;

    Ok(playlist)
}

#[tauri::command]
async fn delete_track(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn save_playlist(playlist: Playlist) -> Result<(), String> {
    let path = PathBuf::from(&playlist.file_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;
    fs::write(path, manifest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn rename_playlist(mut playlist: Playlist, new_name: String) -> Result<Playlist, String> {
    let old_path = PathBuf::from(&playlist.file_path);
    if !old_path.exists() {
        return Err("Original playlist file not found".to_string());
    }

    let parent = old_path.parent().ok_or("Could not find playlist directory")?;
    
    // Sanitize name for filesystem
    let safe_name: String = new_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
        .collect();
    
    let new_path = parent.join(format!("{}.json", safe_name));
    
    if new_path.exists() && new_path != old_path {
        return Err("A playlist with this name already exists".to_string());
    }

    // Update internal data
    playlist.name = new_name;
    playlist.file_path = new_path.to_string_lossy().to_string();

    // Perform rename/write
    let manifest = serde_json::to_string_pretty(&playlist).map_err(|e| e.to_string())?;
    fs::write(&new_path, manifest).map_err(|e| e.to_string())?;
    
    if new_path != old_path {
        fs::remove_file(old_path).map_err(|e| format!("Failed to remove old file: {}", e))?;
    }

    Ok(playlist)
}

#[tauri::command]
async fn delete_playlist(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn import_playlist(playlists_dir: String, source_path: String) -> Result<Playlist, String> {
    let source = PathBuf::from(&source_path);
    let content = fs::read_to_string(&source).map_err(|e| format!("Cannot read source: {}", e))?;
    let mut pl = serde_json::from_str::<Playlist>(&content)
        .map_err(|e| format!("Invalid playlist JSON: {}", e))?;

    let safe_name: String = pl
        .name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let safe_name = safe_name.trim().to_string();

    let target_path = PathBuf::from(&playlists_dir).join(format!("{}.json", safe_name));

    pl.file_path = target_path.to_string_lossy().to_string();

    let manifest = serde_json::to_string_pretty(&pl).map_err(|e| e.to_string())?;
    fs::write(&target_path, manifest).map_err(|e| e.to_string())?;

    Ok(pl)
}

#[tauri::command]
async fn harbour_search(
    app_handle: tauri::AppHandle,
    _state: tauri::State<'_, HarbourState>,
    query: String,
    provider: String,
) -> Result<Vec<HarbourSearchResult>, String> {
    match provider.as_str() {
        "jiosaavn" => search_jiosaavn(app_handle, query).await,
        "itunes" => search_itunes(app_handle, query).await,
        "youtube" => search_youtube_direct(app_handle, query).await,
        "soundcloud" => search_soundcloud(app_handle, query).await,
        _ => Err(format!("Provider {} not supported", provider)),
    }
}

async fn search_jiosaavn(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    let client = reqwest::Client::new();
    let search_url = format!("https://www.jiosaavn.com/api.php?__call=autocomplete.get&_format=json&_marker=0&cc=in&includeMetaTags=1&query={}", urlencoding::encode(&query));

    let resp = client
        .get(search_url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("JioSaavn search failed: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    if let Some(songs) = data["songs"]["data"].as_array() {
        for s in songs {
            let cover_art = s["image"]
                .as_str()
                .unwrap_or_default()
                .replace("50x50", "150x150");
            results.push(HarbourSearchResult {
                id: s["id"].as_str().unwrap_or_default().to_string(),
                title: s["title"].as_str().unwrap_or_default().to_string(),
                artist: s["more_info"]["music"]
                    .as_str()
                    .unwrap_or_else(|| s["description"].as_str().unwrap_or_default())
                    .to_string(),
                album: s["more_info"]["album"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                duration: 0.0,
                cover_art,
                url: s["url"].as_str().unwrap_or_default().to_string(),
                preview_url: s["more_info"]["vlink"].as_str().map(|v| v.to_string()),
            });
        }
    }
    
    if results.is_empty() {
        return youtube_search_fallback(app_handle, query).await;
    }
    
    Ok(results)
}

async fn search_itunes(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    let client = reqwest::Client::new();
    let search_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=30",
        urlencoding::encode(&query)
    );

    let resp = client
        .get(search_url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("iTunes search failed: {}", e))?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    if let Some(tracks) = data["results"].as_array() {
        for t in tracks {
            let cover_art = t["artworkUrl100"]
                .as_str()
                .unwrap_or_default()
                .replace("100x100", "200x200");
            results.push(HarbourSearchResult {
                id: t["trackId"].as_i64().unwrap_or(0).to_string(),
                title: t["trackName"].as_str().unwrap_or_default().to_string(),
                artist: t["artistName"].as_str().unwrap_or_default().to_string(),
                album: t["collectionName"].as_str().unwrap_or_default().to_string(),
                duration: (t["trackTimeMillis"].as_f64().unwrap_or(0.0) / 1000.0),
                cover_art,
                url: t["trackViewUrl"].as_str().unwrap_or_default().to_string(),
                preview_url: t["previewUrl"].as_str().map(|v| v.to_string()),
            });
        }
    }

    if results.is_empty() {
        return youtube_search_fallback(app_handle, query).await;
    }

    Ok(results)
}

async fn get_yt_dlp_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = app_handle.path().data_dir().unwrap_or_default().join("Mewsic");
    let bin_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    app_dir.join(bin_name)
}

async fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> PathBuf {
    let app_dir = app_handle.path().data_dir().unwrap_or_default().join("Mewsic");
    let bin_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    app_dir.join(bin_name)
}

async fn download_file_with_progress(
    app_handle: &tauri::AppHandle,
    url: &str,
    path: &Path,
    event_name: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;
    use std::io::Write;

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    let total_size = response.content_length().unwrap_or(0);

    let mut file = fs::File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let mut last_emit = 0.0;

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| format!("Error while downloading: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("Error while writing to file: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            // Only emit if progress changed by at least 1% to avoid spamming
            if progress - last_emit >= 1.0 || progress >= 100.0 {
                app_handle
                    .emit(event_name, progress)
                    .map_err(|e| e.to_string())?;
                last_emit = progress;
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn ensure_dependencies(app_handle: tauri::AppHandle) -> Result<String, String> {
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    let ffmpeg_path = get_ffmpeg_path(&app_handle).await;

    // Create app data dir if it doesn't exist
    let app_dir = yt_dlp_path.parent().unwrap();
    fs::create_dir_all(app_dir).map_err(|e| format!("Failed to create app directory: {}", e))?;

    // Download yt-dlp if missing
    if !yt_dlp_path.exists() {
        let url = if cfg!(target_os = "windows") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
        } else if cfg!(target_os = "macos") {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos"
        } else {
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp"
        };

        download_file_with_progress(&app_handle, url, &yt_dlp_path, "harbour-download-progress-ytdlp").await?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&yt_dlp_path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&yt_dlp_path, perms).map_err(|e| e.to_string())?;
        }
    }

    // Download ffmpeg if missing
    if !ffmpeg_path.exists() {
        let url = if cfg!(target_os = "windows") {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-win32-x64"
        } else if cfg!(target_os = "macos") {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64"
        } else {
            "https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-linux-x64"
        };

        download_file_with_progress(&app_handle, url, &ffmpeg_path, "harbour-download-progress-ffmpeg").await?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&ffmpeg_path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&ffmpeg_path, perms).map_err(|e| e.to_string())?;
        }
    }

    Ok("Dependencies ready".to_string())
}

async fn search_youtube_direct(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    youtube_search_fallback(app_handle, query).await
}

async fn search_soundcloud(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    use std::process::Command;
    let search_query = format!("scsearch20:{}", query);
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let mut cmd = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
    } else {
        Command::new("yt-dlp")
    };
    
    cmd.args([
        "--dump-json",
        "--flat-playlist",
        "--no-playlist",
        "--no-check-certificates",
        "--geo-bypass",
        &search_query
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("SoundCloud search failed: {}", e))?;

    let body = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in body.lines() {
        if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
            let title = item["title"]
                .as_str()
                .unwrap_or("Unknown Title")
                .to_string();
            let uploader = item["uploader"]
                .as_str()
                .unwrap_or("Unknown Artist")
                .to_string();

            let (artist, clean_title) = if title.contains(" - ") {
                let parts: Vec<&str> = title.splitn(2, " - ").collect();
                (parts[0].trim().to_string(), parts[1].trim().to_string())
            } else {
                (uploader, title)
            };

            let cover_art = if let Some(thumbs) = item["thumbnails"].as_array() {
                thumbs.last().and_then(|t| t["url"].as_str()).unwrap_or_default().to_string()
            } else {
                String::new()
            };

            results.push(HarbourSearchResult {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                title: clean_title,
                artist: artist,
                album: "SoundCloud".to_string(),
                duration: item["duration"].as_f64().unwrap_or(0.0),
                cover_art,
                url: item["url"].as_str().unwrap_or_default().to_string(),
                preview_url: None,
            });
        }
    }
    Ok(results)
}

async fn youtube_search_fallback(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    use std::process::Command;
    let search_query = format!("ytsearch20:{} official audio", query);
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let mut cmd = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
    } else {
        Command::new("yt-dlp")
    };
    
    cmd.args([
        "--dump-json",
        "--flat-playlist",
        "--no-playlist",
        "--default-search", "ytsearch",
        "--no-check-certificates",
        "--geo-bypass",
        "--extractor-args", "youtube:player-client=ios,android,web",
        &search_query
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("YouTube search failed: {}", e))?;

    let body = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in body.lines() {
        if let Ok(item) = serde_json::from_str::<serde_json::Value>(line) {
            let title = item["title"]
                .as_str()
                .unwrap_or("Unknown Title")
                .to_string();
            let uploader = item["uploader"]
                .as_str()
                .unwrap_or("Unknown Artist")
                .to_string();

            let (artist, clean_title) = if title.contains(" - ") {
                let parts: Vec<&str> = title.splitn(2, " - ").collect();
                (parts[0].trim().to_string(), parts[1].trim().to_string())
            } else {
                (uploader, title)
            };

            results.push(HarbourSearchResult {
                id: item["id"].as_str().unwrap_or_default().to_string(),
                title: clean_title,
                artist: artist,
                album: "YouTube".to_string(),
                duration: item["duration"].as_f64().unwrap_or(0.0),
                cover_art: if let Some(thumbs) = item["thumbnails"].as_array() {
                    thumbs.last().and_then(|t| t["url"].as_str()).unwrap_or_default().to_string()
                } else {
                    String::new()
                },
                url: item["url"].as_str().unwrap_or_default().to_string(),
                preview_url: None,
            });
        }
    }
    Ok(results)
}

#[tauri::command]
async fn fetch_track_metadata(app_handle: tauri::AppHandle, query: String) -> Result<HarbourSearchResult, String> {
    if query.contains("jiosaavn.com") {
        let results = search_jiosaavn(app_handle.clone(), query.clone()).await?;
        if !results.is_empty() {
            return Ok(results[0].clone());
        }
    }
    
    if query.contains("youtube.com") || query.contains("youtu.be") {
        let results = search_youtube_direct(app_handle.clone(), query.clone()).await?;
        if !results.is_empty() {
            return Ok(results[0].clone());
        }
    }

    let results = search_itunes(app_handle, query).await?;
    if !results.is_empty() {
        return Ok(results[0].clone());
    }

    Err("No metadata found for this link".to_string())
}

#[derive(Clone, Serialize)]
struct DownloadProgress {
    id: String,
    progress: f64,
}

#[derive(Clone, Serialize)]
struct DownloadLog {
    id: String,
    message: String,
}

#[tauri::command]
async fn download_track(
    app_handle: tauri::AppHandle,
    music_dir: String,
    title: String,
    artist: String,
    _album: String,
    _cover_art: String,
    download_id: String,
    url: Option<String>,
    format: Option<String>,
    ip_version: Option<String>,
    provider: Option<String>,
) -> Result<String, String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};
    use tauri::Emitter;

    let fmt = format.unwrap_or_else(|| "mp3".to_string());
    let is_video = fmt == "mp4";
    let ipv = if ip_version.unwrap_or_default() == "ipv6" { "-6" } else { "-4" };

    let safe_title = title.replace("/", "_").replace("\\", "_");
    let safe_artist = artist.replace("/", "_").replace("\\", "_");
    let ext = if is_video { "mp4" } else { "mp3" };
    let filename = format!("{} - {}.{}", safe_artist, safe_title, ext);
    let target_path = PathBuf::from(&music_dir).join(&filename);

    if target_path.exists() {
        return Ok(target_path.to_string_lossy().to_string());
    }

    let query = url.as_ref().cloned().unwrap_or_else(|| {
        format!("ytsearch1:{} official audio", format!("{} - {}", artist, title))
    });

    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    let ffmpeg_path = get_ffmpeg_path(&app_handle).await;
    
    let mut args = vec![
        ipv.to_string(),
        "--no-cache-dir".to_string(),
        "--no-check-certificates".to_string(),
        "--geo-bypass".to_string(),
        "--extractor-args".to_string(), "youtube:player-client=ios,android,web".to_string(),
        "--no-playlist".to_string(),
        "--prefer-ffmpeg".to_string(),
        "--newline".to_string(),
        "--progress".to_string(),
    ];

    if is_video {
        args.push("--format".to_string());
        args.push("bestvideo+bestaudio/best".to_string());
        args.push("--merge-output-format".to_string());
        args.push("mp4".to_string());
        args.push("--remux-video".to_string());
        args.push("mp4".to_string());
    } else {
        args.push("--extract-audio".to_string());
        args.push("--audio-format".to_string());
        args.push("mp3".to_string());
        args.push("--audio-quality".to_string());
        args.push("0".to_string());
    }

    args.push("--output".to_string());
    args.push(target_path.to_str().ok_or("Invalid target path")?.to_string());

    if ffmpeg_path.exists() {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path.to_str().unwrap().to_string());
    }

    args.push(query);

    let mut cmd = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
    } else {
        Command::new("yt-dlp")
    };
    cmd.args(&args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn download process: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let reader = BufReader::new(stdout);

    for line in reader.lines() {
        if let Ok(l) = line {
            let _ = app_handle.emit("download-log", DownloadLog {
                id: download_id.clone(),
                message: l.clone(),
            });

            if l.contains("[download]") && l.contains("%") {
                // Parse percentage like "  10.5%"
                let parts: Vec<&str> = l.split_whitespace().collect();
                for p in parts {
                    if p.contains("%") {
                        if let Ok(val) = p.replace("%", "").parse::<f64>() {
                            let _ = app_handle.emit("download-progress", DownloadProgress {
                                id: download_id.clone(),
                                progress: val,
                            });
                        }
                    }
                }
            }
        }
    }

    let status = child.wait().map_err(|e| format!("Failed to wait for download process: {}", e))?;

    if !status.success() {
        return Err("Download process exited with error".to_string());
    }

    // --- Automatic Metadata Tagging ---
    if let Ok(mut tagged_file) = lofty::read_from_path(&target_path) {
        let tag = match tagged_file.primary_tag_mut() {
            Some(t) => t,
            None => {
                let t_type = tagged_file.primary_tag_type();
                tagged_file.insert_tag(Tag::new(t_type));
                tagged_file.primary_tag_mut().unwrap()
            }
        };

        tag.insert_text(ItemKey::TrackTitle, title.clone());
        tag.insert_text(ItemKey::TrackArtist, artist.clone());
        tag.insert_text(ItemKey::AlbumTitle, _album.clone());
        
        // Save source ID and provider for recommendation feature
        let mut comment = String::new();
        if let Some(ref sid) = url {
            comment.push_str(&format!("mws-id:{}\n", sid));
        }
        if let Some(ref p) = provider {
            comment.push_str(&format!("mws-provider:{}", p));
        }
        if !comment.is_empty() {
            tag.insert_text(ItemKey::Comment, comment);
        }

        // Auto fetch and embed lyrics
        let search_query = format!("{} {}", artist, title);
        if let Ok(Some(lyrics_text)) = fetch_lyrics(search_query).await {
            tag.insert_text(ItemKey::Lyrics, lyrics_text);
        }

        // Attempt to download and embed cover art
        if !_cover_art.is_empty() {
            if let Ok(resp) = reqwest::get(&_cover_art).await {
                if let Ok(bytes) = resp.bytes().await {
                    let picture = Picture::new_unchecked(
                        PictureType::CoverFront,
                        Some(MimeType::Jpeg),
                        None,
                        bytes.to_vec(),
                    );
                    tag.push_picture(picture);
                }
            }
        }

        let _ = tagged_file.save_to_path(&target_path);
    }

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_stream_url(app_handle: tauri::AppHandle, url: String) -> Result<String, String> {
    use std::process::Command;
    
    if url.ends_with(".mp3") || url.ends_with(".wav") || url.ends_with(".ogg") || url.ends_with(".flac") || url.ends_with(".m4a") {
        return Ok(url);
    }

    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let mut cmd = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
    } else {
        Command::new("yt-dlp")
    };
    
    cmd.args([
        "-g",
        "-f", "bestaudio/best",
        "--no-check-certificates",
        "--geo-bypass",
        "--extractor-args", "youtube:player-client=ios,android,web",
        &url
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", err));
    }

    let stream_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stream_url.is_empty() {
        return Err("No stream URL returned".to_string());
    }
    
    Ok(stream_url)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ResolvedStream {
    url: String,
    title: String,
    artist: String,
    duration: f64,
    cover_art: String,
}

#[tauri::command]
async fn resolve_stream_metadata(app_handle: tauri::AppHandle, url: String) -> Result<ResolvedStream, String> {
    use std::process::Command;
    
    // Check if it's already a direct audio file stream
    if url.ends_with(".mp3") || url.ends_with(".wav") || url.ends_with(".ogg") || url.ends_with(".flac") || url.ends_with(".m4a") {
        let filename = Path::new(&url)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Web Stream");
        let title = filename.split('.').next().unwrap_or("Web Stream").to_string();
        
        return Ok(ResolvedStream {
            url: url.clone(),
            title,
            artist: "Web Stream".to_string(),
            duration: 0.0,
            cover_art: "".to_string(),
        });
    }

    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let mut cmd = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
    } else {
        Command::new("yt-dlp")
    };
    
    cmd.args([
        "--dump-json",
        "--no-playlist",
        "-f", "bestaudio/best",
        "--no-check-certificates",
        "--geo-bypass",
        "--extractor-args", "youtube:player-client=ios,android,web",
        &url
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let output = cmd.output().map_err(|e| format!("Failed to run yt-dlp: {}", e))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {}", err));
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse metadata JSON: {}", e))?;

    let stream_url = parsed["url"].as_str().unwrap_or_default().to_string();
    if stream_url.is_empty() {
        return Err("No streaming URL found in metadata".to_string());
    }

    let title = parsed["title"].as_str().unwrap_or("Unknown Title").to_string();
    let artist = parsed["uploader"].as_str().unwrap_or("Unknown Artist").to_string();
    let duration = parsed["duration"].as_f64().unwrap_or(0.0);
    
    let cover_art = parsed["thumbnail"].as_str()
        .or_else(|| parsed["thumbnails"].as_array().and_then(|arr| arr.last()).and_then(|t| t["url"].as_str()))
        .unwrap_or_default()
        .to_string();

    Ok(ResolvedStream {
        url: stream_url,
        title,
        artist,
        duration,
        cover_art,
    })
}


#[tauri::command]
async fn pick_directory(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app_handle.dialog().file().blocking_pick_folder();

    Ok(folder.map(|p| p.to_string()))
}

#[tauri::command]
async fn get_cover_art(file_path: String) -> Result<Option<String>, String> {
    let path = Path::new(&file_path);
    
    // Check if it's already a URL (e.g. from iTunes)
    if file_path.starts_with("http") {
        return Ok(Some(file_path));
    }

    if !path.exists() {
        return Ok(None);
    }

    if let Ok(tagged) = lofty::read_from_path(path) {
        let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
        if let Some(t) = tag {
            if !t.pictures().is_empty() {
                return Ok(Some(file_path));
            }
        }
    }

    Ok(None)
}

#[derive(Debug, Deserialize)]
pub struct TrackMetadata {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub album_artist: Option<String>,
    pub genre: Option<String>,
    pub year: Option<u32>,
    pub track_number: Option<u32>,
    pub cover_art: Option<String>,
    pub lyrics: Option<String>,
}

#[tauri::command]
async fn save_track_metadata(file_path: String, metadata: TrackMetadata) -> Result<(), String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    let mut fetched_cover = None;
    if let Some(ref cover) = metadata.cover_art {
        if cover.starts_with("http") {
            if let Ok(resp) = reqwest::get(cover).await {
                if let Ok(bytes) = resp.bytes().await {
                    fetched_cover = Some(bytes.to_vec());
                }
            }
        } else if cover.starts_with("data:") {
            let parts: Vec<&str> = cover.splitn(2, ',').collect();
            if parts.len() == 2 {
                if let Ok(data) = general_purpose::STANDARD.decode(parts[1]) {
                    fetched_cover = Some(data);
                }
            }
        }
    }

    let mut tagged = lofty::read_from_path(path).map_err(|e| format!("lofty error: {}", e))?;

    let tag = match tagged.primary_tag_mut() {
        Some(t) => t,
        None => {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let tag_type = match ext.as_str() {
                "mp3" => TagType::Id3v2,
                "flac" => TagType::VorbisComments,
                "ogg" | "opus" => TagType::VorbisComments,
                "m4a" | "aac" => TagType::Mp4Ilst,
                "wav" => TagType::RiffInfo,
                "aiff" | "aif" => TagType::Id3v2,
                "wma" => TagType::Ape,
                _ => TagType::Id3v2,
            };
            let new_tag = Tag::new(tag_type);
            tagged.insert_tag(new_tag);
            tagged.primary_tag_mut().unwrap()
        }
    };

    if let Some(title) = metadata.title {
        if !title.is_empty() {
            tag.set_title(title);
        }
    }
    if let Some(artist) = metadata.artist {
        if !artist.is_empty() {
            tag.set_artist(artist);
        }
    }
    if let Some(album) = metadata.album {
        if !album.is_empty() {
            tag.set_album(album);
        }
    }
    if let Some(album_artist) = metadata.album_artist {
        if !album_artist.is_empty() {
            tag.insert_text(ItemKey::AlbumArtist, album_artist);
        }
    }
    if let Some(genre) = metadata.genre {
        if !genre.is_empty() {
            tag.set_genre(genre);
        }
    }
    if let Some(year) = metadata.year {
        tag.set_year(year);
    }
    if let Some(track_number) = metadata.track_number {
        tag.set_track(track_number);
    }
    if let Some(lyrics) = metadata.lyrics {
        if !lyrics.is_empty() {
            tag.insert_text(ItemKey::Lyrics, lyrics);
        }
    }

    if let Some(data) = fetched_cover {
        let pic = Picture::new_unchecked(
            PictureType::CoverFront,
            Some(MimeType::Jpeg),
            None,
            data,
        );
        tag.remove_picture_type(PictureType::CoverFront);
        let pics = tag.pictures().to_vec();
        let mut new_pics: Vec<Picture> = pics
            .into_iter()
            .filter(|p| p.pic_type() != PictureType::CoverFront)
            .collect();
        new_pics.push(pic);
        for (i, p) in new_pics.iter().enumerate() {
            tag.set_picture(i, p.clone());
        }
    }

    tagged
        .save_to_path(path)
        .map_err(|e| format!("Failed to save metadata: {}", e))
}

#[tauri::command]
fn set_tray_enabled(
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    state.tray_enabled.store(enabled, Ordering::Relaxed);
    if let Some(tray) = app.tray_by_id("main_tray") {
        let _ = tray.set_visible(enabled);
    }
    Ok(())
}

#[tauri::command]
fn set_dev_mode(
    state: tauri::State<AppState>,
    enabled: bool,
) -> Result<(), String> {
    state.dev_mode_enabled.store(enabled, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    window
        .set_fullscreen(!is_fullscreen)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_discord_rpc(
    state: tauri::State<'_, DiscordState>,
    title: String,
    artist: String,
    is_playing: bool,
    current_time: f64,
    duration: f64,
    playlist_name: String,
    cover_url: Option<String>,
) -> Result<(), String> {
    if let Ok(tx) = state.tx.lock() {
        let _ = tx.send(DiscordCommand::Update {
            title,
            artist,
            is_playing,
            current_time,
            duration,
            playlist_name,
            cover_url,
        });
    }
    Ok(())
}

#[tauri::command]
async fn clear_discord_rpc(state: tauri::State<'_, DiscordState>) -> Result<(), String> {
    if let Ok(tx) = state.tx.lock() {
        let _ = tx.send(DiscordCommand::Clear);
    }
    Ok(())
}

#[tauri::command]
fn is_discord_connected(state: tauri::State<'_, DiscordState>) -> bool {
    state.connected.load(std::sync::atomic::Ordering::Relaxed)
}

#[tauri::command]
fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(())
}

fn get_process_pss(pid: sysinfo::Pid) -> u64 {
    #[cfg(target_os = "linux")]
    {
        let path = format!("/proc/{}/smaps_rollup", pid);
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                if line.starts_with("Pss:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(kb) = parts.get(1).and_then(|p| p.parse::<u64>().ok()) {
                        return kb * 1024;
                    }
                }
            }
        }
    }
    0
}

fn start_asset_server(port: u16) {
    let addr = format!("127.0.0.1:{}", port);
    std::thread::spawn(move || {
        match Server::http(&addr) {
            Ok(server) => {
                let server = std::sync::Arc::new(server);
                // Spawn 4 worker threads to handle requests in parallel (saving thread overhead and RAM)
                for _ in 0..4 {
                    let server = server.clone();
                    std::thread::spawn(move || {
                        for request in server.incoming_requests() {
                            handle_request(request);
                        }
                    });
                }
            }
            Err(e) => {
                eprintln!("Failed to start asset server on {}: {}", addr, e);
            }
        }
    });
}

fn handle_request(request: tiny_http::Request) {
    // Handle CORS preflight
    if request.method() == &tiny_http::Method::Options {
        let response = Response::empty(204)
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            )
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, OPTIONS"[..])
                    .unwrap(),
            )
            .with_header(
                Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap(),
            );
        let _ = request.respond(response);
        return;
    }

    let url_str = format!("http://127.0.0.1:1422{}", request.url()); // TODO: Pass port to handle_request if needed
    let Ok(url) = Url::parse(&url_str) else {
        let _ = request.respond(Response::from_string("Invalid URL").with_status_code(400));
        return;
    };

    let path_query = url.path();

    if path_query == "/proxy" {
        if let Some((_, target_url)) = url.query_pairs().find(|(k, _)| k == "url") {
            let target_url = target_url.to_string();
            
            let mut range_header = None;
            for header in request.headers() {
                if header.field.as_str().to_ascii_lowercase() == "range" {
                    range_header = Some(header.value.to_string());
                }
            }

            let (tx, rx) = std::sync::mpsc::channel::<Result<Vec<u8>, String>>();
            let (headers_tx, headers_rx) = std::sync::mpsc::channel::<(u16, String, Option<u64>, Option<String>)>();

            std::thread::spawn(move || {
                tauri::async_runtime::block_on(async {
                    use futures_util::StreamExt;
                    let client = reqwest::Client::new();
                    let mut req = client.get(&target_url)
                        .header(reqwest::header::USER_AGENT, "Mozilla/5.0");
                    if let Some(range) = range_header {
                        req = req.header("Range", range);
                    }
                    
                    match req.send().await {
                        Ok(resp) => {
                            let status = resp.status().as_u16();
                            let content_type = resp.headers()
                                .get("content-type")
                                .and_then(|v| v.to_str().ok())
                                .unwrap_or("audio/mpeg")
                                .to_string();
                            let content_length = resp.headers()
                                .get("content-length")
                                .and_then(|v| v.to_str().ok())
                                .and_then(|v| v.parse::<u64>().ok());
                            let content_range = resp.headers()
                                .get("content-range")
                                .and_then(|v| v.to_str().ok())
                                .map(|v| v.to_string());

                            let _ = headers_tx.send((status, content_type, content_length, content_range));

                            let mut stream = resp.bytes_stream();
                            while let Some(chunk_result) = stream.next().await {
                                match chunk_result {
                                    Ok(chunk) => {
                                        if tx.send(Ok(chunk.to_vec())).is_err() {
                                            break;
                                        }
                                    }
                                    Err(e) => {
                                        let _ = tx.send(Err(e.to_string()));
                                        break;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = headers_tx.send((500, "text/plain".to_string(), None, None));
                            let _ = tx.send(Err(e.to_string()));
                        }
                    }
                });
            });

            if let Ok((status, content_type, content_length, content_range)) = headers_rx.recv() {
                struct ChannelReader {
                    receiver: std::sync::mpsc::Receiver<Result<Vec<u8>, String>>,
                    current_chunk: Option<Vec<u8>>,
                    offset: usize,
                }

                impl std::io::Read for ChannelReader {
                    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
                        if self.current_chunk.is_none() {
                            match self.receiver.recv() {
                                Ok(Ok(chunk)) => {
                                    self.current_chunk = Some(chunk);
                                    self.offset = 0;
                                }
                                Ok(Err(e)) => {
                                    return Err(std::io::Error::new(std::io::ErrorKind::Other, e));
                                }
                                Err(_) => {
                                    return Ok(0);
                                }
                            }
                        }

                        if let Some(chunk) = &self.current_chunk {
                            let available = chunk.len() - self.offset;
                            let to_write = std::cmp::min(buf.len(), available);
                            buf[..to_write].copy_from_slice(&chunk[self.offset..self.offset + to_write]);
                            self.offset += to_write;
                            if self.offset >= chunk.len() {
                                self.current_chunk = None;
                            }
                            Ok(to_write)
                        } else {
                            Ok(0)
                        }
                    }
                }

                let reader = ChannelReader {
                    receiver: rx,
                    current_chunk: None,
                    offset: 0,
                };

                let mut response = Response::new(
                    tiny_http::StatusCode(status),
                    vec![
                        Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
                        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                        Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"*"[..]).unwrap(),
                        Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, OPTIONS"[..]).unwrap(),
                        Header::from_bytes(&b"Access-Control-Expose-Headers"[..], &b"Content-Range, Accept-Ranges, Content-Length"[..]).unwrap(),
                        Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
                        Header::from_bytes(&b"Cache-Control"[..], &b"no-cache, no-store, must-revalidate"[..]).unwrap(),
                        Header::from_bytes(&b"Pragma"[..], &b"no-cache"[..]).unwrap(),
                        Header::from_bytes(&b"Expires"[..], &b"0"[..]).unwrap(),
                        Header::from_bytes(&b"Vary"[..], &b"Range"[..]).unwrap(),
                    ],
                    reader,
                    content_length.map(|l| l as usize),
                    None,
                );

                if let Some(cr) = content_range {
                    response.add_header(Header::from_bytes(&b"Content-Range"[..], cr.as_bytes()).unwrap());
                }

                let _ = request.respond(response);
                return;
            }
        }
        let _ = request.respond(Response::from_string("Proxy Failed").with_status_code(500));
        return;
    }

    let query = url.query().unwrap_or("");
    let is_thumb = query.contains("thumb=1");
    let requested_size = url.query_pairs()
        .find(|(k, _)| k == "size")
        .and_then(|(_, v)| v.parse::<u32>().ok())
        .unwrap_or(256);
    
    let is_lowend = query.contains("lowend=1");
    let requested_size = if is_lowend && requested_size >= 100 { (requested_size as f32 * 0.5) as u32 } else { requested_size };

    let decoded_path = percent_decode_str(path_query)
        .decode_utf8_lossy()
        .to_string();

    #[cfg(windows)]
    let mut decoded_path = decoded_path;
    #[cfg(windows)]
    if decoded_path.starts_with('/') && decoded_path.chars().nth(2) == Some(':') {
        decoded_path.remove(0);
    }

    let path = Path::new(&decoded_path);

    if !path.exists() {
        let _ = request.respond(Response::from_string("Not Found").with_status_code(404));
        return;
    }

    let final_path = path;

    // Handle cover art extraction
    if is_thumb {
        let path_hash = hash_string(&final_path.to_string_lossy());
        
        // 1. Check disk cache
        let cache_key = format!("{:x}_{}.jpg", path_hash, requested_size);
        let mut cached_path = None;
        if let Ok(lock) = COVERS_CACHE_DIR.lock() {
            if let Some(dir) = &*lock {
                cached_path = Some(dir.join(&cache_key));
            }
        }

        if let Some(ref cp) = cached_path {
            if cp.exists() {
                if let Ok(data) = fs::read(cp) {
                    let mut response = Response::from_data(data);
                    response.add_header(Header::from_bytes(&b"Content-Type"[..], b"image/jpeg").unwrap());
                    response.add_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
                    response.add_header(Header::from_bytes(&b"Cache-Control"[..], &b"public, max-age=604800, immutable"[..]).unwrap());
                    let _ = request.respond(response);
                    return;
                }
            }
        }

        // Extract and compress
        if let Ok(tagged) = lofty::read_from_path(final_path) {
            let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
            if let Some(t) = tag {
                if let Some(pic) = t.pictures().first() {
                    let raw_data = pic.data();

                    // Compress to 256x256
                    if let Ok(reader) =
                        ImageReader::new(Cursor::new(raw_data)).with_guessed_format()
                    {
                        if let Ok(img) = reader.decode() {
                            let resized = img.thumbnail(requested_size, requested_size);
                            let mut buffer = Cursor::new(Vec::new());
                            let quality = if is_lowend { 50 } else { 65 };
                            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality);
                            if encoder.encode_image(&resized.to_rgb8()).is_ok()
                            {
                                let compressed_data = buffer.into_inner();

                                // Cache the result
                                if let Some(ref cp) = cached_path {
                                    let _ = fs::write(cp, &compressed_data);
                                }

                                let mut response = Response::from_data(compressed_data);
                                response.add_header(
                                    Header::from_bytes(&b"Content-Type"[..], b"image/jpeg")
                                        .unwrap(),
                                );
                                response.add_header(
                                    Header::from_bytes(
                                        &b"Access-Control-Allow-Origin"[..],
                                        &b"*"[..],
                                    )
                                    .unwrap(),
                                );
                                response.add_header(
                                    Header::from_bytes(
                                        &b"Cache-Control"[..],
                                        &b"public, max-age=604800, immutable"[..],
                                    )
                                    .unwrap(),
                                );
                                let _ = request.respond(response);
                                return;
                            }
                        }
                    }
                }
            }
        }
        let _ = request.respond(Response::from_string("No Cover").with_status_code(404));
        return;
    }

    let ext = final_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let content_type = match ext.as_str() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" | "opus" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    };

    // Range support for seeking
    let mut range_start = 0;
    let mut range_end = None;
    let mut is_range = false;

    for header in request.headers() {
        if header.field.as_str().to_ascii_lowercase() == "range" {
            let val = header.value.as_str();
            if val.starts_with("bytes=") {
                let parts: Vec<&str> = val[6..].split('-').collect();
                if let Ok(s) = parts[0].parse::<u64>() {
                    range_start = s;
                    is_range = true;
                }
                if parts.len() > 1 && !parts[1].is_empty() {
                    if let Ok(e) = parts[1].parse::<u64>() {
                        range_end = Some(e);
                    }
                }
            }
        }
    }

    if let Ok(mut file) = fs::File::open(final_path) {
        use std::io::{Read, Seek, SeekFrom};
        let file_len = file.metadata().map(|m| m.len()).unwrap_or(0);
        let end = range_end.unwrap_or(file_len.saturating_sub(1));

        let length = if end >= range_start {
            end - range_start + 1
        } else {
            0
        };

        let is_head = request.method() == &tiny_http::Method::Head;

        if is_range {
            
            let headers = vec![
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                Header::from_bytes(&b"Access-Control-Expose-Headers"[..], &b"Content-Range, Accept-Ranges, Content-Length"[..]).unwrap(),
                Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
                Header::from_bytes(
                    &b"Content-Range"[..],
                    format!("bytes {}-{}/{}", range_start, end, file_len).as_bytes(),
                )
                .unwrap(),
                Header::from_bytes(&b"Cache-Control"[..], &b"no-cache, no-store, must-revalidate"[..]).unwrap(),
                Header::from_bytes(&b"Pragma"[..], &b"no-cache"[..]).unwrap(),
                Header::from_bytes(&b"Expires"[..], &b"0"[..]).unwrap(),
                Header::from_bytes(&b"Vary"[..], &b"Range"[..]).unwrap(),
            ];

            if is_head {
                let response = tiny_http::Response::new(
                    tiny_http::StatusCode(206),
                    headers,
                    std::io::empty(),
                    Some(length as usize),
                    None,
                )
                .with_chunked_threshold(usize::MAX);
                let _ = request.respond(response);
            } else {
                let _ = file.seek(SeekFrom::Start(range_start));
                let chunked_reader = file.take(length as u64);
                let response = tiny_http::Response::new(
                    tiny_http::StatusCode(206),
                    headers,
                    chunked_reader,
                    Some(length as usize),
                    None,
                )
                .with_chunked_threshold(usize::MAX);
                let _ = request.respond(response);
            }
        } else {
            
            let headers = vec![
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                Header::from_bytes(&b"Access-Control-Expose-Headers"[..], &b"Content-Range, Accept-Ranges, Content-Length"[..]).unwrap(),
                Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
                Header::from_bytes(&b"Cache-Control"[..], &b"no-cache, no-store, must-revalidate"[..]).unwrap(),
                Header::from_bytes(&b"Pragma"[..], &b"no-cache"[..]).unwrap(),
                Header::from_bytes(&b"Expires"[..], &b"0"[..]).unwrap(),
                Header::from_bytes(&b"Vary"[..], &b"Range"[..]).unwrap(),
            ];

            if is_head {
                let response = tiny_http::Response::new(
                    tiny_http::StatusCode(200),
                    headers,
                    std::io::empty(),
                    Some(file_len as usize),
                    None,
                )
                .with_chunked_threshold(usize::MAX);
                let _ = request.respond(response);
            } else {
                let mut response = Response::from_file(file)
                    .with_chunked_threshold(usize::MAX);
                for h in headers {
                    if h.field.as_str().to_ascii_lowercase() != "content-length" {
                        response.add_header(h);
                    }
                }
                let _ = request.respond(response);
            }
        }
    } else {
        let _ = request.respond(Response::from_string("Forbidden").with_status_code(403));
    }
}

#[tauri::command]
async fn fetch_lyrics(query: String) -> Result<Option<String>, String> {
    let url = format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(&query)
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", "Mewsic/0.7.2 (https://github.com/xeoniii/Mewsic)")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(results) = data.as_array() {
        if !results.is_empty() {
            let best = &results[0];
            let synced = best.get("syncedLyrics").and_then(|v| v.as_str());
            let plain = best.get("plainLyrics").and_then(|v| v.as_str());
            
            return Ok(synced.or(plain).map(|s| s.to_string()));
        }
    }

    Ok(None)
}

#[tauri::command]
async fn fetch_image_as_base64(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    let b64 = general_purpose::STANDARD.encode(bytes);

    Ok(format!("data:{};base64,{}", content_type, b64))
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn is_window_maximized(window: tauri::Window) -> Result<bool, String> {
    Ok(window.is_maximized().unwrap_or(false))
}

#[tauri::command]
fn set_window_decorations(window: tauri::Window, decorations: bool) -> Result<(), String> {
    window.set_decorations(decorations).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_window_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_image_cache() -> Result<(), String> {
    if let Ok(lock) = COVERS_CACHE_DIR.lock() {
        if let Some(dir) = &*lock {
            if dir.exists() {
                let _ = fs::remove_dir_all(dir);
                let _ = fs::create_dir_all(dir);
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn start_oauth_server(port: u16) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let server = Server::http(format!("127.0.0.1:{}", port))
            .map_err(|e| format!("Failed to bind server: {}", e))?;

        let start = std::time::Instant::now();
        
        while start.elapsed().as_secs() < 180 {
            if let Ok(Some(request)) = server.try_recv() {
                let url = request.url().to_string();
                
                let response_html = r#"
                    <html>
                    <body style="background:#000;color:#1DB954;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
                        <h2>Authorization successful! You can close this tab and return to Mewsic.</h2>
                        <script>setTimeout(() => window.close(), 1000);</script>
                    </body>
                    </html>
                "#;
                
                let response = Response::from_string(response_html)
                    .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html"[..]).unwrap());
                
                let _ = request.respond(response);

                if let Some(query_idx) = url.find('?') {
                    let query = &url[query_idx + 1..];
                    for pair in query.split('&') {
                        let mut kv = pair.split('=');
                        if let (Some(k), Some(v)) = (kv.next(), kv.next()) {
                            if k == "code" {
                                return Ok(v.to_string());
                            }
                        }
                    }
                }
                return Err("No code found in callback".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        
        Err("Timeout waiting for authorization".into())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn fetch_spotify_playlist(url: String) -> Result<String, String> {
    // Derive the embed URL from any playlist or album link
    let embed_url = if url.starts_with("https://open.spotify.com/playlist/") {
        let id = url
            .trim_start_matches("https://open.spotify.com/playlist/")
            .split('?').next().unwrap_or("").to_string();
        if id.is_empty() {
            return Err("Invalid Spotify playlist URL.".into());
        }
        format!("https://open.spotify.com/embed/playlist/{}", id)
    } else if url.starts_with("https://open.spotify.com/album/") {
        let id = url
            .trim_start_matches("https://open.spotify.com/album/")
            .split('?').next().unwrap_or("").to_string();
        if id.is_empty() {
            return Err("Invalid Spotify album URL.".into());
        }
        format!("https://open.spotify.com/embed/album/{}", id)
    } else if url.starts_with("https://open.spotify.com/track/") {
        let id = url
            .trim_start_matches("https://open.spotify.com/track/")
            .split('?').next().unwrap_or("").to_string();
        if id.is_empty() {
            return Err("Invalid Spotify track URL.".into());
        }
        format!("https://open.spotify.com/embed/track/{}", id)
    } else {
        return Err("Invalid Spotify URL. Must be a public playlist, album, or track link.".into());
    };

    println!("Mewsify fetching embed: {}", embed_url);

    let mut cmd = std::process::Command::new("curl");
    cmd.args(&[
        "-s",
        "-L",
        "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.5",
        &embed_url,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute curl: {}", e))?;
    let html = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
    println!("Mewsify embed fetch length: {}", html.len());

    // The embed page exposes all data in a __NEXT_DATA__ JSON script tag
    let re = regex::Regex::new(r#"(?s)<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>"#).unwrap();
    if let Some(caps) = re.captures(&html) {
        if let Some(json_match) = caps.get(1) {
            return Ok(json_match.as_str().to_string());
        }
    }

    Err(format!(
        "Could not find playlist metadata. Make sure the playlist is Public. (embed page length: {})",
        html.len()
    ))
}

#[derive(Clone, Serialize)]
struct SpotifyImportProgress {
    playlist_id: String,
    track_index: usize,
    track_total: usize,
    track_title: String,
    file_path: String, // empty if still in progress, filled when done
    error: Option<String>,
}

async fn fetch_track_cover_art(spotify_uri: &str) -> Option<String> {
    if !spotify_uri.starts_with("spotify:track:") {
        return None;
    }
    let id = spotify_uri.trim_start_matches("spotify:track:");
    let embed_url = format!("https://open.spotify.com/embed/track/{}", id);

    let mut cmd = std::process::Command::new("curl");
    cmd.args(&[
        "-s", "-L",
        "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "-H", "Accept-Language: en-US,en;q=0.5",
        &embed_url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd.output().ok()?;
    let html = String::from_utf8(output.stdout).ok()?;
    let re = regex::Regex::new(r#"(?s)<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>"#).ok()?;
    let json_str = re.captures(&html)?.get(1)?.as_str().to_string();
    let embed_data: serde_json::Value = serde_json::from_str(&json_str).ok()?;
    let entity = embed_data.pointer("/props/pageProps/state/data/entity")?;
    
    entity.pointer("/coverArt/sources/0/url")
        .or_else(|| entity.pointer("/visualIdentity/image/0/url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

#[tauri::command]
async fn import_spotify_playlist(
    app_handle: tauri::AppHandle,
    url: String,
    music_dir: String,
    playlist_id: String,
) -> Result<serde_json::Value, String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};

    // ── Step 1: Fetch embed JSON ─────────────────────────────────────────────
    let embed_url = if url.starts_with("https://open.spotify.com/playlist/") {
        let id = url.trim_start_matches("https://open.spotify.com/playlist/")
            .split('?').next().unwrap_or("").to_string();
        format!("https://open.spotify.com/embed/playlist/{}", id)
    } else if url.starts_with("https://open.spotify.com/album/") {
        let id = url.trim_start_matches("https://open.spotify.com/album/")
            .split('?').next().unwrap_or("").to_string();
        format!("https://open.spotify.com/embed/album/{}", id)
    } else {
        return Err("Invalid Spotify URL.".into());
    };

    let mut curl_cmd = Command::new("curl");
    curl_cmd.args(&[
        "-s", "-L",
        "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "-H", "Accept-Language: en-US,en;q=0.5",
        &embed_url,
    ]);
    #[cfg(target_os = "windows")]
    { use std::os::windows::process::CommandExt; curl_cmd.creation_flags(0x08000000); }

    let curl_out = curl_cmd.output().map_err(|e| format!("curl failed: {}", e))?;
    let html = String::from_utf8(curl_out.stdout).map_err(|e| e.to_string())?;

    let re = regex::Regex::new(r#"(?s)<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>"#).unwrap();
    let json_str = re.captures(&html)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| "Could not find embed data. Is the playlist public?".to_string())?;

    let embed_data: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("JSON parse error: {}", e))?;

    let entity = embed_data
        .pointer("/props/pageProps/state/data/entity")
        .ok_or("Could not find entity in embed data")?;

    let playlist_name = entity.get("name")
        .or_else(|| entity.get("title"))
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Playlist")
        .to_string();

    let cover_art_url = entity
        .pointer("/coverArt/sources/0/url")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let track_list = entity.get("trackList")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let playable_tracks: Vec<&serde_json::Value> = track_list.iter()
        .filter(|t| t.get("isPlayable").and_then(|v| v.as_bool()).unwrap_or(false)
            && t.get("title").and_then(|v| v.as_str()).is_some())
        .collect();

    let total = playable_tracks.len();
    if total == 0 {
        return Err("No playable tracks found in this playlist.".into());
    }

    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    let ffmpeg_path = get_ffmpeg_path(&app_handle).await;

    // Fetch cover art bytes once for all tracks
    let cover_bytes: Option<Vec<u8>> = if !cover_art_url.is_empty() {
        match reqwest::get(&cover_art_url).await {
            Ok(resp) => resp.bytes().await.ok().map(|b| b.to_vec()),
            Err(_) => None,
        }
    } else {
        None
    };

    let mut saved_paths: Vec<serde_json::Value> = Vec::new();

    for (idx, track) in playable_tracks.iter().enumerate() {
        let title = track.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let artist = track.get("subtitle").and_then(|v| v.as_str()).unwrap_or("Unknown Artist").to_string();
        let duration_ms = track.get("duration").and_then(|v| v.as_u64()).unwrap_or(0);
        let spotify_uri = track.get("uri").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let mut track_cover_bytes = cover_bytes.clone();
        let mut track_cover_url = cover_art_url.clone();

        if !spotify_uri.is_empty() {
            if let Some(individual_cover) = fetch_track_cover_art(&spotify_uri).await {
                if let Ok(resp) = reqwest::get(&individual_cover).await {
                    if let Ok(b) = resp.bytes().await {
                        track_cover_bytes = Some(b.to_vec());
                        track_cover_url = individual_cover;
                    }
                }
            }
        }

        // Emit progress: starting this track
        let _ = app_handle.emit("spotify-import-progress", SpotifyImportProgress {
            playlist_id: playlist_id.clone(),
            track_index: idx,
            track_total: total,
            track_title: title.clone(),
            file_path: String::new(),
            error: None,
        });

        let safe_title = title.replace('/', "_").replace('\\', "_");
        let safe_artist = artist.replace('/', "_").replace('\\', "_");
        let filename = format!("{} - {}.mp3", safe_artist, safe_title);
        let target_path = PathBuf::from(&music_dir).join(&filename);

        if !target_path.exists() {
            // Search YouTube and download
            let query = format!("ytsearch1:{} {} official audio", artist, title);
            let mut args = vec![
                "-4".to_string(),
                "--no-cache-dir".to_string(),
                "--no-check-certificates".to_string(),
                "--geo-bypass".to_string(),
                "--extractor-args".to_string(), "youtube:player-client=ios,android,web".to_string(),
                "--no-playlist".to_string(),
                "--prefer-ffmpeg".to_string(),
                "--newline".to_string(),
                "--progress".to_string(),
                "--extract-audio".to_string(),
                "--audio-format".to_string(), "mp3".to_string(),
                "--audio-quality".to_string(), "0".to_string(),
                "--output".to_string(), target_path.to_str().unwrap_or(&filename).to_string(),
            ];

            if ffmpeg_path.exists() {
                args.push("--ffmpeg-location".to_string());
                args.push(ffmpeg_path.to_str().unwrap().to_string());
            }
            args.push(query);

            let mut cmd = if yt_dlp_path.exists() {
                Command::new(&yt_dlp_path)
            } else {
                Command::new("yt-dlp")
            };
            cmd.args(&args);
            #[cfg(target_os = "windows")]
            { use std::os::windows::process::CommandExt; cmd.creation_flags(0x08000000); }
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::null());

            if let Ok(mut child) = cmd.spawn() {
                if let Some(stdout) = child.stdout.take() {
                    let reader = BufReader::new(stdout);
                    for line in reader.lines().flatten() {
                        if line.contains("[download]") && line.contains("%") {
                            // Forward download progress
                            let _ = app_handle.emit("spotify-import-progress", SpotifyImportProgress {
                                playlist_id: playlist_id.clone(),
                                track_index: idx,
                                track_total: total,
                                track_title: format!("Downloading: {}", title),
                                file_path: String::new(),
                                error: None,
                            });
                        }
                    }
                }
                let _ = child.wait();
            }
        }

        if target_path.exists() {
            // Tag the file with Spotify metadata + lyrics + cover
            if let Ok(mut tagged_file) = lofty::read_from_path(&target_path) {
                let tag = match tagged_file.primary_tag_mut() {
                    Some(t) => t,
                    None => {
                        let t_type = tagged_file.primary_tag_type();
                        tagged_file.insert_tag(Tag::new(t_type));
                        tagged_file.primary_tag_mut().unwrap()
                    }
                };

                tag.insert_text(ItemKey::TrackTitle, title.clone());
                tag.insert_text(ItemKey::TrackArtist, artist.clone());
                tag.insert_text(ItemKey::AlbumTitle, playlist_name.clone());

                let comment = format!("mws-id:{}\nmws-provider:spotify", spotify_uri);
                tag.insert_text(ItemKey::Comment, comment);

                // Fetch and embed lyrics
                let search_q = format!("{} {}", artist, title);
                if let Ok(Some(lyrics_text)) = fetch_lyrics(search_q).await {
                    tag.insert_text(ItemKey::Lyrics, lyrics_text);
                }

                // Embed cover art
                if let Some(ref bytes) = track_cover_bytes {
                    let picture = Picture::new_unchecked(
                        PictureType::CoverFront,
                        Some(MimeType::Jpeg),
                        None,
                        bytes.clone(),
                    );
                    tag.push_picture(picture);
                }

                let _ = tagged_file.save_to_path(&target_path);
            }

            let path_str = target_path.to_string_lossy().to_string();
            saved_paths.push(serde_json::json!({
                "filePath": path_str,
                "title": title,
                "artist": artist,
                "album": playlist_name,
                "duration": duration_ms / 1000,
                "spotifyUri": spotify_uri,
                "coverArt": track_cover_url,
            }));

            // Emit completion for this track
            let _ = app_handle.emit("spotify-import-progress", SpotifyImportProgress {
                playlist_id: playlist_id.clone(),
                track_index: idx,
                track_total: total,
                track_title: title.clone(),
                file_path: target_path.to_string_lossy().to_string(),
                error: None,
            });
        } else {
            let _ = app_handle.emit("spotify-import-progress", SpotifyImportProgress {
                playlist_id: playlist_id.clone(),
                track_index: idx,
                track_total: total,
                track_title: title.clone(),
                file_path: String::new(),
                error: Some("Download failed".to_string()),
            });
        }
    }

    Ok(serde_json::json!({
        "playlistName": playlist_name,
        "coverArt": cover_art_url,
        "tracks": saved_paths,
    }))
}

#[tauri::command]
fn force_quit(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Disable WebKitGTK's native MPRIS integration to prevent duplicate entries
        std::env::set_var("WEBKIT_DISABLE_MPRIS", "1");
        std::env::set_var("WEBKIT_DISABLE_MPRIS_PLUGIN", "1");
        
        // Memory-saving tweaks for WebKitGTK
        std::env::set_var("WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS", "1");
        std::env::set_var("G_SLICE", "always-malloc");
        std::env::set_var("MALLOC_CHECK_", "0");
        
        // Aggrersive memory pressure settings (reclaim memory faster)
        // format: "threshold_mb,threshold_percentage,kill_threshold_mb"
        std::env::set_var("WEBKIT_MEMORY_PRESSURE_SETTINGS", "128,15,512");

        // Tune PulseAudio / PipeWire latency buffer (in milliseconds)
        // High CPU load can cause audio underruns/crackling if the buffer is too small.
        // A larger buffer (200ms) prevents static/stuttering under heavy CPU utilization.
        std::env::set_var("PULSE_LATENCY_MSEC", "200");

        // Prevent Wayland Error 71 (Protocol error) crashes on Wayland compositors (e.g. Bazzite, GNOME)
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

        // Disable VA-API hardware video acceleration to prevent gst-plugin-scanner crashes/freezes on Intel graphics
        std::env::set_var("LIBVA_DRIVER_NAME", "disabled");
        std::env::set_var("GST_VAAPI_ALL_DRIVERS", "0");
    }


    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_localhost::Builder::new(1421).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            // Forward any file paths passed to the already-running instance
            for arg in args.iter().skip(1) {
                let path = arg.trim().to_string();
                if !path.starts_with('-') && !path.is_empty() {
                    let _ = app.emit("open-file", &path);
                }
            }
        }))
        .manage(DiscordState::new())
        .manage(AppState {
            tray_enabled: AtomicBool::new(true),
            dev_mode_enabled: AtomicBool::new(false),
        })
        .manage(HarbourState {
            token: Mutex::new(None),
            token_expiry: Mutex::new(0),
        })
        .setup(|app| {
            // ── Local Asset Server (tiny_http) ────────────────────────
            start_asset_server(1422);

            // Emit any file paths passed on cold start (double-clicked file)
            let cold_args: Vec<String> = std::env::args().skip(1).collect();
            for arg in &cold_args {
                let path = arg.trim().to_string();
                if !path.starts_with('-') && !path.is_empty() {
                    let handle = app.handle().clone();
                    let p = path.clone();
                    std::thread::spawn(move || {
                        // Short delay to let the webview finish loading before the event fires
                        std::thread::sleep(std::time::Duration::from_millis(1200));
                        let _ = handle.emit("open-file", &p);
                    });
                }
            }

            // ── OS Media Controls (MPRIS / SMTC / Now Playing) ────────
            let media_state = MediaManagerState::new(app.handle().clone());
            app.manage(media_state);

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>).unwrap();
            let show_i =
                MenuItem::with_id(app, "show", "Show Mewsic", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&show_i, &quit_i]).unwrap();
            let icon = app.default_window_icon().unwrap().clone();

            let tray = TrayIconBuilder::with_id("main_tray")
                .icon(icon.clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id().as_ref() == "quit" {
                        app.exit(0);
                    } else if event.id().as_ref() == "show" {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, .. } = event {
                        if button == MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)
                .unwrap();

            let _ = tray.set_visible(true); // default to true

            // Force the window icon for the main window (helps with dock icons on some Linux DEs)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }

            {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let mut sys = System::new_all();
                    let pid = sysinfo::get_current_pid().unwrap();
                    
                    loop {
                        if !handle.state::<AppState>().dev_mode_enabled.load(Ordering::Relaxed) {
                            std::thread::sleep(std::time::Duration::from_millis(1000));
                            continue;
                        }

                        // Refresh only processes and CPU statistics, avoiding heavy system-wide scans of disks/networks
                        sys.refresh_processes();
                        sys.refresh_cpu_usage();
                        
                        let mut total_cpu = 0.0;
                        let mut total_mem = 0;
                        
                        // Sum usage for main process and its children
                        let core_count = sys.cpus().len() as f32;
                        if let Some(main_p) = sys.process(pid) {
                            total_cpu += main_p.cpu_usage();
                            
                            // On Linux, use PSS for accuracy, otherwise fallback to RSS
                            let main_mem = get_process_pss(pid);
                            total_mem = if main_mem > 0 { main_mem } else { main_p.memory() };
                            
                            for (p_pid, process) in sys.processes() {
                                let name = process.name().to_lowercase();
                                let is_webview = name.contains("webkit") || name.contains("web content");
                                
                                if *p_pid != pid && is_webview && process.parent() == Some(pid) {
                                    total_cpu += process.cpu_usage();
                                    
                                    let child_mem = get_process_pss(*p_pid);
                                    total_mem += if child_mem > 0 { child_mem } else { process.memory() };
                                }
                            }
                        }
                        
                        // If it's still reporting massive numbers, it's likely KB units
                        // but sysinfo 0.30 claims bytes. We'll stick to bytes for now.

                        // Normalize CPU by core count to get 0-100%
                        let normalized_cpu = if core_count > 0.0 { total_cpu / core_count } else { total_cpu };

                        let _ = handle.emit("app-stats", AppStats {
                            cpu: normalized_cpu,
                            memory: total_mem,
                        });
                        
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            force_quit,
            get_app_paths,
            get_downloads_dir,
            scan_music_directory,
            get_track_metadata,
            list_playlists,
            create_playlist,
            save_playlist,
            rename_playlist,
            delete_playlist,
            pick_directory,
            get_cover_art,
            save_track_metadata,
            update_discord_rpc,
            clear_discord_rpc,
            set_tray_enabled,
            set_dev_mode,
            hide_window,
            toggle_fullscreen,
            import_files,
            import_playlist,
            harbour_search,
            download_track,
            ensure_dependencies,
            fetch_track_metadata,
            update_media_metadata,
            update_media_playback,
            clear_media_controls,
            delete_track,
            fetch_lyrics,
            fetch_image_as_base64,
            minimize_window,
            toggle_maximize_window,
            close_window,
            is_window_maximized,
            set_window_decorations,
            start_window_drag,
            clear_image_cache,
            get_plugins,
            get_plugins_dir,
            install_plugin_from_path,

            delete_plugin,
            show_in_folder,
            is_discord_connected,
            get_stream_url,
            resolve_stream_metadata,
            start_oauth_server,
            fetch_spotify_playlist,
            import_spotify_playlist,
        ])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Resized(_) 
                | tauri::WindowEvent::Moved(_) 
                | tauri::WindowEvent::Focused(_) 
                | tauri::WindowEvent::ScaleFactorChanged { .. } => {
                    // Emit a custom event when window state might have changed
                    let is_full = window.is_fullscreen().unwrap_or(false);
                    let _ = window.emit("fullscreen-changed", is_full);
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let app_state = window.state::<AppState>();
                    if app_state.tray_enabled.load(Ordering::Relaxed) {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect(&format!("error while running Mewsic v{}", env!("CARGO_PKG_VERSION")));
}
