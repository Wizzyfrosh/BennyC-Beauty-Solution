-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "business_hours" TEXT,
ADD COLUMN     "delivery_policy" TEXT,
ADD COLUMN     "privacy_policy" TEXT,
ADD COLUMN     "returns_policy" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "twoFactorEnabled" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "job_leases" (
    "name" TEXT NOT NULL,
    "token" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_leases_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "actor_scope" TEXT NOT NULL,
    "key_hash" VARCHAR(64) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RUNNING',
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "result" JSONB,
    "error_code" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_started_at_idx" ON "job_runs"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_name_actor_scope_key_hash_key" ON "job_runs"("name", "actor_scope", "key_hash");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE INDEX "inventory_movements_created_at_movement_type_idx" ON "inventory_movements"("created_at", "movement_type");

-- CreateIndex
CREATE INDEX "orders_paid_at_is_demo_channel_idx" ON "orders"("paid_at", "is_demo", "channel");

-- CreateIndex
CREATE INDEX "orders_exception_code_payment_status_idx" ON "orders"("exception_code", "payment_status");

-- CreateIndex
CREATE INDEX "payment_attempts_provider_status_last_checked_at_idx" ON "payment_attempts"("provider", "status", "last_checked_at");

-- CreateIndex
CREATE INDEX "stock_allocations_state_expires_at_idx" ON "stock_allocations"("state", "expires_at");

-- CreateIndex
CREATE INDEX "refunds_confirmed_at_status_idx" ON "refunds"("confirmed_at", "status");

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE job_runs ADD CONSTRAINT job_state_valid CHECK(state IN ('RUNNING','SUCCEEDED','FAILED')), ADD CONSTRAINT job_attempts_valid CHECK(attempts>0);
CREATE FUNCTION public.manage_staff(actor_id text,target_id text,new_role text,new_active boolean,operation_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor_role text; target_role text; target_active boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(72601302);
 actor_role:=public.lock_active_staff(actor_id,true);
 IF actor_role IS NULL THEN RAISE EXCEPTION 'active owner required' USING ERRCODE='42501'; END IF;
 IF new_role NOT IN ('owner','staff') OR new_active IS NULL THEN RAISE EXCEPTION 'invalid staff update' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.idempotency_requests r WHERE r.id=operation_id AND r.operation='staff.manage' AND r.actor_scope=actor_id AND r.state='processing') THEN RAISE EXCEPTION 'authorized operation required' USING ERRCODE='42501'; END IF;
 SELECT role::text,active INTO target_role,target_active FROM public.staff_members WHERE user_id=target_id FOR UPDATE;
 IF target_role IS NULL THEN RAISE EXCEPTION 'staff member missing' USING ERRCODE='P0002'; END IF;
 IF target_role='owner' AND target_active AND (new_role<>'owner' OR NOT new_active) AND (SELECT COUNT(*) FROM public.staff_members WHERE role='owner' AND active)<=1 THEN RAISE EXCEPTION 'last active owner cannot be removed' USING ERRCODE='P0001'; END IF;
 UPDATE public.staff_members SET role=new_role::public."StaffRole",active=new_active,updated_at=clock_timestamp() WHERE user_id=target_id;
 DELETE FROM public.session WHERE "userId"=target_id;
END $$;
REVOKE ALL ON FUNCTION public.manage_staff(text,text,text,boolean,uuid) FROM PUBLIC;
-- Changing MFA enrollment revokes pre-enrollment sessions. Better Auth creates the new verified session afterwards.
CREATE FUNCTION public.revoke_sessions_on_mfa_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN DELETE FROM public.session WHERE "userId"=NEW.id; RETURN NEW; END $$;
CREATE TRIGGER revoke_sessions_on_mfa_change AFTER UPDATE OF "twoFactorEnabled" ON public."user" FOR EACH ROW WHEN(OLD."twoFactorEnabled" IS DISTINCT FROM NEW."twoFactorEnabled") EXECUTE FUNCTION public.revoke_sessions_on_mfa_change();
