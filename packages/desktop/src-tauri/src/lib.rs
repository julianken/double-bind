//! Double Bind - Rust shim for Tauri IPC
//!
//! This is the thinnest possible bridge between Tauri's IPC system and CozoDB's Rust API.
//! All business logic lives in TypeScript. See docs/infrastructure/rust-shim.md.

use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

/// Database state managed by Tauri
struct DbState(cozo::DbInstance);

/// CozoDB response structure
#[derive(serde::Deserialize)]
struct CozoResponse {
    ok: bool,
    #[serde(default)]
    headers: Vec<String>,
    #[serde(default)]
    rows: Vec<Vec<serde_json::Value>>,
    #[serde(default)]
    message: Option<String>,
}

/// QueryResult structure expected by TypeScript
#[derive(serde::Serialize)]
struct QueryResult {
    headers: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
}

/// Parse CozoDB response and convert errors to Err
fn parse_cozo_response(result: &str) -> Result<QueryResult, String> {
    let response: CozoResponse = serde_json::from_str(result)
        .map_err(|e| format!("Failed to parse CozoDB response: {}", e))?;

    if !response.ok {
        return Err(response.message.unwrap_or_else(|| "Unknown database error".to_string()));
    }

    Ok(QueryResult {
        headers: response.headers,
        rows: response.rows,
    })
}

/// Read-only queries using immutable mode
#[tauri::command]
fn query(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<QueryResult, String> {
    let params_json = serde_json::to_string(&params).map_err(|e| e.to_string())?;
    let result = db.0.run_script_str(&script, &params_json, true); // immutable = true
    parse_cozo_response(&result)
}

/// Write operations - allows all operations for now (development mode)
#[tauri::command]
fn mutate(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<QueryResult, String> {
    // Note: In production, add blocklist for ::remove, ::rename, etc.
    let params_json = serde_json::to_string(&params).map_err(|e| e.to_string())?;
    let result = db.0.run_script_str(&script, &params_json, false); // immutable = false
    parse_cozo_response(&result)
}

/// Bulk import for data migration
#[tauri::command]
fn import_relations(
    db: tauri::State<'_, DbState>,
    data: HashMap<String, Vec<Vec<serde_json::Value>>>,
) -> Result<(), String> {
    let data_json = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    db.0.import_relations_str_with_err(&data_json)
        .map_err(|e| e.to_string())
}

/// Bulk export for backup and data export
#[tauri::command]
fn export_relations(
    db: tauri::State<'_, DbState>,
    relations: Vec<String>,
) -> Result<HashMap<String, Vec<Vec<serde_json::Value>>>, String> {
    let relations_json = serde_json::to_string(&relations).map_err(|e| e.to_string())?;
    let result = db.0.export_relations_str(&relations_json);
    serde_json::from_str(&result).map_err(|e| format!("Parse error: {}", e))
}

/// Point-in-time database backup
#[tauri::command]
fn backup(db: tauri::State<'_, DbState>, path: String) -> Result<(), String> {
    db.0.backup_db(&path).map_err(|e| e.to_string())
}

/// Get platform-correct database path
fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");
    std::fs::create_dir_all(&data_dir).expect("Failed to create app data directory");
    data_dir.join("db")
}

/// Try to open the database with retry logic for lock contention
fn open_database_with_retry(db_path: &str, max_retries: u32) -> Result<cozo::DbInstance, String> {
    for attempt in 0..max_retries {
        match cozo::DbInstance::new("rocksdb", db_path, Default::default()) {
            Ok(db) => return Ok(db),
            Err(e) => {
                let error_str = e.to_string();
                // Check if it's a lock error (another instance is running)
                if error_str.contains("LOCK") || error_str.contains("Resource temporarily unavailable") {
                    if attempt < max_retries - 1 {
                        eprintln!(
                            "Database locked (attempt {}/{}), waiting for other instance to exit...",
                            attempt + 1,
                            max_retries
                        );
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        continue;
                    }
                }
                return Err(format!("Failed to open database: {}", error_str));
            }
        }
    }
    Err("Failed to open database after max retries".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = get_db_path(app.handle());
            let db_path_str = db_path.to_str().ok_or("Invalid database path")?;

            // Try to open with retry logic - gives old process time to exit during hot reload
            let db = open_database_with_retry(db_path_str, 5)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

            app.manage(DbState(db));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            query,
            mutate,
            import_relations,
            export_relations,
            backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
