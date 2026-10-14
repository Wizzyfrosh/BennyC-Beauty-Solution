\set ON_ERROR_STOP on
GRANT SELECT,INSERT ON public.payment_events,public.receipts TO :"runtime_role";
GRANT SELECT,INSERT,UPDATE ON public.refunds,public.notification_outbox TO :"runtime_role";
