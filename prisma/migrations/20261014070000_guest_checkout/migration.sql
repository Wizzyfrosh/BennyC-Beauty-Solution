-- CreateEnum
CREATE TYPE "AllocationState" AS ENUM ('held', 'committed', 'released', 'consumed');

-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN     "actor_type" TEXT NOT NULL DEFAULT 'staff',
ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "address_snapshot" JSONB,
ADD COLUMN     "customer_email" VARCHAR(254),
ADD COLUMN     "customer_name" VARCHAR(120),
ADD COLUMN     "customer_phone" VARCHAR(20),
ADD COLUMN     "delivery_zone_id" UUID,
ADD COLUMN     "exception_code" TEXT,
ADD COLUMN     "guest_session_id" UUID,
ADD COLUMN     "hold_expires_at" TIMESTAMPTZ,
ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "local_government_area" VARCHAR(100) NOT NULL,
    "areas" JSONB NOT NULL,
    "fee_kobo" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_allocations" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "state" "AllocationState" NOT NULL DEFAULT 'held',
    "expires_at" TIMESTAMPTZ,
    "release_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_access_tokens" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_intents" (
    "id" UUID NOT NULL,
    "guest_session_id" UUID NOT NULL,
    "request" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_token_hash_key" ON "guest_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "stock_allocations_batch_id_state_expires_at_idx" ON "stock_allocations"("batch_id", "state", "expires_at");

-- CreateIndex
CREATE INDEX "stock_allocations_order_item_id_idx" ON "stock_allocations"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_access_tokens_token_hash_key" ON "order_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "order_access_tokens_order_id_idx" ON "order_access_tokens"("order_id");

-- CreateIndex
CREATE INDEX "checkout_intents_guest_session_id_idx" ON "checkout_intents"("guest_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_id_variant_id_key" ON "stock_batches"("id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_id_variant_id_key" ON "order_items"("id", "variant_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_order_item_id_variant_id_fkey" FOREIGN KEY ("order_item_id", "variant_id") REFERENCES "order_items"("id", "variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_batch_id_variant_id_fkey" FOREIGN KEY ("batch_id", "variant_id") REFERENCES "stock_batches"("id", "variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_access_tokens" ADD CONSTRAINT "order_access_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_guest_session_id_fkey" FOREIGN KEY ("guest_session_id") REFERENCES "guest_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE stock_allocations ADD CONSTRAINT allocation_positive CHECK(quantity > 0), ADD CONSTRAINT held_expiry_required CHECK(state <> 'held' OR expires_at IS NOT NULL);
CREATE UNIQUE INDEX active_item_batch ON stock_allocations(order_item_id,batch_id) WHERE state IN ('held','committed');
ALTER TABLE delivery_zones ADD CONSTRAINT zone_fee_valid CHECK(fee_kobo BETWEEN 0 AND 2000000000), ADD CONSTRAINT zone_areas_array CHECK(jsonb_typeof(areas)='array' AND jsonb_array_length(areas)>0);
ALTER TABLE order_access_tokens ADD CONSTRAINT access_kind_valid CHECK(kind IN ('link','session'));
ALTER TABLE orders ADD CONSTRAINT website_contact_required CHECK(channel <> 'website' OR (guest_session_id IS NOT NULL AND customer_name IS NOT NULL AND customer_email IS NOT NULL AND customer_phone IS NOT NULL AND hold_expires_at IS NOT NULL)), ADD CONSTRAINT fulfilment_method_valid CHECK(fulfilment_method IN ('pickup','delivery')), ADD CONSTRAINT delivery_address_required CHECK(fulfilment_method <> 'delivery' OR (delivery_zone_id IS NOT NULL AND address_snapshot IS NOT NULL));
ALTER TABLE audit_events ADD CONSTRAINT audit_actor_valid CHECK((actor_type='staff' AND actor_user_id IS NOT NULL) OR (actor_type IN ('guest','system') AND actor_user_id IS NULL));
CREATE FUNCTION public.protect_order_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF ROW(OLD.order_number,OLD.channel,OLD.currency,OLD.fulfilment_method,OLD.subtotal_kobo,OLD.delivery_fee_kobo,OLD.tax_kobo,OLD.total_kobo,OLD.actor_user_id,OLD.operation_id,OLD.is_demo,OLD.guest_session_id,OLD.customer_name,OLD.customer_email,OLD.customer_phone,OLD.address_snapshot,OLD.delivery_zone_id,OLD.created_at) IS DISTINCT FROM ROW(NEW.order_number,NEW.channel,NEW.currency,NEW.fulfilment_method,NEW.subtotal_kobo,NEW.delivery_fee_kobo,NEW.tax_kobo,NEW.total_kobo,NEW.actor_user_id,NEW.operation_id,NEW.is_demo,NEW.guest_session_id,NEW.customer_name,NEW.customer_email,NEW.customer_phone,NEW.address_snapshot,NEW.delivery_zone_id,NEW.created_at) THEN
    RAISE EXCEPTION 'order snapshots are immutable' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_order_snapshot BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.protect_order_snapshot();
