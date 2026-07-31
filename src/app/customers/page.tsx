"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";

type Customer = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  tax_id: string | null;
  country: string | null;
  customer_type: string | null;
  partner_type: string | null;
  supplier_category: string | null;
  status: string | null;
  risk_level: string | null;
  rnc_up_to_date: boolean | null;
  rnc_certificate_up_to_date: boolean | null;
  commitment_letter: boolean | null;
  compliance_checklist: boolean | null;
  manager_id_copy: boolean | null;
  kyc_completed: boolean | null;
  sanctions_checked: boolean | null;
};

type CustomerDocument = {
  id: string;
  customer_id: string;
  document_name: string | null;
  document_type: string | null;
  expiration_date: string | null;
  status: string | null;
};

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

function getPartnerLabel(type: string | null) {
  if (type === "supplier") return "Suplidor";
  if (type === "both") return "Cliente y Suplidor";
  if (type === "relation") return "Empresa Relacionada";
  return "Cliente";
}

function getDaysUntil(dateString: string | null) {
  if (!dateString) return null;

  const today = new Date();
  const expiration = new Date(dateString);

  today.setHours(0, 0, 0, 0);
  expiration.setHours(0, 0, 0, 0);

  const diff = expiration.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function CustomersExecutiveDashboardPage() {
  const [customersData, setCustomersData] = useState<Customer[]>([]);
  const [documentsData, setDocumentsData] = useState<CustomerDocument[]>([]);
  const [customersError, setCustomersError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      setLoading(true);
      setCustomersError("");

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        if (isMounted) {
          setCustomersError(
            "La sesión ha expirado. Cierra la sesión e inicia nuevamente."
          );
          setLoading(false);
        }
        return;
      }

      const fetchCustomers = () =>
        Promise.all([
          supabase
            .from("customers")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("customer_documents")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      let [customersResult, documentsResult] = await fetchCustomers();

      if (customersResult.error?.code === "42501") {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session) {
          [customersResult, documentsResult] = await fetchCustomers();
        }
      }

      if (!isMounted) return;

      setCustomersData((customersResult.data || []) as Customer[]);
      setDocumentsData((documentsResult.data || []) as CustomerDocument[]);
      setCustomersError(
        customersResult.error?.message || documentsResult.error?.message || ""
      );
      setLoading(false);
    }

    void loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
        <h1 className="text-2xl font-bold text-slate-900">Cargando clientes...</h1>
        <p className="mt-2">Validando la sesión y preparando el dashboard.</p>
      </div>
    );
  }

  if (customersError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        <h1 className="text-2xl font-bold">Error cargando dashboard</h1>
        <p className="mt-2">{customersError}</p>
      </div>
    );
  }

  const customers = customersData;
  const documents = documentsData;

  const total = customers.length;

  const totalCustomers = customers.filter(
    (c) => !c.partner_type || c.partner_type === "customer"
  ).length;

  const totalSuppliers = customers.filter(
    (c) => c.partner_type === "supplier"
  ).length;

  const totalBoth = customers.filter((c) => c.partner_type === "both").length;
  const totalRelated = customers.filter((c) => c.partner_type === "relation").length;

  const active = customers.filter((c) => c.status !== "inactive").length;
  const inactive = customers.filter((c) => c.status === "inactive").length;

  const complete100 = customers.filter((c) => getCompliancePercent(c) === 100).length;
  const compliance80to99 = customers.filter((c) => {
    const score = getCompliancePercent(c);
    return score >= 80 && score < 100;
  }).length;

  const complianceBelow80 = customers.filter((c) => getCompliancePercent(c) < 80).length;
  const highRisk = customers.filter((c) => c.risk_level === "high").length;
  const pendingKyc = customers.filter((c) => !c.kyc_completed).length;
  const pendingSanctions = customers.filter((c) => !c.sanctions_checked).length;

  const expiredDocuments = documents.filter((doc) => {
    const days = getDaysUntil(doc.expiration_date);
    return days !== null && days < 0;
  });

  const documentsExpiringSoon = documents.filter((doc) => {
    const days = getDaysUntil(doc.expiration_date);
    return days !== null && days >= 0 && days <= 30;
  });

  const customersByCountry = customers.reduce<Record<string, number>>(
    (acc, customer) => {
      const country = customer.country || "Sin país";
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    },
    {}
  );

  const topCountries = Object.entries(customersByCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const alerts = customers
    .map((customer) => ({
      customer,
      score: getCompliancePercent(customer),
      reasons: [
        !customer.tax_id ? "RNC pendiente" : null,
        !customer.kyc_completed ? "KYC pendiente" : null,
        !customer.sanctions_checked ? "Sanciones pendiente" : null,
        customer.risk_level === "high" ? "Riesgo alto" : null,
        getCompliancePercent(customer) < 80 ? "Cumplimiento menor a 80%" : null,
      ].filter(Boolean),
    }))
    .filter((item) => item.reasons.length > 0)
    .slice(0, 8);

  const recentCustomers = customers.slice(0, 8);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">JLG LOGISTICS WAREHOUSE</p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Dashboard Ejecutivo de Clientes
          </h1>

          <p className="mt-2 max-w-3xl text-slate-500">
            Control ejecutivo de clientes, suplidores, cumplimiento OEA/KYC,
            documentos, riesgo y alertas operativas.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/customers/applications"
            className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-center text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100"
          >
            Solicitudes web
          </Link>

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total terceros" value={total} />
        <MetricCard title="Clientes" value={totalCustomers} tone="blue" />
        <MetricCard title="Suplidores" value={totalSuppliers} tone="slate" />
        <MetricCard title="Cliente + Suplidor" value={totalBoth} tone="purple" />
        <MetricCard title="Relacionadas" value={totalRelated} tone="amber" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Activos" value={active} tone="green" />
        <MetricCard title="Inactivos" value={inactive} tone="red" />
        <MetricCard title="OEA 100%" value={complete100} tone="green" />
        <MetricCard title="OEA 80%-99%" value={compliance80to99} tone="blue" />
        <MetricCard title="Menos de 80%" value={complianceBelow80} tone="amber" />
        <MetricCard title="Riesgo alto" value={highRisk} tone="red" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Cumplimiento OEA/KYC
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Estado general del expediente documental.
          </p>

          <div className="mt-6 space-y-4">
            <ProgressRow label="Completos 100%" value={complete100} total={total} tone="green" />
            <ProgressRow label="Aceptables 80%-99%" value={compliance80to99} total={total} tone="blue" />
            <ProgressRow label="Menos de 80%" value={complianceBelow80} total={total} tone="amber" />
            <ProgressRow label="KYC pendiente" value={pendingKyc} total={total} tone="red" />
            <ProgressRow label="Sanciones pendiente" value={pendingSanctions} total={total} tone="red" />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Documentos y vencimientos
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Control de documentos cargados al expediente.
          </p>

          <div className="mt-6 grid gap-4">
            <MiniStat label="Documentos cargados" value={documents.length} />
            <MiniStat label="Documentos vencidos" value={expiredDocuments.length} tone="red" />
            <MiniStat
              label="Vencen en 30 días"
              value={documentsExpiringSoon.length}
              tone="amber"
            />
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Recomendación: revisar documentos con fecha de vencimiento y renovar
            certificaciones antes de crear embarques críticos.
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Clientespor país
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Principales países registrados.
          </p>

          <div className="mt-6 space-y-4">
            {topCountries.length > 0 ? (
              topCountries.map(([country, count]) => (
                <ProgressRow
                  key={country}
                  label={country}
                  value={count}
                  total={total}
                  tone="slate"
                />
              ))
            ) : (
              <p className="text-sm text-slate-500">Sin datos de países.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Clientes recientes
              </h2>

              <p className="text-sm text-slate-500">
                Últimos registros creados o actualizados.
              </p>
            </div>

            <Link
              href="/customers/list"
              className="text-sm font-semibold text-blue-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentCustomers.length > 0 ? (
              recentCustomers.map((customer) => {
                const score = getCompliancePercent(customer);

                return (
                  <Link
                    key={customer.id}
                    href={`/customers/${customer.id}`}
                    className="grid gap-4 p-5 transition hover:bg-slate-50 md:grid-cols-[1fr_140px_110px]"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {customer.company_name || "Sin nombre"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {customer.customer_code || "Sin código"} ·{" "}
                        {getPartnerLabel(customer.partner_type)} · RNC:{" "}
                        {customer.tax_id || "Pendiente"}
                      </p>
                    </div>

                    <ComplianceBadge score={score} />

                    <RiskBadge risk={customer.risk_level} />
                  </Link>
                );
              })
            ) : (
              <div className="p-8 text-center text-slate-500">
                No hay Clientes registrados.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Alertas ejecutivas
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Riesgos, pendientes y recomendaciones inmediatas.
          </p>

          <div className="mt-6 space-y-4">
            {alerts.length > 0 ? (
              alerts.map(({ customer, score, reasons }) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100"
                >
                  <p className="font-semibold text-amber-900">
                    {customer.company_name || "Cliente sin nombre"}
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    Cumplimiento {score}% · {reasons.join(" · ")}
                  </p>
                </Link>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                No hay alertas críticas en este momento.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone = "slate",
}: {
  title: string;
  value: number;
  tone?: "slate" | "green" | "blue" | "amber" | "red" | "purple";
}) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
    purple: "border-violet-200 bg-violet-50 text-violet-900",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm opacity-75">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "red";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-sm opacity-75">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  tone = "slate",
}: {
  label: string;
  value: number;
  total: number;
  tone?: "slate" | "green" | "blue" | "amber" | "red";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  const tones = {
    slate: "bg-slate-900",
    green: "bg-emerald-600",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
    red: "bg-red-600",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {value} / {total}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${tones[tone]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ComplianceBadge({ score }: { score: number }) {
  const tone =
    score === 100
      ? "bg-emerald-50 text-emerald-700"
      : score >= 80
      ? "bg-blue-50 text-blue-700"
      : score >= 60
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return (
    <div className="flex items-center">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
        OEA {score}%
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (risk === "high") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
        Alto
      </span>
    );
  }

  if (risk === "low") {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Bajo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      Medio
    </span>
  );
}
