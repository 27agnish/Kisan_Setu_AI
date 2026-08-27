# Database Migrations

This directory contains database migration scripts, schema versioning, and documentation for **Kisan Setu**.

## Current Schema Engine
- **Engine**: SQLite / SQLAlchemy ORM
- **Default Database**: `database/kisan_setu.db`
- **Schema Management**: SQLAlchemy declarative base models (`backend/models/`) with auto-generation via `Base.metadata.create_all()`.

## Seeding
Initial demonstration accounts, APMC mandi historical baseline records, 9-stage tracking events, and logistics vehicles are managed in `database/seed/seed_data.py`.
