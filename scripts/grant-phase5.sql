\set ON_ERROR_STOP on
GRANT SELECT,INSERT,UPDATE ON public.job_leases,public.job_runs TO :"runtime_role";
GRANT UPDATE ON public.store_settings TO :"runtime_role";
REVOKE ALL ON FUNCTION public.manage_staff(text,text,text,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_staff(text,text,text,boolean,uuid) TO :"runtime_role";
GRANT SELECT,INSERT,UPDATE,DELETE ON public."twoFactor" TO :"runtime_role";
