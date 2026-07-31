"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Search,
  XCircle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase/client";
import type {
  BusinessAssociateApplication,
  BusinessAssociateDocument,
} from "../../../types/businessAssociate";

const statusLabels = {
  pending: "Pendiente",
  in_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const statusStyles = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  in_review: "border-blue-200 bg-blue-50 text-blue-800",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-red-200 bg-red-50 text-red-800",
};

export default function BusinessAssociateApplicationsPage() {
  const [applications, setApplications] = useState<BusinessAssociateApplication[]>([]);
  const [documents, setDocuments] = useState<BusinessAssociateDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reviewingId, setReviewingId] = useState("");

  async function load() {
    setLoading(true);
    const [applicationsResult, documentsResult] = await Promise.all([
      supabase
        .from("business_associate_applications")
        .select("*")
        .order("submitted_at", { ascending: false }),
      supabase
        .from("business_associate_application_documents")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);
    setApplications(
      (applicationsResult.data || []) as BusinessAssociateApplication[]
    );
    setDocuments((documentsResult.data || []) as BusinessAssociateDocument[]);
    setError(
      applicationsResult.error?.message || documentsResult.error?.message || ""
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesStatus = status === "all" || application.status === status;
      const matchesSearch =
        !term ||
        [
          application.tracking_code,
          application.company_name,
          application.tax_id,
          application.contact_name,
          application.contact_email,
        ].some((value) => value?.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [applications, search, status]);

  async function review(
    application: BusinessAssociateApplication,
    action: "approve" | "reject" | "in_review"
  ) {
    const promptLabel =
      action === "approve"
        ? "Observación de aprobación (opcional)"
        : action === "reject"
          ? "Motivo del rechazo"
          : "Observación de revisión (opcional)";
    const notes = window.prompt(promptLabel, application.internal_notes || "");
    if (notes === null) return;
    if (action === "reject" && !notes.trim()) {
      setError("Escriba el motivo del rechazo.");
      return;
    }

    setReviewingId(application.id);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("La sesión ha expirado.");
      const response = await fetch(
        `/api/business-associate-applications/${application.id}/review`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action, notes }),
        }
      );
      const result = (await response.json()) as {
        error?: string;
        customerId?: string;
      };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar.");
      if (result.customerId) {
        window.location.href = `/customers/${result.customerId}`;
        return;
      }
      await load();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "No se pudo actualizar la solicitud."
      );
    } finally {
      setReviewingId("");
    }
  }

  async function openDocument(document: BusinessAssociateDocument) {
    const { data, error: signedError } = await supabase.storage
      .from("business-associate-documents")
      .createSignedUrl(document.storage_path, 60);
    if (signedError || !data?.signedUrl) {
      setError("No se pudo abrir el documento.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const counts = {
    pending: applications.filter((item) => item.status === "pending").length,
    in_review: applications.filter((item) => item.status === "in_review").length,
    approved: applications.filter((item) => item.status === "approved").length,
    rejected: applications.filter((item) => item.status === "rejected").length,
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">
            Conozca a su cliente · GS-AN-08-001
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            Solicitudes de asociados
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Revise la información enviada por clientes y suplidores antes de
            incorporarlos al registro oficial.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/registro-asociado"
            target="_blank"
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center text-sm font-bold text-blue-800 hover:bg-blue-100"
          >
            Abrir formulario público
          </Link>
          <Link
            href="/customers"
            className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
          >
            Volver a clientes
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Pendientes"
          value={counts.pending}
          icon={<Clock3 size={21} />}
          tone="amber"
        />
        <Metric
          label="En revisión"
          value={counts.in_review}
          icon={<Eye size={21} />}
          tone="blue"
        />
        <Metric
          label="Aprobadas"
          value={counts.approved}
          icon={<CheckCircle2 size={21} />}
          tone="green"
        />
        <Metric
          label="Rechazadas"
          value={counts.rejected}
          icon={<XCircle size={21} />}
          tone="red"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px]">
        <label className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por empresa, RNC, contacto o seguimiento"
            className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-blue-600"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="in_review">En revisión</option>
          <option value="approved">Aprobadas</option>
          <option value="rejected">Rechazadas</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <LoaderCircle className="animate-spin text-blue-600" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          No hay solicitudes que coincidan con el filtro.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((application) => {
            const form = application.form_data;
            const applicationDocuments = documents.filter(
              (document) => document.application_id === application.id
            );
            const isReviewing = reviewingId === application.id;
            return (
              <details
                key={application.id}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm open:ring-2 open:ring-blue-100"
              >
                <summary className="cursor-pointer list-none p-5 sm:p-6">
                  <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-slate-950">
                          {application.company_name}
                        </h2>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[application.status]}`}
                        >
                          {statusLabels[application.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {application.tracking_code} · RNC{" "}
                        {application.tax_id || "no indicado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Contacto
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-700">
                        {application.contact_name || "No indicado"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Recibida
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {new Intl.DateTimeFormat("es-DO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(application.submitted_at))}
                      </p>
                    </div>
                    <div className="text-sm font-bold text-blue-700 group-open:text-slate-500">
                      Ver expediente
                    </div>
                  </div>
                </summary>

                <div className="border-t border-slate-200 bg-slate-50 p-5 sm:p-6">
                  <div className="grid gap-5 xl:grid-cols-3">
                    <InfoCard
                      title="Empresa"
                      rows={[
                        ["Tipo", application.associate_type.join(", ")],
                        ["Actividad", form.company.economicActivity],
                        ["Régimen", form.company.regime],
                        [
                          "Dirección",
                          [form.company.address, form.company.sector, form.company.city]
                            .filter(Boolean)
                            .join(", "),
                        ],
                        ["Teléfono", form.company.phone],
                        ["Correo", form.company.email],
                        ["Descripción", form.company.description],
                      ]}
                    />
                    <InfoCard
                      title="Representante"
                      rows={[
                        ["Nombre", form.representative.fullName],
                        ["Identificación", form.representative.idNumber],
                        ["Ocupación", form.representative.occupation],
                        ["Teléfono", form.representative.phone],
                        ["Celular", form.representative.mobile],
                        ["Correo", form.representative.email],
                      ]}
                    />
                    <InfoCard
                      title="Operación y pagos"
                      rows={[
                        ["Mercancías", form.operations.merchandiseClasses],
                        ["Vehículos", form.operations.vehicleClasses],
                        ["Modalidad", form.payment.method],
                        [
                          "Plazo",
                          form.payment.creditDays
                            ? `${form.payment.creditDays} días`
                            : "",
                        ],
                        ["Moneda", form.payment.currencies.join(", ")],
                      ]}
                    />
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="font-black text-slate-950">Documentos</h3>
                      <div className="mt-3 space-y-2">
                        {applicationDocuments.length ? (
                          applicationDocuments.map((document) => (
                            <button
                              key={document.id}
                              type="button"
                              onClick={() => void openDocument(document)}
                              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                            >
                              <FileText size={18} className="text-blue-600" />
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                                {document.file_name}
                              </span>
                              <Download size={17} className="text-slate-400" />
                            </button>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">
                            No se adjuntaron documentos.
                          </p>
                        )}
                      </div>
                    </div>
                    <InfoCard
                      title="Autorización"
                      rows={[
                        ["Solicitante", form.authorization.applicantName],
                        ["Fecha", form.authorization.date],
                        [
                          "Aceptación",
                          form.authorization.accepted ? "Confirmada" : "No confirmada",
                        ],
                        ["Notas internas", application.internal_notes || ""],
                      ]}
                    />
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                    {application.status === "pending" && (
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => void review(application, "in_review")}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
                      >
                        Marcar en revisión
                      </button>
                    )}
                    {!application.customer_id &&
                      application.status !== "rejected" && (
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => void review(application, "reject")}
                          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      )}
                    {!application.customer_id &&
                      application.status !== "rejected" && (
                        <button
                          type="button"
                          disabled={isReviewing}
                          onClick={() => void review(application, "approve")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {isReviewing && (
                            <LoaderCircle className="animate-spin" size={17} />
                          )}
                          Aprobar y crear cliente
                        </button>
                      )}
                    {application.customer_id && (
                      <Link
                        href={`/customers/${application.customer_id}`}
                        className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
                      >
                        Abrir cliente creado
                      </Link>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "amber" | "blue" | "green" | "red";
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function InfoCard({
  title,
  rows,
}: {
  title: string;
  rows: [string, string | null | undefined][];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-black text-slate-950">{title}</h3>
      <dl className="mt-3 space-y-3">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {label}
              </dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                {value}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
