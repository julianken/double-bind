//! Double Bind - Rust shim for Tauri IPC
//!
//! Thin bridge between Tauri's IPC system and SQLite via rusqlite.
//! All business logic lives in TypeScript. See docs/infrastructure/rust-shim.md.

mod db;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::types::Value;
use tauri::Manager;

/// Database state managed by Tauri. Mutex makes the connection safe across threads.
struct DbState(Mutex<rusqlite::Connection>);

/// QueryResult structure expected by TypeScript.
#[derive(serde::Serialize)]
struct QueryResult {
    headers: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
}

/// A single statement in a transaction batch.
#[derive(serde::Deserialize)]
struct TransactionStatement {
    script: String,
    #[serde(default)]
    params: HashMap<String, serde_json::Value>,
}

/// Convert a rusqlite Value to a serde_json Value.
fn sqlite_to_json(val: Value) -> serde_json::Value {
    match val {
        Value::Null => serde_json::Value::Null,
        Value::Integer(i) => serde_json::json!(i),
        Value::Real(f) => serde_json::json!(f),
        Value::Text(s) => serde_json::json!(s),
        Value::Blob(b) => serde_json::json!(b),
    }
}

/// Convert JSON params map into a Vec of (name, rusqlite Value) pairs.
/// The TypeScript side sends `{ name: value }` where SQL uses `$name`.
/// rusqlite expects param names prefixed with `$`, `:`, or `@`.
fn json_params_to_named(params: &HashMap<String, serde_json::Value>) -> Vec<(String, Box<dyn rusqlite::types::ToSql>)> {
    params
        .iter()
        .map(|(key, val)| {
            let name = if key.starts_with('$') || key.starts_with(':') || key.starts_with('@') {
                key.clone()
            } else {
                format!("${}", key)
            };
            let boxed: Box<dyn rusqlite::types::ToSql> = match val {
                serde_json::Value::Null => Box::new(Option::<String>::None),
                serde_json::Value::Bool(b) => Box::new(if *b { 1i64 } else { 0i64 }),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i)
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f)
                    } else {
                        Box::new(n.to_string())
                    }
                }
                serde_json::Value::String(s) => Box::new(s.clone()),
                other => Box::new(other.to_string()),
            };
            (name, boxed)
        })
        .collect()
}

/// Execute a read-only SELECT query, returning headers and rows.
#[tauri::command]
fn query(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<QueryResult, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let named = json_params_to_named(&params);
    let param_refs: Vec<(&str, &dyn rusqlite::types::ToSql)> = named
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_ref() as &dyn rusqlite::types::ToSql))
        .collect();

    let mut stmt = conn.prepare(&script).map_err(|e| format!("Prepare error: {}", e))?;

    let headers: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let col_count = headers.len();

    let rows: Vec<Vec<serde_json::Value>> = stmt
        .query_map(param_refs.as_slice(), |row| {
            let mut vals = Vec::with_capacity(col_count);
            for i in 0..col_count {
                let val: Value = row.get(i)?;
                vals.push(sqlite_to_json(val));
            }
            Ok(vals)
        })
        .map_err(|e| format!("Query error: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {}", e))?;

    Ok(QueryResult { headers, rows })
}

/// Execute a write operation (INSERT/UPDATE/DELETE), returning affected row count.
#[tauri::command]
fn mutate(
    db: tauri::State<'_, DbState>,
    script: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<QueryResult, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let named = json_params_to_named(&params);
    let param_refs: Vec<(&str, &dyn rusqlite::types::ToSql)> = named
        .iter()
        .map(|(k, v)| (k.as_str(), v.as_ref() as &dyn rusqlite::types::ToSql))
        .collect();

    let affected = conn
        .execute(&script, param_refs.as_slice())
        .map_err(|e| format!("Mutate error: {}", e))?;

    Ok(QueryResult {
        headers: vec!["affected_rows".to_string()],
        rows: vec![vec![serde_json::json!(affected)]],
    })
}

/// Execute multiple statements atomically inside a transaction.
#[tauri::command]
fn transaction(
    db: tauri::State<'_, DbState>,
    statements: Vec<TransactionStatement>,
) -> Result<QueryResult, String> {
    let mut conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let tx = conn.transaction().map_err(|e| format!("Transaction begin error: {}", e))?;

    let mut total_affected: usize = 0;
    for stmt_def in &statements {
        let named = json_params_to_named(&stmt_def.params);
        let param_refs: Vec<(&str, &dyn rusqlite::types::ToSql)> = named
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_ref() as &dyn rusqlite::types::ToSql))
            .collect();

        let affected = tx
            .execute(&stmt_def.script, param_refs.as_slice())
            .map_err(|e| format!("Transaction statement error: {}", e))?;
        total_affected += affected;
    }

    tx.commit().map_err(|e| format!("Transaction commit error: {}", e))?;

    Ok(QueryResult {
        headers: vec!["affected_rows".to_string()],
        rows: vec![vec![serde_json::json!(total_affected)]],
    })
}

/// Bulk import: accept `{ tableName: [[values...], ...] }` and insert via prepared statements.
#[tauri::command]
fn import_relations(
    db: tauri::State<'_, DbState>,
    data: HashMap<String, Vec<Vec<serde_json::Value>>>,
) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let tx = conn.transaction().map_err(|e| format!("Transaction error: {}", e))?;

    for (table, rows) in &data {
        if rows.is_empty() {
            continue;
        }
        let col_count = rows[0].len();
        let placeholders: Vec<String> = (0..col_count).map(|_| "?".to_string()).collect();
        let sql = format!(
            "INSERT INTO \"{}\" VALUES ({})",
            table.replace('"', "\"\""),
            placeholders.join(", ")
        );
        let mut stmt = tx.prepare(&sql).map_err(|e| format!("Prepare error for {}: {}", table, e))?;

        for row in rows {
            let params: Vec<Box<dyn rusqlite::types::ToSql>> = row
                .iter()
                .map(|val| -> Box<dyn rusqlite::types::ToSql> {
                    match val {
                        serde_json::Value::Null => Box::new(Option::<String>::None),
                        serde_json::Value::Bool(b) => Box::new(if *b { 1i64 } else { 0i64 }),
                        serde_json::Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                Box::new(i)
                            } else if let Some(f) = n.as_f64() {
                                Box::new(f)
                            } else {
                                Box::new(n.to_string())
                            }
                        }
                        serde_json::Value::String(s) => Box::new(s.clone()),
                        other => Box::new(other.to_string()),
                    }
                })
                .collect();
            let param_refs: Vec<&dyn rusqlite::types::ToSql> =
                params.iter().map(|p| p.as_ref()).collect();
            stmt.execute(param_refs.as_slice())
                .map_err(|e| format!("Insert error for {}: {}", table, e))?;
        }
    }

    tx.commit().map_err(|e| format!("Import commit error: {}", e))
}

/// Bulk export: SELECT * from each named table and return rows.
#[tauri::command]
fn export_relations(
    db: tauri::State<'_, DbState>,
    relations: Vec<String>,
) -> Result<HashMap<String, Vec<Vec<serde_json::Value>>>, String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let mut result = HashMap::new();

    for table in &relations {
        let sql = format!("SELECT * FROM \"{}\"", table.replace('"', "\"\""));
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare error for {}: {}", table, e))?;
        let col_count = stmt.column_count();

        let rows: Vec<Vec<serde_json::Value>> = stmt
            .query_map([], |row| {
                let mut vals = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    let val: Value = row.get(i)?;
                    vals.push(sqlite_to_json(val));
                }
                Ok(vals)
            })
            .map_err(|e| format!("Query error for {}: {}", table, e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Row error for {}: {}", table, e))?;

        result.insert(table.clone(), rows);
    }

    Ok(result)
}

/// Database backup using rusqlite's backup API.
#[tauri::command]
fn backup(db: tauri::State<'_, DbState>, path: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let mut dest = rusqlite::Connection::open(&path)
        .map_err(|e| format!("Failed to open backup destination: {}", e))?;
    let backup = rusqlite::backup::Backup::new(&conn, &mut dest)
        .map_err(|e| format!("Backup init error: {}", e))?;
    backup
        .run_to_completion(100, std::time::Duration::from_millis(50), None)
        .map_err(|e| format!("Backup error: {}", e))
}

/// Restore database from a backup file.
#[tauri::command]
fn restore(db: tauri::State<'_, DbState>, path: String) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let src = rusqlite::Connection::open(&path)
        .map_err(|e| format!("Failed to open backup source: {}", e))?;
    let backup = rusqlite::backup::Backup::new(&src, &mut *conn)
        .map_err(|e| format!("Restore init error: {}", e))?;
    backup
        .run_to_completion(100, std::time::Duration::from_millis(50), None)
        .map_err(|e| format!("Restore error: {}", e))
}

/// Explicit connection cleanup.
#[tauri::command]
fn close(db: tauri::State<'_, DbState>) -> Result<(), String> {
    // Trigger a PRAGMA optimize before closing for query planner stats
    let conn = db.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    let _ = conn.execute_batch("PRAGMA optimize;");
    Ok(())
}

/// Get platform-correct database path.
fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");
    std::fs::create_dir_all(&data_dir).expect("Failed to create app data directory");
    data_dir.join("double-bind.db")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = get_db_path(app.handle());
            let db_path_str = db_path.to_str().ok_or("Invalid database path")?;

            let conn = db::init_database(db_path_str)
                .map_err(|e| Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            query,
            mutate,
            transaction,
            import_relations,
            export_relations,
            backup,
            restore,
            close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
