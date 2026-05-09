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
}

impl DiscordState {
    fn new() -> Self {
        let (tx, rx) = std::sync::mpsc::channel::<DiscordCommand>();

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
                                }
                            }
                        }

                        if let Some(c) = client.as_mut() {
                            let details = title.clone();
                            let state_str = format!("by {}", artist);
                            let small_text = if is_playing {
                                "Playing".to_string()
                            } else {
                                let mins = (current_time / 60.0).floor() as u32;
                                let secs = (current_time % 60.0).floor() as u32;
                                format!("Paused at {:02}:{:02}", mins, secs)
                            };

                            let large_image = cover_url.unwrap_or_else(|| "cover".to_string());
                            let mut activity = activity::Activity::new()
                                .details(&details)
                                .state(&state_str)
                                .activity_type(activity::ActivityType::Listening)
                                .assets(
                                    activity::Assets::new()
                                        .large_image(&large_image)
                                        .small_image("icon")
                                        .large_text(&playlist_name)
                                        .small_text(&small_text),
                                )
                                .buttons(vec![activity::Button::new(
                                    "Download Mewsic",
                                    "https://xeoniii.github.io/Mewsic",
                                )]);

                            if is_playing {
                                let start_time = now as i64 - current_time as i64;
                                let mut timestamps = activity::Timestamps::new().start(start_time);
                                if duration > 0.0 {
                                    timestamps = timestamps.end(start_time + duration as i64);
                                }
                                activity = activity.timestamps(timestamps);
                            }

                            if c.set_activity(activity).is_err() {
                                client = None;
                            }
                        }
                    }
                    DiscordCommand::Clear => {
                        if let Some(mut c) = client.take() {
                            let _ = c.clear_activity();
                            let _ = c.close();
                        }
                    }
                }
            }
        });

        Self { tx: Mutex::new(tx) }
    }
}

pub struct AppState {
    pub tray_enabled: AtomicBool,
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
}

pub struct HarbourState {
    pub token: Mutex<Option<String>>,
    pub token_expiry: Mutex<u64>,
}

static COVERS_CACHE_DIR: Mutex<Option<PathBuf>> = Mutex::new(None);

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
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .collect();

    let (tracks, errors): (Vec<Track>, Vec<String>) = entries
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
        .collect::<Vec<_>>()
        .into_iter()
        .fold((Vec::new(), Vec::new()), |(mut ts, mut es), (t, e)| {
            if let Some(track) = t {
                ts.push(track);
            }
            if let Some(err) = e {
                es.push(err);
            }
            (ts, es)
        });

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
    
    let mut new_path = parent.join(format!("{}.json", safe_name));
    
    // Handle collisions
    let mut counter = 1;
    while new_path.exists() && new_path != old_path {
        new_path = parent.join(format!("{} ({}).json", safe_name, counter));
        counter += 1;
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
        _ => search_jiosaavn(app_handle, query).await, // Default
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

async fn youtube_search_fallback(app_handle: tauri::AppHandle, query: String) -> Result<Vec<HarbourSearchResult>, String> {
    use std::process::Command;
    let search_query = format!("ytsearch20:{} official audio", query);
    let yt_dlp_path = get_yt_dlp_path(&app_handle).await;
    
    let output = if yt_dlp_path.exists() {
        Command::new(&yt_dlp_path)
            .args([
                "--dump-json",
                "--flat-playlist",
                "--no-playlist",
                "--default-search", "ytsearch",
                "--no-check-certificates",
                "--geo-bypass",
                "--extractor-args", "youtube:player-client=ios,android,web",
                &search_query
            ])
            .output()
            .map_err(|e| format!("YouTube search failed (local): {}", e))?
    } else {
        Command::new("yt-dlp")
            .args([
                "--dump-json",
                "--flat-playlist",
                "--no-playlist",
                "--default-search", "ytsearch",
                "--no-check-certificates",
                "--geo-bypass",
                "--extractor-args", "youtube:player-client=ios,android,web",
                &search_query
            ])
            .output()
            .map_err(|e| format!("YouTube search failed (system): {}", e))?
    };

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
                cover_art: item["thumbnails"][0]["url"]
                    .as_str()
                    .unwrap_or_default()
                    .to_string(),
                url: item["url"].as_str().unwrap_or_default().to_string(),
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
fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
    Ok(())
}

fn start_asset_server(port: u16) {
    let addr = format!("127.0.0.1:{}", port);
    std::thread::spawn(move || {
        match Server::http(&addr) {
            Ok(server) => {
                let server = std::sync::Arc::new(server);
                // Spawn 32 worker threads to handle requests in parallel
                for _ in 0..32 {
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
    let query = url.query().unwrap_or("");
    let is_thumb = query.contains("thumb=1");
    let requested_size = url.query_pairs()
        .find(|(k, _)| k == "size")
        .and_then(|(_, v)| v.parse::<u32>().ok())
        .unwrap_or(256);
    
    let is_lowend = query.contains("lowend=1");
    let requested_size = if is_lowend { (requested_size as f32 * 0.75) as u32 } else { requested_size };

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
        // Generate a cache key based on the file path hash and size
        let cache_key = format!("{:x}_{}.jpg", hash_string(&final_path.to_string_lossy()), requested_size);
        let mut cached_path = None;
        if let Ok(lock) = COVERS_CACHE_DIR.lock() {
            if let Some(dir) = &*lock {
                cached_path = Some(dir.join(&cache_key));
            }
        }

        // Return cached cover if available
        if let Some(ref cp) = cached_path {
            if cp.exists() {
                if let Ok(data) = fs::read(cp) {
                    let mut response = Response::from_data(data);
                    response.add_header(
                        Header::from_bytes(&b"Content-Type"[..], b"image/jpeg").unwrap(),
                    );
                    response.add_header(
                        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                    );
                    response.add_header(
                        Header::from_bytes(&b"Cache-Control"[..], &b"public, max-age=604800, immutable"[..]).unwrap(),
                    );
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
                            if resized
                                .write_to(&mut buffer, image::ImageFormat::Jpeg)
                                .is_ok()
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

        if is_range {
            let _ = file.seek(SeekFrom::Start(range_start));
            let chunked_reader = file.take(length as u64);

            let headers = vec![
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap(),
                Header::from_bytes(
                    &b"Content-Range"[..],
                    format!("bytes {}-{}/{}", range_start, end, file_len).as_bytes(),
                )
                .unwrap(),
            ];

            let response = tiny_http::Response::new(
                tiny_http::StatusCode(206),
                headers,
                chunked_reader,
                Some(length as usize),
                None,
            );
            let _ = request.respond(response);
        } else {
            let mut response = Response::from_file(file);
            response.add_header(
                Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
            );
            response.add_header(
                Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
            );
            response.add_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());
            let _ = request.respond(response);
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

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Disable WebKitGTK's native MPRIS integration to prevent duplicate entries
        std::env::set_var("WEBKIT_DISABLE_MPRIS", "1");
        std::env::set_var("WEBKIT_DISABLE_MPRIS_PLUGIN", "1");
    }


    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_localhost::Builder::new(1421).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(DiscordState::new())
        .manage(AppState {
            tray_enabled: AtomicBool::new(true),
        })
        .manage(HarbourState {
            token: Mutex::new(None),
            token_expiry: Mutex::new(0),
        })
        .setup(|app| {
            // ── Local Asset Server (tiny_http) ────────────────────────
            start_asset_server(1422);

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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_paths,
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
            get_downloads_dir,
            clear_image_cache,
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
