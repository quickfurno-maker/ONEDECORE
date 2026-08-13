begin;
select plan(12);

-- 1. Verify M26 tables exist
select has_table('public', 'quotation_commercial_settings', 'quotation_commercial_settings table should exist');
select has_table('public', 'quotation_pdf_documents', 'quotation_pdf_documents table should exist');
select has_table('public', 'quotation_access_grants', 'quotation_access_grants table should exist');
select has_table('public', 'quotation_acceptances', 'quotation_acceptances table should exist');

-- 2. Verify M26 RPC functions exist
select has_function('public', 'set_quotation_max_discount', array['numeric'], 'set_quotation_max_discount RPC should exist');
select has_function('public', 'finalize_quotation_version', array['uuid', 'uuid', 'integer', 'text', 'text'], 'finalize_quotation_version RPC should exist');
select has_function('public', 'issue_quotation_access_grant', array['uuid', 'text', 'text'], 'issue_quotation_access_grant RPC should exist');
select has_function('public', 'get_quotation_by_capability', array['text'], 'get_quotation_by_capability RPC should exist');
select has_function('public', 'accept_quotation_by_capability', array['text', 'text', 'text', 'text'], 'accept_quotation_by_capability RPC should exist');
select has_function('public', 'create_quotation_revision', array['uuid', 'text'], 'create_quotation_revision RPC should exist');

-- 3. Verify System Permissions for Phase 7B
select results_eq(
  'select count(*)::integer from public.permissions where code in (''quotations.finalize'', ''quotations.send'')',
  array[2],
  'Both quotations.finalize and quotations.send permissions must exist'
);

-- 4. Verify Storage Bucket for PDF Documents
select results_eq(
  'select count(*)::integer from storage.buckets where id = ''quotation-documents''',
  array[1],
  'quotation-documents storage bucket must exist'
);

select * from finish();
rollback;
