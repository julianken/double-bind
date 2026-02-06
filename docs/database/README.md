# Database

CozoDB with RocksDB storage backend. All queries are Datalog, executed via parameterized `run_script`.

## Contents

| Document | Description |
|----------|-------------|
| [Schema](./schema.md) | Full relation definitions with annotations |
| [Key Design](./key-design.md) | Block key analysis — why simple key + index relations |
| [Indexes](./indexes.md) | Secondary index relations and FTS indexes |
| [Query Patterns](./query-patterns.md) | Common Datalog queries for each operation |
| [Migrations](./migrations.md) | Schema versioning and migration strategy |
| [CozoDB Patterns](./cozodb-patterns.md) | CozoDB-specific idioms, gotchas, and best practices |
