//! Double Bind - Rust shim for Tauri IPC
//!
//! This is the thinnest possible bridge between Tauri's IPC system and CozoDB's Rust API.
//! All business logic lives in TypeScript. See docs/infrastructure/rust-shim.md.

use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Manager;

/// Database state managed by Tauri
struct DbState(cozo::DbInstance);

/// Read-only queries using ScriptMutability::Immutable
#[tauri::command]
fn query(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let btree_params = params_to_btree(params);
    db.0.run_script_str(&script, btree_params, cozo::ScriptMutability::Immutable)
        .map_err(|e| e.to_string())
}

/// Write operations with blocklist for dangerous system operations
#[tauri::command]
fn mutate(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<serde_json::Value, String> {
    const BLOCKED_PATTERNS: &[&str] = &[
        "::remove",
        "::rename",
        "::set_triggers",
        "::access_level",
        ":replace",
        "::kill",
        "::fts",
        "::hnsw",
        "::lsh",
    ];

    let script_lower = script.to_lowercase();
    for pattern in BLOCKED_PATTERNS {
        if script_lower.contains(pattern) {
            return Err(format!("Blocked operation: {}", pattern));
        }
    }

    let btree_params = params_to_btree(params);
    db.0.run_script_str(&script, btree_params, cozo::ScriptMutability::Mutable)
        .map_err(|e| e.to_string())
}

/// Bulk import for data migration
#[tauri::command]
fn import_relations(
    db: tauri::State<'_, DbState>,
    data: HashMap<String, Vec<Vec<serde_json::Value>>>,
) -> Result<(), String> {
    db.0.import_relations_str_with_err(&data)
        .map_err(|e| e.to_string())
}

/// Bulk export for backup and data export
#[tauri::command]
fn export_relations(
    db: tauri::State<'_, DbState>,
    relations: Vec<String>,
) -> Result<HashMap<String, Vec<Vec<serde_json::Value>>>, String> {
    db.0.export_relations_str(relations.iter().map(|s| s.as_str()))
        .map_err(|e| e.to_string())
}

/// Point-in-time database backup
#[tauri::command]
fn backup(db: tauri::State<'_, DbState>, path: String) -> Result<(), String> {
    db.0.backup_db(&path).map_err(|e| e.to_string())
}

/// Convert HashMap to BTreeMap for CozoDB API
fn params_to_btree(
    params: HashMap<String, serde_json::Value>,
) -> std::collections::BTreeMap<String, serde_json::Value> {
    params.into_iter().collect()
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

/// Run database migrations before webview loads
///
/// Migrations run with ScriptMutability::Mutable directly — not through the
/// Tauri command blocklist. This allows ::create, ::remove, ::fts, etc.
///
/// Migration scripts are embedded via include_str!() from .sql files extracted
/// at build time. This avoids IPC round-trips and ensures migrations complete
/// before the app loads.
fn run_migrations(db: &cozo::DbInstance) -> Result<(), String> {
    // List of migrations: (name, embedded SQL content)
    let migrations: Vec<(&str, &str)> = vec![
        ("001-initial-schema", include_str!("../migrations/001-initial-schema.sql")),
        // Future migrations added here
    ];

    // Check current schema version from metadata relation
    let version_result = db.run_script_str(
        "?[value] := *metadata{ key: 'schema_version', value }",
        Default::default(),
        cozo::ScriptMutability::Immutable,
    );

    let current_version: i64 = match version_result {
        Ok(result) => {
            // Parse version from result; 0 if metadata relation doesn't exist yet
            result.rows.first()
                .and_then(|row| row[0].as_str())
                .and_then(|v| v.parse().ok())
                .unwrap_or(0)
        }
        Err(_) => 0, // metadata relation doesn't exist yet (fresh DB)
    };

    // Apply migrations that haven't been applied yet
    for (i, (name, script)) in migrations.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current_version {
            db.run_script_str(script, Default::default(), cozo::ScriptMutability::Mutable)
                .map_err(|e| format!("Migration {} failed: {}", name, e))?;
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = get_db_path(app.handle());
            let db = cozo::DbInstance::new(
                "rocksdb",
                db_path.to_str().unwrap(),
                Default::default(),
            )
            .expect("Failed to open database");

            // Run migrations before webview loads
            run_migrations(&db).expect("Migration failed");

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
