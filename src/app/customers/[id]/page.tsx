"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Trash2, X } from "lucide-react";
import { supabase } from "../../../lib/supabase/client";

type Customer = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  legal_name: string | null;
  trade_name: string | null;
  customer_type: string | null;
  partner_type?: string | null;
  supplier_category?: string | null;

  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  whatsapp: string | null;

  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  website: string | null;

  tax_id: string | null;
  tax_country: string | null;
  tax_exempt: boolean | null;

  preferred_transport: string | null;
  incoterm: string | null;
  account_manager: string | null;
  credit_limit: number | null;
  payment_terms: number | null;

  risk_level: string | null;
  status: string | null;

  rnc_up_to_date: boolean | null;
  rnc_certificate_up_to_date: boolean | null;
  commitment_letter: boolean | null;
  compliance_checklist: boolean | null;
  manager_id_copy: boolean | null;
  kyc_completed: boolean | null;
  sanctions_checked: boolean | null;
  has_certifications: boolean | null;
  certifications_details: string | null;
};

type CustomerDocument = {
  id: string;
  document_name: string | null;
  document_type: string | null;
  file_name: string | null;
  file_url: string | null;
  file_path?: string | null;
  file_size: number | null;
  created_at: string | null;
};

function getDocumentUrl(document: CustomerDocument) {
  if (document.file_url?.startsWith("http")) return document.file_url;
  const path = document.file_path || document.file_url;
  return path
    ? `https://rgavbykdeizykqrvujjh.supabase.co/storage/v1/object/public/customer-documents/${path}`
    : null;
}

function getCompliancePercent(customer: Customer) {
  const checks = [
    customer.rnc_up_to_date,
    customer.rnc_certificate_up_to_date,
    customer.commitment_letter,
    customer.compliance_checklist,
    customer.manager_id_copy,
    customer.kyc_completed,
    customer.sanctions_checked,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function getComplianceStatus(score: number) {
  if (score === 100) return "Completo";
  if (score >= 80) return "Aceptable";
  if (score >= 60) return "Requiere revisión";
  return "Crítico";
}

function getCustomerTypeLabel(type: string | null) {
  const labels: Record<string, string> = {
    importer: "Importador",
    exporter: "Exportador",
    both: "Importador / Exportador",
    freight_forwarder: "Freight Forwarder",
    customs_broker: "Agente Aduanal",
    carrier: "Transportista",
    warehouse_customer: "Cliente de Almacén",
    supplier: "Proveedor",
    other: "Otro",
    individual: "Individual",
    company: "Empresa",
  };

  return labels[type || ""] || "No definido";
}

function getPartnerTypeLabel(type?: string | null) {
  const labels: Record<string, string> = {
    customer: "Cliente",
    supplier: "Suplidor",
    both: "Cliente y Suplidor",
  };

  return labels[type || ""] || "Cliente";
}

function getSupplierCategoryLabel(type?: string | null) {
  const labels: Record<string, string> = {
    shipping_line: "Naviera",
    airline: "Aerolínea",
    trucking_company: "Transportista",
    warehouse: "Almacén",
    customs_broker: "Agente Aduanal",
    insurance: "Seguro",
    technology: "Tecnología",
    security: "Seguridad",
    consulting: "Consultoría",
    other: "Otro",
  };

  return labels[type || ""] || "No definido";
}

function getTransportLabel(type: string | null) {
  const labels: Record<string, string> = {
    air: "Aéreo",
    ocean: "Marítimo",
    ground: "Terrestre",
  };

  return labels[type || ""] || "No definido";
}

function getRiskLabel(risk: string | null) {
  if (risk === "high") return "Alto";
  if (risk === "low") return "Bajo";
  return "Medio";
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [documentToDelete, setDocumentToDelete] =
    useState<CustomerDocument | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentError, setDocumentError] = useState("");

  async function deleteDocument() {
    if (!documentToDelete || deletingDocument) return;

    setDeletingDocument(true);
    setDocumentError("");
    setDocumentMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");

      const response = await fetch(
        `/api/customers/${id}/documents/${documentToDelete.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "No se pudo eliminar el documento.");
      }

      setDocuments((current) =>
        current.filter((document) => document.id !== documentToDelete.id)
      );
      setDocumentMessage(
        `El documento “${
          documentToDelete.document_name ||
          documentToDelete.file_name ||
          "Documento"
        }” fue eliminado del expediente.`
      );
      setDocumentToDelete(null);
    } catch (deleteError) {
      setDocumentError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el documento."
      );
    } finally {
      setDeletingDocument(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      setLoading(true);
      setError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        if (isMounted) {
          setError("La sesión ha expirado. Inicia sesión nuevamente.");
          setLoading(false);
        }
        return;
      }

      const fetchCustomer = () =>
        Promise.all([
          supabase.from("customers").select("*").eq("id", id).single(),
          supabase
            .from("customer_documents")
            .select("*")
            .eq("customer_id", id)
            .order("created_at", { ascending: false }),
        ]);

      let [customerResult, documentsResult] = await fetchCustomer();

      if (customerResult.error?.code === "42501") {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          [customerResult, documentsResult] = await fetchCustomer();
        }
      }

      if (!isMounted) return;

      setCustomer((customerResult.data as Customer | null) || null);
      setDocuments((documentsResult.data || []) as CustomerDocument[]);
      setError(
        customerResult.error?.message || documentsResult.error?.message || ""
      );
      setLoading(false);
    }

    void loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
        <h1 className="text-2xl font-bold text-slate-900">Cargando cliente...</h1>
        <p className="mt-2">Validando la sesión y preparando el expediente.</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h1 className="text-2xl font-bold">Cliente no encontrado</h1>
        <p className="mt-2">
          No se pudo cargar el expediente del cliente solicitado.
        </p>

        <Link
          href="/customers/list"
          className="mt-4 inline-flex rounded-xl bg-red-700 px-5 py-3 text-sm font-semibold text-white"
        >
          Volver a Clientes
        </Link>
      </div>
    );
  }

  const c = customer;
  const docs = documents;
  const complianceScore = getCompliancePercent(c);
  const complianceStatus = getComplianceStatus(complianceScore);

  const missingItems = [
    !c.rnc_up_to_date ? "RNC al día" : null,
    !c.rnc_certificate_up_to_date ? "Certificación de RNC" : null,
    !c.commitment_letter ? "Carta compromiso" : null,
    !c.compliance_checklist ? "Checklist de cumplimiento" : null,
    !c.manager_id_copy ? "Cédula del gerente" : null,
    !c.kyc_completed ? "KYC completado" : null,
    !c.sanctions_checked ? "Verificación de sanciones" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Expediente del Cliente
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {c.company_name || "Cliente sin nombre"}
          </h1>

          <p className="mt-2 text-slate-500">
            {c.customer_code || "Sin código"} · RNC: {c.tax_id || "Pendiente"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/customers/list"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Ver Clientes
          </Link>

          <Link
            href="/customers/new"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            + Nuevo Cliente
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Cumplimiento OEA"
          value={`${complianceScore}%`}
          subtitle={complianceStatus}
          tone={
            complianceScore === 100
              ? "green"
              : complianceScore >= 80
              ? "blue"
              : complianceScore >= 60
              ? "amber"
              : "red"
          }
        />

        <SummaryCard
          title="Nivel de Riesgo"
          value={getRiskLabel(c.risk_level)}
          subtitle="Evaluación KYC"
          tone={
            c.risk_level === "high"
              ? "red"
              : c.risk_level === "low"
              ? "green"
              : "slate"
          }
        />

        <SummaryCard
          title="Documentos"
          value={String(docs.length)}
          subtitle="Archivos adjuntos"
          tone="slate"
        />

        <SummaryCard
          title="Estado"
          value={c.status === "inactive" ? "Inactivo" : "Activo"}
          subtitle="Estado del tercero"
          tone={c.status === "inactive" ? "red" : "green"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Información General
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoItem label="Código" value={c.customer_code} />
            <InfoItem label="Tipo de relación" value={getPartnerTypeLabel(c.partner_type)} />
            <InfoItem label="Tipo de cliente" value={getCustomerTypeLabel(c.customer_type)} />
            <InfoItem label="Categoría suplidor" value={getSupplierCategoryLabel(c.supplier_category)} />
            <InfoItem label="Razón social" value={c.legal_name} />
            <InfoItem label="Nombre comercial" value={c.trade_name} />
            <InfoItem label="Website" value={c.website} />
            <InfoItem label="País" value={c.country} />
            <InfoItem label="Ciudad" value={c.city} />
            <InfoItem label="Dirección" value={c.address} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Contacto Principal
          </h2>

          <div className="mt-6 grid gap-4">
            <InfoItem label="Contacto" value={c.contact_name} />
            <InfoItem label="Email" value={c.email} />
            <InfoItem label="Teléfono" value={c.phone} />
            <InfoItem label="Móvil" value={c.mobile_phone} />
            <InfoItem label="WhatsApp" value={c.whatsapp} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Información Fiscal
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoItem label="RNC / Tax ID" value={c.tax_id} />
            <InfoItem label="País fiscal" value={c.tax_country} />
            <InfoItem
              label="Exento de impuestos"
              value={c.tax_exempt ? "Sí" : "No"}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Operaciones
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <InfoItem
              label="Transporte preferido"
              value={getTransportLabel(c.preferred_transport)}
            />
            <InfoItem label="Incoterm" value={c.incoterm} />
            <InfoItem label="Ejecutivo de cuenta" value={c.account_manager} />
            <InfoItem
              label="Límite de crédito"
              value={c.credit_limit !== null ? String(c.credit_limit) : null}
            />
            <InfoItem
              label="Términos de pago"
              value={c.payment_terms !== null ? `${c.payment_terms} días` : null}
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Cumplimiento OEA / KYC
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Checklist documental y estado de cumplimiento del expediente.
            </p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">
              {complianceScore}%
            </p>
            <p className="text-sm text-slate-500">{complianceStatus}</p>
          </div>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-900"
            style={{ width: `${complianceScore}%` }}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CheckItem label="RNC al día" checked={Boolean(c.rnc_up_to_date)} />
          <CheckItem
            label="Certificación de RNC al día"
            checked={Boolean(c.rnc_certificate_up_to_date)}
          />
          <CheckItem
            label="Carta compromiso"
            checked={Boolean(c.commitment_letter)}
          />
          <CheckItem
            label="Checklist de cumplimiento"
            checked={Boolean(c.compliance_checklist)}
          />
          <CheckItem
            label="Cédula del gerente"
            checked={Boolean(c.manager_id_copy)}
          />
          <CheckItem
            label="KYC completado"
            checked={Boolean(c.kyc_completed)}
          />
          <CheckItem
            label="Verificación de sanciones"
            checked={Boolean(c.sanctions_checked)}
          />
          <CheckItem
            label="Tiene certificaciones"
            checked={Boolean(c.has_certifications)}
          />
        </div>

        {c.certifications_details && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Certificaciones
            </p>
            <p className="mt-1 text-slate-600">{c.certifications_details}</p>
          </div>
        )}

        {missingItems.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              Recomendaciones
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {missingItems.map((item) => (
                <li key={String(item)}>Pendiente: {item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Documentos OEA
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Archivos PDF asociados al expediente del cliente.
            </p>
          </div>
<Link
  href={`/customers/${customer.id}/edit`}
  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
>
  Editar Cliente
</Link>
          <Link
            href={`/customers/${id}/documents/upload`}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Subir Documento
          </Link>
        </div>

        {documentMessage && (
          <div
            role="status"
            className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            {documentMessage}
          </div>
        )}

        {documentError && !documentToDelete && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {documentError}
          </div>
        )}

        {docs.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Documento</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4">Fecha</th>
                  <th className="px-5 py-4">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {doc.document_name || doc.file_name || "Documento"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {doc.document_type || "Otro"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString("es-DO")
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {getDocumentUrl(doc) ? (
                          <a
                            href={getDocumentUrl(doc) || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline"
                          >
                            <FileText size={16} /> Ver PDF
                          </a>
                        ) : (
                          <span className="text-slate-500">Sin archivo</span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDocumentMessage("");
                            setDocumentError("");
                            setDocumentToDelete(doc);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-semibold text-slate-700">
              No hay documentos cargados.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Presiona &quot;Subir Documento&quot; para adjuntar PDFs al expediente.
            </p>
          </div>
        )}
      </div>

      {documentToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingDocument) {
              setDocumentToDelete(null);
              setDocumentError("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-document-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-red-50 p-3 text-red-700">
                  <AlertTriangle size={25} />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-red-700">
                    Acción permanente
                  </p>
                  <h2
                    id="delete-document-title"
                    className="mt-1 text-2xl font-black text-slate-950"
                  >
                    Eliminar documento
                  </h2>
                </div>
              </div>
              <button
                type="button"
                disabled={deletingDocument}
                onClick={() => {
                  setDocumentToDelete(null);
                  setDocumentError("");
                }}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Cerrar confirmación"
              >
                <X size={21} />
              </button>
            </header>

            <div className="space-y-4 p-6">
              <p className="text-slate-700">
                Vas a borrar del perfil de <strong>{c.company_name}</strong> el
                documento:
              </p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-bold text-slate-950">
                  {documentToDelete.document_name ||
                    documentToDelete.file_name ||
                    "Documento"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {documentToDelete.document_type || "Otro"}
                </p>
              </div>
              <p className="text-sm leading-6 text-slate-600">
                El PDF y su registro se eliminarán del sistema. Esta acción no
                se puede deshacer.
              </p>
              {documentError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                >
                  {documentError}
                </div>
              )}
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 p-6 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={deletingDocument}
                onClick={() => {
                  setDocumentToDelete(null);
                  setDocumentError("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Conservar documento
              </button>
              <button
                type="button"
                disabled={deletingDocument}
                onClick={() => void deleteDocument()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
              >
                <Trash2 size={18} />
                {deletingDocument ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  tone = "slate",
}: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "slate" | "green" | "blue" | "amber" | "red";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm opacity-75">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs opacity-75">{subtitle}</p>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

function CheckItem({
  label,
  checked,
}: {
  label: string;
  checked: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        checked
          ? "border-emerald-200 bg-emerald-50"
          : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-slate-800">{label}</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            checked
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {checked ? "Completo" : "Pendiente"}
        </span>
      </div>
    </div>
  );
}
