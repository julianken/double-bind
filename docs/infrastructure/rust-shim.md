# Rust Shim

## Purpose

The Rust shim is the thinnest possible bridge between Tauri's IPC system and CozoDB's Rust API. It exists because CozoDB is a Rust library and Tauri commands must be Rust functions. All business logic lives in TypeScript.

See [ADR 006](../decisions/006-shim-scope.md) for the design rationale.

## Commands

### 1. `query` — Read-Only Queries

```rust
#[tauri::command]
fn query(
    db: State<'_, DbState>,
    script: String,
    params: HashMap<String, JsonValue>,
) -> Result<JsonValue, String> {
    db.0
        .run_script_str(&script, params_to_btree(params), ScriptMutability::Immutable)
        .map_err(|e| e.to_string())
}
```

**Mutability**: `Immutable` — CozoDB engine rejects any `:put`, `:rm`, `:create`, `::remove`, etc. at the query compilation level.

**Allowed operations**: Read queries, graph algorithms (`<~ PageRank(...)`), FTS search (`~relation:fts`), system info (`::relations`, `::columns`, `::explain`).

### 2. `mutate` — Write Operations with Blocklist

```rust
const BLOCKED_PATTERNS: &[&str] = &[
    "::remove",
    "::rename",
    "::set_triggers",
    "::access_level",
    ":replace",
    "::kill",
    "::fts",      // drop/create FTS indexes (destructive)
    "::hnsw",     // drop/create HNSW indexes (destructive)
    "::lsh",      // drop/create LSH indexes (destructive)
];

#[tauri::command]
fn mutate(
    db: State<'_, DbState>,
    script: String,
    params: HashMap<String, JsonValue>,
) -> Result<JsonValue, String> {
    // String-level blocklist check
    let script_lower = script.to_lowercase();
    for pattern in BLOCKED_PATTERNS {
        if script_lower.contains(pattern) {
            return Err(format!("Blocked operation: {}", pattern));
        }
    }

    db.0
        .run_script_str(&script, params_to_btree(params), ScriptMutability::Mutable)
        .map_err(|e| e.to_string())
}
```

**Mutability**: `Mutable` — allows `:put`, `:rm`, `:create`, `:update`, `:delete`.

**Blocklist**: Rejects scripts containing dangerous system operations. See [Script Mutability](../security/script-mutability.md) for security analysis.

### 3. `import_relations` — Bulk Import

```rust
#[tauri::command]
fn import_relations(
    db: State<'_, DbState>,
    data: HashMap<String, Vec<Vec<JsonValue>>>,
) -> Result<(), String> {
    db.0
        .import_relations_str_with_err(&data)
        .map_err(|e| e.to_string())
}
```

Used for bulk import operations (e.g., importing a Roam Research JSON export).

**Security note**: `import_relations` bypasses `ScriptMutability` and skips FTS/HNSW/LSH index updates. The `-` prefix on relation names enables row deletion. This command should only be called from the `ImportExportService` in TypeScript, which validates inputs and rebuilds search indexes after import. See [threat model](../security/threat-model.md) for details.

### 4. `export_relations` — Bulk Export

```rust
#[tauri::command]
fn export_relations(
    db: State<'_, DbState>,
    relations: Vec<String>,
) -> Result<HashMap<String, Vec<Vec<JsonValue>>>, String> {
    db.0
        .export_relations_str(relations.iter().map(|s| s.as_str()))
        .map_err(|e| e.to_string())
}
```

Used for backup and data export features.

### 5. `backup` — Database Backup

```rust
#[tauri::command]
fn backup(
    db: State<'_, DbState>,
    path: String,
) -> Result<(), String> {
    db.0
        .backup_db(&path)
        .map_err(|e| e.to_string())
}
```

Creates a point-in-time backup of the entire RocksDB database to the specified path.

## Database Initialization

```rust
struct DbState(cozo::DbInstance);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // AppHandle is only available inside .setup(), not in main()
            let db_path = get_db_path(app.handle());
            let db = cozo::DbInstance::new("rocksdb", db_path.to_str().unwrap(), Default::default())
                .expect("Failed to open database");

            // Run migrations before webview loads.
            // Migrations use ScriptMutability::Mutable directly in Rust,
            // bypassing both the blocklist and the TypeScript layer.
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

fn run_migrations(db: &cozo::DbInstance) -> Result<(), String> {
    // Migrations run with ScriptMutability::Mutable directly — not through
    // the Tauri command blocklist. This allows ::create, ::remove, ::fts, etc.
    //
    // Strategy: TypeScript migration scripts are compiled into the Rust binary
    // as embedded strings (include_str!). This avoids a separate IPC round-trip
    // at startup and ensures migrations run before the webview loads.
    //
    // Migration scripts live in packages/migrations/src/migrations/*.sql
    // and are copied to src-tauri/migrations/ at build time by a build script.

    let migrations: Vec<(&str, &str)> = vec![
        ("001-initial-schema", include_str!("migrations/001-initial-schema.sql")),
        // Future migrations added here
    ];

    // Check current schema version
    let version_result = db.run_script_str(
        "?[value] := *metadata{ key: 'schema_version', value }",
        Default::default(),
        ScriptMutability::Immutable,
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

    for (i, (name, script)) in migrations.iter().enumerate() {
        let version = (i + 1) as i64;
        if version > current_version {
            db.run_script_str(script, Default::default(), ScriptMutability::Mutable)
                .map_err(|e| format!("Migration {} failed: {}", name, e))?;
        }
    }

    Ok(())
}

fn get_db_path(app: &tauri::AppHandle) -> PathBuf {
    // Tauri's path resolver provides platform-correct directories:
    // macOS:   ~/Library/Application Support/com.double-bind.app/db
    // Linux:   ~/.local/share/double-bind/db
    // Windows: %APPDATA%/double-bind/db
    let data_dir = app.path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");
    std::fs::create_dir_all(&data_dir)
        .expect("Failed to create app data directory");
    data_dir.join("db")
}
```

## What the Shim Does NOT Do

- **No query construction** — all Datalog strings are built in TypeScript
- **No result parsing** — raw JSON from CozoDB passes through to TypeScript
- **No caching** — Zustand + useCozoQuery handles caching in TypeScript
- **No validation** — TypeScript validates inputs before calling invoke
- **No authentication** — local-only app, no auth needed
- **No logging** — TypeScript logs via console, not Rust

## Testing the Shim

The Rust shim is tested via Layer 4 E2E tests (Playwright + Tauri binary). Specifically:
- `security.spec.ts` verifies `ScriptMutability::Immutable` rejects mutations via `query`
- `security.spec.ts` verifies blocklist rejects `::remove` via `mutate`
- `ipc-roundtrip.spec.ts` verifies data serialization round-trip

No separate Rust unit tests are needed for 40 lines of glue code.

## Dependencies

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = [] }
cozo = { version = "0.7", features = ["storage-rocksdb"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Resolved Decisions

- **CozoDB version**: `cozo = "0.7"` with `features = ["storage-rocksdb"]`. Pin exact patch version in `Cargo.lock`.
- **Database path**: Resolved via `tauri::AppHandle::path().app_data_dir()` — platform-correct (see `get_db_path` above).
- **Migration trigger**: `run_migrations()` runs inside the `tauri::Builder::setup()` hook — after `AppHandle` is available but before the webview loads. Migrations are embedded as `include_str!` from `.sql` files copied at build time.
- **Error serialization**: Errors are returned as plain strings (`e.to_string()`). TypeScript maps known error prefixes to `ErrorCode` enum values (e.g., `"Blocked operation:"` → `BLOCKED_OPERATION`). Structured error serialization is deferred — string matching is sufficient for the ~5 error cases the shim can produce.
- **Tauri v2 API compatibility**: The `.setup()` callback, `app.handle()`, `app.manage()`, and `app.path().app_data_dir()` are all confirmed Tauri v2 APIs. Both `App` and `AppHandle` implement the `Manager` trait, which provides `.path()`.
- **`import_relations` security**: Does not use a blocklist. The TypeScript `ImportExportService` validates inputs (no `-` prefix names unless explicitly importing deletions) and rebuilds FTS indexes after bulk import.
