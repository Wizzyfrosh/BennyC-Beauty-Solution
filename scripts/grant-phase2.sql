-- Apply only after Phase 2 migrations as the trusted database administrator.
\set ON_ERROR_STOP on
BEGIN;
GRANT SELECT, INSERT, UPDATE ON categories,products,product_variants,product_images,stock_batches,idempotency_requests,orders,payment_attempts TO :"runtime_role";
GRANT SELECT, INSERT ON inventory_movements,audit_events,order_items,batch_costs TO :"runtime_role";
GRANT EXECUTE ON FUNCTION public.lock_active_staff(text,boolean) TO :"runtime_role";
COMMIT;
-- Membership mutation, DDL, deletion and history UPDATE/DELETE remain denied.
