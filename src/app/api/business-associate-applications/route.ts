import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";
import type { BusinessAssociateFormData } from "../../../types/businessAssociate";

export const runtime = "nodejs";

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 10;

function safeText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function trackingCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `JLG-AN-${date}-${suffix}`;
}

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function isBusinessAssociateFormData(value: unknown): value is BusinessAssociateFormData {
  if (!value || typeof value !== "object") return false;
  const form = value as Partial<BusinessAssociateFormData>;
  return Boolean(
    Array.isArray(form.associateTypes) &&
      form.company &&
      typeof form.company.commercialName === "string" &&
      form.authorization &&
      form.authorization.accepted === true &&
      form.authorization.signatureCaptured === true
  );
}

export async function POST(request: Request) {
  try {
    let body: FormData;
    try {
      body = await request.formData();
    } catch {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }
    const honeypot = safeText(body.get("middle_name"));
    const startedAt = Number(body.get("started_at"));

    if (honeypot) {
      return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    }

    if (!Number.isFinite(startedAt) || Date.now() - startedAt < 3000) {
      return NextResponse.json(
        { error: "Por favor revise la información antes de enviarla." },
        { status: 400 }
      );
    }

    const payloadValue = body.get("payload");
    if (typeof payloadValue !== "string" || payloadValue.length > 100_000) {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadValue);
    } catch {
      return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    }

    if (!isBusinessAssociateFormData(payload)) {
      return NextResponse.json(
        { error: "Faltan datos obligatorios o la autorización." },
        { status: 400 }
      );
    }

    const companyName = safeText(payload.company.commercialName, 200);
    const taxId = safeText(payload.company.rnc, 40) || null;
    const contactName =
      safeText(payload.contacts?.commercial?.name, 200) ||
      safeText(payload.representative?.fullName, 200) ||
      safeText(payload.authorization.applicantName, 200);
    const contactEmail =
      safeText(payload.company.email, 254).toLowerCase() ||
      safeText(payload.representative?.email, 254).toLowerCase() ||
      null;
    const contactPhone =
      safeText(payload.company.phone, 50) ||
      safeText(payload.representative?.mobile, 50) ||
      null;

    if (!companyName || payload.associateTypes.length === 0 || !contactEmail) {
      return NextResponse.json(
        { error: "Complete el tipo de asociado, el nombre y el correo electrónico." },
        { status: 400 }
      );
    }

    const files = [...body.entries()]
      .filter(([key, value]) => key.startsWith("document__") && value instanceof File)
      .map(([key, value]) => ({
        type: key.replace("document__", "").slice(0, 80),
        file: value as File,
      }))
      .filter(({ file }) => file.size > 0);

    if (!files.some(({ type }) => type === "firma_electronica")) {
      return NextResponse.json(
        { error: "La firma electrónica es obligatoria." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Puede adjuntar un máximo de ${MAX_FILES} documentos.` },
        { status: 400 }
      );
    }

    for (const { file } of files) {
      if (file.size > MAX_FILE_SIZE || !ALLOWED_FILE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Los documentos deben ser PDF, JPG o PNG y pesar menos de 8 MB." },
          { status: 400 }
        );
      }
    }

    const supabase = createSupabaseAdmin();
    const duplicateSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const duplicateEmailQuery = supabase
      .from("business_associate_applications")
      .select("tracking_code")
      .gte("submitted_at", duplicateSince)
      .in("status", ["pending", "in_review"])
      .eq("contact_email", contactEmail)
      .limit(1)
      .maybeSingle();
    const duplicateTaxQuery = taxId
      ? supabase
          .from("business_associate_applications")
          .select("tracking_code")
          .gte("submitted_at", duplicateSince)
          .in("status", ["pending", "in_review"])
          .eq("tax_id", taxId)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null });
    const [{ data: duplicateEmail }, { data: duplicateTax }] = await Promise.all([
      duplicateEmailQuery,
      duplicateTaxQuery,
    ]);
    const duplicate = duplicateEmail || duplicateTax;
    if (duplicate) {
      return NextResponse.json(
        {
          error: "Esta solicitud fue recibida recientemente.",
          trackingCode: duplicate.tracking_code,
        },
        { status: 409 }
      );
    }

    const code = trackingCode();
    const { data: application, error: insertError } = await supabase
      .from("business_associate_applications")
      .insert({
        tracking_code: code,
        associate_type: payload.associateTypes.slice(0, 10),
        company_name: companyName,
        tax_id: taxId,
        contact_name: contactName || null,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        form_data: payload,
      })
      .select("id")
      .single();

    if (insertError || !application) {
      throw insertError || new Error("No se pudo crear la solicitud.");
    }

    const uploadedPaths: string[] = [];
    try {
      for (const { type, file } of files) {
        const path = `${application.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
          .from("business-associate-documents")
          .upload(path, buffer, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);

        const { error: documentError } = await supabase
          .from("business_associate_application_documents")
          .insert({
            application_id: application.id,
            document_type: type,
            file_name: safeFileName(file.name),
            storage_path: path,
            content_type: file.type,
            file_size: file.size,
          });
        if (documentError) throw documentError;
      }
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage
          .from("business-associate-documents")
          .remove(uploadedPaths);
      }
      await supabase
        .from("business_associate_applications")
        .delete()
        .eq("id", application.id);
      throw error;
    }

    return NextResponse.json(
      { trackingCode: code, applicationId: application.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Business associate submission failed", error);
    return NextResponse.json(
      { error: "No pudimos recibir la solicitud. Intente nuevamente." },
      { status: 500 }
    );
  }
}
