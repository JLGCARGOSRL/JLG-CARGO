import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";
import { sendSmtpMail } from "../../../../../lib/email/smtp";

export const runtime = "nodejs";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

    const supabase = createSupabaseAdmin();
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    const { data: profile } = await supabase.from("system_user_profiles").select("is_active, full_name").eq("id", user.id).single();
    if (!profile?.is_active) return NextResponse.json({ error: "Usuario sin acceso." }, { status: 403 });

    const body = await request.json() as { to?: string; note?: string };
    const to = String(body.to || "").trim().toLowerCase();
    const note = String(body.note || "").trim().slice(0, 4000);
    if (!validEmail(to)) return NextResponse.json({ error: "Escriba un destinatario válido." }, { status: 400 });

    const { id } = await context.params;
    const { data: original } = await supabase.from("communication_records").select("*").eq("id", id).single();
    if (!original) return NextResponse.json({ error: "Comunicación no encontrada." }, { status: 404 });

    const host = process.env.SMTP_HOST || "mail.jlgcargo.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const from = process.env.SMTP_FROM || "info@jlgcargo.com";
    const smtpUser = process.env.SMTP_USER || from;
    const password = process.env.SMTP_PASSWORD;
    if (!password) return NextResponse.json({ error: "Falta configurar la clave SMTP en Vercel." }, { status: 503 });

    const subject = original.subject.toLowerCase().startsWith("fwd:") ? original.subject : `Fwd: ${original.subject}`;
    const originalDate = original.received_at || original.sent_at || original.declared_at || original.created_at;
    const text = [
      note,
      note ? "" : null,
      "---------- Mensaje reenviado ----------",
      `Fecha: ${new Date(originalDate).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" })}`,
      `De: ${original.sender || "—"}`,
      `Para: ${(original.recipients || []).join(", ") || "—"}`,
      `Asunto: ${original.subject}`,
      "",
      original.body_text || "(Sin contenido de texto)",
    ].filter((line) => line !== null).join("\n");

    const sent = await sendSmtpMail({ host, port, user: smtpUser, password, from, to, subject, text });
    const now = new Date().toISOString();
    const { error: recordError } = await supabase.from("communication_records").insert({
      channel: "email", direction: "outbound", source: "mail_server", subject,
      sender: from, recipients: [to], body_text: text, message_id: sent.messageId,
      customer_reference: original.customer_reference,
      document_reference: original.document_reference,
      sent_at: now, imported_at: now, created_at: now, created_by: user.id,
    });
    if (recordError) return NextResponse.json({ error: "El correo se envió, pero no pudo registrarse en la cronología." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reenviar el correo." }, { status: 500 });
  }
}
