import { NextResponse } from "next/server";
import { whatsappMediaResponseHeaders } from "@/features/whatsapp/contracts/media-policy";
import { getStaffClaims } from "@/server/auth/session";
import { openInboundWhatsappMediaForCurrentUser } from "@/features/whatsapp/server/whatsapp-media-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WM-2 — view one inbound WhatsApp media file.
 *
 * GET only, same-session only. Authorisation, the access record and every
 * MIME/size/host check happen in `openInboundWhatsappMediaForCurrentUser`;
 * this handler maps the result to a status and never echoes provider detail,
 * a media id, a CDN url or a credential.
 */
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const staff = await getStaffClaims();
  if (!staff) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401, headers: NO_STORE });
  }

  const { messageId } = await params;
  const result = await openInboundWhatsappMediaForCurrentUser(messageId);

  switch (result.kind) {
    case "ok":
      return new Response(result.bytes as BodyInit, {
        status: 200,
        headers: whatsappMediaResponseHeaders({
          kind: result.mediaKind,
          mimeType: result.mimeType,
          filename: result.filename,
          byteLength: result.bytes.byteLength,
        }),
      });
    case "disabled":
      return NextResponse.json({ error: "media_view_disabled" }, { status: 503, headers: NO_STORE });
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    case "rejected":
      return NextResponse.json({ error: result.reason }, { status: 422, headers: NO_STORE });
    case "unavailable":
      return NextResponse.json({ error: "media_unavailable" }, { status: 502, headers: NO_STORE });
    default: {
      const never: never = result;
      void never;
      return NextResponse.json({ error: "media_unavailable" }, { status: 502, headers: NO_STORE });
    }
  }
}
