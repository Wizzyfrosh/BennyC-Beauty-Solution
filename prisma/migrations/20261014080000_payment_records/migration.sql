-- AlterEnum
ALTER TYPE "MovementType" ADD VALUE 'return_quarantine';

-- AlterTable
ALTER TABLE "payment_attempts" ADD COLUMN     "authorization_url" TEXT,
ADD COLUMN     "init_lease_until" TIMESTAMPTZ,
ADD COLUMN     "last_checked_at" TIMESTAMPTZ,
ADD COLUMN     "provider_transaction_id" TEXT;

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "event_key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_digest" VARCHAR(64) NOT NULL,
    "fields" JSONB NOT NULL,
    "result" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "provider_reference" TEXT,
    "amount_kobo" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requested_by" TEXT,
    "operation_id" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_outbox" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_key_key" ON "payment_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_provider_reference_key" ON "refunds"("provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_operation_id_key" ON "refunds"("operation_id");

-- CreateIndex
CREATE INDEX "refunds_payment_attempt_id_status_idx" ON "refunds"("payment_attempt_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_outbox_dedupe_key_key" ON "notification_outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_outbox_state_next_attempt_at_idx" ON "notification_outbox"("state", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_order_id_key" ON "receipts"("order_id");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE refunds ADD CONSTRAINT refund_amount_valid CHECK(amount_kobo BETWEEN 1 AND 2000000000), ADD CONSTRAINT refund_status_valid CHECK(status IN ('REQUESTED','PROCESSING','SUCCEEDED','FAILED')), ADD CONSTRAINT refund_source_valid CHECK(source IN ('app','external','simulated'));
ALTER TABLE refunds ADD CONSTRAINT refund_actor_fk FOREIGN KEY(requested_by) REFERENCES public."user"(id) ON DELETE RESTRICT;
ALTER TABLE refunds ADD CONSTRAINT refund_operation_fk FOREIGN KEY(operation_id) REFERENCES public.idempotency_requests(id) ON DELETE RESTRICT;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_state_valid CHECK(state IN ('QUEUED','PROCESSING','SENT','FAILED')), ADD CONSTRAINT notification_count_valid CHECK(attempt_count>=0);
CREATE TRIGGER payment_events_append_only BEFORE UPDATE OR DELETE ON payment_events FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();
CREATE TRIGGER receipts_append_only BEFORE UPDATE OR DELETE ON receipts FOR EACH ROW EXECUTE FUNCTION public.reject_history_change();
CREATE FUNCTION public.protect_payment_expected() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN
 IF ROW(OLD.order_id,OLD.provider,OLD.payment_mode,OLD.amount_kobo,OLD.currency,OLD.provider_reference) IS DISTINCT FROM ROW(NEW.order_id,NEW.provider,NEW.payment_mode,NEW.amount_kobo,NEW.currency,NEW.provider_reference) THEN RAISE EXCEPTION 'payment expectations are immutable' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER immutable_payment_expected BEFORE UPDATE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION public.protect_payment_expected();
