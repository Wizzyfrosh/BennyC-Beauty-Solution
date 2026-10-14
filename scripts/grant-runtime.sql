-- Run with psql as the trusted migration/database administrator AFTER migrations:
-- psql "$DIRECT_URL" -v runtime_role=bennyc_runtime -f scripts/grant-runtime.sql
-- Provision this separate LOGIN role privately first; never grant it schema ownership.
\set ON_ERROR_STOP on
BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT ON store_settings, staff_members, categories, products, product_variants, product_images TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", "session", "account", "verification", "rateLimit" TO :"runtime_role";
COMMIT;
-- No business write/DDL grants in Phase 1. Review/add only the required privileges in Phase 2.
