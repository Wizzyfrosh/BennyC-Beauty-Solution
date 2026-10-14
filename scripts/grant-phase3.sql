\set ON_ERROR_STOP on
GRANT SELECT, INSERT ON public.checkout_intents TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE ON public.guest_sessions, public.delivery_zones, public.stock_allocations, public.order_access_tokens TO :"runtime_role";
