use std::fs;
use std::path::PathBuf;

use tauri::Manager;

fn token_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create_dir_all: {e}"))?;
    dir.push("spotify_refresh_token");
    Ok(dir)
}

#[tauri::command]
fn save_refresh_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let path = token_path(&app)?;
    fs::write(&path, token).map_err(|e| format!("write: {e}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
fn load_refresh_token(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = token_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("read: {e}")),
    }
}

#[tauri::command]
fn clear_refresh_token(app: tauri::AppHandle) -> Result<(), String> {
    let path = token_path(&app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("remove: {e}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_refresh_token,
            load_refresh_token,
            clear_refresh_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
