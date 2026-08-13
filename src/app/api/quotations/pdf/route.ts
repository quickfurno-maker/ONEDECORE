import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/service-role';
import { hashCapabilityToken } from '@/features/quotations/server/quotation-capability';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'QUOTATION_NOT_FOUND_OR_FORBIDDEN: Missing capability token.' }, { status: 400 });
  }

  const tokenHash = hashCapabilityToken(token);
  const supabase = createAdminClient();

  // Validate active capability grant
  const { data: grant } = await supabase
    .from('quotation_access_grants')
    .select('id, quotation_id, quotation_version_id, revoked_at')
    .eq('capability_token_hash', tokenHash)
    .is('revoked_at', null)
    .single();

  if (!grant) {
    return NextResponse.json({ error: 'QUOTATION_NOT_FOUND_OR_FORBIDDEN: Invalid or revoked capability token.' }, { status: 404 });
  }

  // Check PDF READY
  const { data: pdfDoc } = await supabase
    .from('quotation_pdf_documents')
    .select('object_path, status')
    .eq('quotation_version_id', grant.quotation_version_id)
    .single();

  if (!pdfDoc || pdfDoc.status !== 'ready') {
    return NextResponse.json({ error: 'PDF_NOT_READY: Quotation PDF artifact is not ready.' }, { status: 404 });
  }

  // Create 15-minute signed URL
  const { data: signedData, error: signErr } = await supabase.storage
    .from('quotation-documents')
    .createSignedUrl(pdfDoc.object_path, 900); // 15-min TTL

  if (signErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'SIGNED_URL_FAILED: Could not generate PDF download link.' }, { status: 500 });
  }

  // Redirect client to signed URL
  return NextResponse.redirect(signedData.signedUrl);
}
