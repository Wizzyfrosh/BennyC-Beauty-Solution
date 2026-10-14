-- CreateEnum
CREATE TYPE "ExpiryPrecision" AS ENUM ('day', 'month', 'not_applicable');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('receipt', 'handoff', 'count_adjustment', 'quarantine', 'release', 'write_off');

-- CreateEnum
CREATE TYPE "OperationState" AS ENUM ('processing', 'completed');

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('walk_in', 'whatsapp', 'website');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'pending', 'paid', 'failed', 'partially_refunded', 'refunded');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('unfulfilled', 'preparing', 'ready_for_pickup', 'dispatched', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('manual', 'paystack', 'simulated');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('live', 'test', 'simulated');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('initialized', 'pending', 'succeeded', 'failed', 'abandoned');

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "batch_code" VARCHAR(100) NOT NULL,
    "receipt_reference" VARCHAR(100) NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" DATE,
    "expiry_precision" "ExpiryPrecision" NOT NULL,
    "expiry_label" VARCHAR(10),
    "on_hand_qty" INTEGER NOT NULL DEFAULT 0,
    "quarantined_qty" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_costs" (
    "batch_id" UUID NOT NULL,
    "unit_cost_kobo" INTEGER NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_costs_pkey" PRIMARY KEY ("batch_id")
);

-- CreateTable
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "actor_scope" TEXT NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "state" "OperationState" NOT NULL DEFAULT 'processing',
    "response" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "order_item_id" UUID,
    "operation_id" UUID NOT NULL,
    "line_key" TEXT NOT NULL,
    "movement_type" "MovementType" NOT NULL,
    "on_hand_delta" INTEGER NOT NULL,
    "quarantine_delta" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "channel" "OrderChannel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "fulfilment_method" TEXT NOT NULL DEFAULT 'pickup',
    "subtotal_kobo" INTEGER NOT NULL,
    "delivery_fee_kobo" INTEGER NOT NULL DEFAULT 0,
    "tax_kobo" INTEGER NOT NULL DEFAULT 0,
    "total_kobo" INTEGER NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "fulfilment_status" "FulfilmentStatus" NOT NULL DEFAULT 'unfulfilled',
    "confirmed_payment_attempt_id" UUID,
    "actor_user_id" TEXT NOT NULL,
    "operation_id" UUID NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "product_name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "options_snapshot" JSONB NOT NULL,
    "unit_price_kobo" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_kobo" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "provider_reference" VARCHAR(150),
    "amount_kobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "AttemptStatus" NOT NULL,
    "verification_method" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_batches_variant_id_active_expiry_date_idx" ON "stock_batches"("variant_id", "active", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_variant_id_batch_code_receipt_reference_key" ON "stock_batches"("variant_id", "batch_code", "receipt_reference");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_requests_operation_actor_scope_key_hash_key" ON "idempotency_requests"("operation", "actor_scope", "key_hash");

-- CreateIndex
CREATE INDEX "inventory_movements_batch_id_created_at_idx" ON "inventory_movements"("batch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_operation_id_batch_id_line_key_key" ON "inventory_movements"("operation_id", "batch_id", "line_key");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_confirmed_payment_attempt_id_key" ON "orders"("confirmed_payment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_operation_id_key" ON "orders"("operation_id");

-- CreateIndex
CREATE INDEX "orders_created_at_channel_idx" ON "orders"("created_at", "channel");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_idx" ON "payment_attempts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_provider_reference_key" ON "payment_attempts"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_id_order_id_key" ON "payment_attempts"("id", "order_id");

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_costs" ADD CONSTRAINT "batch_costs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_costs" ADD CONSTRAINT "batch_costs_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "idempotency_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "idempotency_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_confirmed_payment_attempt_id_fkey" FOREIGN KEY ("confirmed_payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "idempotency_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 2 integrity constraints and immutable financial/stock history.
ALTER TABLE stock_batches ADD CONSTRAINT batch_balance_valid CHECK (on_hand_qty >= 0 AND quarantined_qty >= 0 AND quarantined_qty <= on_hand_qty);
ALTER TABLE batch_costs ADD CONSTRAINT batch_cost_valid CHECK (unit_cost_kobo >= 0 AND unit_cost_kobo <= 2000000000);
ALTER TABLE orders ADD CONSTRAINT order_amounts_valid CHECK (currency = 'NGN' AND subtotal_kobo > 0 AND delivery_fee_kobo >= 0 AND tax_kobo >= 0 AND total_kobo::bigint = subtotal_kobo::bigint + delivery_fee_kobo + tax_kobo);
ALTER TABLE order_items ADD CONSTRAINT line_amounts_valid CHECK (quantity > 0 AND quantity <= 10000 AND unit_price_kobo > 0 AND line_total_kobo::bigint = unit_price_kobo::bigint * quantity);
ALTER TABLE payment_attempts ADD CONSTRAINT attempt_amount_valid CHECK (amount_kobo > 0 AND currency = 'NGN');
ALTER TABLE orders ADD CONSTRAINT confirmed_payment_same_order FOREIGN KEY (confirmed_payment_attempt_id,id) REFERENCES payment_attempts(id,order_id);
ALTER TABLE stock_batches ADD CONSTRAINT batch_expiry_precision_valid CHECK ((expiry_precision = 'day') OR (expiry_precision = 'month' AND expiry_date IS NULL) OR (expiry_precision = 'not_applicable' AND expiry_date IS NULL AND expiry_label IS NULL));
CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'History is append-only' USING ERRCODE = '42501'; END; $$;
CREATE TRIGGER immutable_inventory_history BEFORE UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_audit_history BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_history_change();
CREATE TRIGGER immutable_order_items BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION reject_history_change();

-- PostgreSQL requires UPDATE privilege for a row share-lock. A narrowly scoped
-- definer function supplies that lock without granting membership writes to the
-- runtime role. It only checks/locks; the verified server session supplies actor.
CREATE FUNCTION public.lock_active_staff(actor text, owner_required boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE staff_role text;
BEGIN
  SELECT role::text INTO staff_role FROM public.staff_members WHERE user_id = actor AND active FOR SHARE;
  IF staff_role IS NULL OR (owner_required AND staff_role <> 'owner') THEN RETURN NULL; END IF;
  RETURN staff_role;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_active_staff(text,boolean) FROM PUBLIC;
