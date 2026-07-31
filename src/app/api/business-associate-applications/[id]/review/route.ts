import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../../lib/supabase/admin";
import type {
  BusinessAssociateApplication,
  BusinessAssociateFormData,
} from "../../../../../types/businessAssociate";

export const runtime = "nodejs";

function customerType(form: BusinessAssociateFormData) {
  const values = form.clientTypes.join(" ").toLowerCase();
  if (values.includes("vehículo")) return "warehouse_customer";
  return "importer";
}

function partnerType(form: BusinessAssociateFormData) {
  const client = form.associateTypes.includes("cliente");
  const supplier = form.associateTypes.includes("suplidor");
  if (client && supplier) return "both";
  if (supplier) return "supplier";
  return "customer";
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/business-associate-applications/[id]/review">
) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token) {
      return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("system_user_profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();
    if (!profile?.is_active) {
      return NextResponse.json({ error: "Usuario sin acceso." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      action?: "approve" | "reject" | "in_review";
      notes?: string;
    };
    const notes =
      typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : null;

    if (!["approve", "reject", "in_review"].includes(body.action || "")) {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("business_associate_applications")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
    }

    const application = data as BusinessAssociateApplication;
    if (body.action === "approve") {
      if (application.customer_id) {
        return NextResponse.json({ customerId: application.customer_id });
      }

      const form = application.form_data;
      const primaryContact =
        form.contacts.commercial.name || form.representative.fullName;
      const primaryEmail =
        form.contacts.commercial.email ||
        form.company.email ||
        form.representative.email;
      const primaryPhone =
        form.contacts.commercial.phone ||
        form.company.phone ||
        form.representative.mobile;

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          company_name: form.company.commercialName,
          legal_name: form.company.commercialName,
          trade_name: form.company.commercialName,
          customer_type: customerType(form),
          partner_type: partnerType(form),
          supplier_category: form.supplierTypes.join(", ") || null,
          contact_name: primaryContact || null,
          email: primaryEmail || null,
          phone: primaryPhone || null,
          mobile_phone: form.representative.mobile || null,
          address: form.company.address || null,
          city: form.company.city || null,
          country: "República Dominicana",
          tax_id: form.company.rnc || null,
          tax_country: "DO",
          credit_limit: 0,
          payment_terms: Number(form.payment.creditDays || 0),
          risk_level: "medium",
          kyc_completed: false,
          sanctions_checked: false,
          rnc_up_to_date: form.documentsConfirmed.includes("rnc"),
          rnc_certificate_up_to_date: form.documentsConfirmed.includes("rnc"),
          manager_id_copy: form.documentsConfirmed.includes("identificaciones"),
          has_certifications:
            form.company.hasCertifications === "Sí" ||
            form.company.certifications.length > 0,
          certifications_details:
            [
              ...form.company.certifications,
              form.company.otherCertification,
            ]
              .filter(Boolean)
              .join(", ") || null,
          status: "active",
        })
        .select("id")
        .single();

      if (customerError || !customer) {
        const duplicate =
          customerError?.message.includes("duplicate") ||
          customerError?.message.includes("customers_tax_id_unique");
        return NextResponse.json(
          {
            error: duplicate
              ? "Ya existe un cliente con este RNC."
              : `No se pudo crear el cliente: ${customerError?.message || "Error"}`,
          },
          { status: duplicate ? 409 : 500 }
        );
      }

      const { error: updateError } = await supabase
        .from("business_associate_applications")
        .update({
          status: "approved",
          customer_id: customer.id,
          internal_notes: notes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updateError) throw updateError;

      return NextResponse.json({ customerId: customer.id });
    }

    const status = body.action === "reject" ? "rejected" : "in_review";
    const { error: updateError } = await supabase
      .from("business_associate_applications")
      .update({
        status,
        internal_notes: notes,
        reviewed_at: body.action === "reject" ? new Date().toISOString() : null,
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ status });
  } catch (error) {
    console.error("Business associate review failed", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la solicitud." },
      { status: 500 }
    );
  }
}
