"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase/client";
type Customer = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  tax_id: string | null;
  customer_type: string | null;
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

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [complianceFilter, setComplianceFilter] = useState("all");

  useEffect(() => {
    async function loadCustomers() {
      setLoading(true);

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCustomers(data);
      }

      setLoading(false);
    }

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const score = getCompliancePercent(customer);
      const text = `${customer.company_name || ""} ${customer.tax_id || ""} ${customer.customer_code || ""}`.toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const matchesRisk = riskFilter === "all" || customer.risk_level === riskFilter;
      const matchesCompliance =
        complianceFilter === "all" ||
        (complianceFilter === "100" && score === 100) ||
        (complianceFilter === "80" && score >= 80 && score < 100) ||
        (complianceFilter === "below80" && score < 80);

      return matchesSearch && matchesRisk && matchesCompliance;
    });
  }, [customers, search, riskFilter, complianceFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Clientes</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Clientes registrados
          </h1>
          <p className="mt-2 text-slate-500">
            Consulta, filtra y abre el expediente de cada cliente.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/customers"
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </Link>

          <Link
            href="/customers/new"
            className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Nuevo Cliente
          </Link>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            type="text"
            placeholder="Buscar por empresa, RNC o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-300 p-3 md:col-span-2"
          />

          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="rounded-xl border border-slate-300 p-3"
          >
            <option value="all">Todos los riesgos</option>
            <option value="low">Riesgo bajo</option>
            <option value="medium">Riesgo medio</option>
            <option value="high">Riesgo alto</option>
          </select>

          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value)}
            className="rounded-xl border border-slate-300 p-3"
          >
            <option value="all">Todo cumplimiento</option>
            <option value="100">OEA 100%</option>
            <option value="80">OEA 80%-99%</option>
            <option value="below80">Menos de 80%</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-4">Código</th>
              <th className="px-6 py-4">Empresa</th>
              <th className="px-6 py-4">RNC</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Cumplimiento</th>
              <th className="px-6 py-4">Riesgo</th>
              <th className="px-6 py-4">Estado</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => {
              const score = getCompliancePercent(customer);

              return (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-600">
                    {customer.customer_code || "—"}
                  </td>

                  <td className="px-6 py-4">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 hover:underline"
                    >
                      {customer.company_name || "Sin nombre"}
                    </Link>

                    <p className="mt-1 text-xs text-slate-500">
                      {customer.contact_name || "Sin contacto"} · {customer.email || "Sin email"}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {customer.tax_id || "Pendiente"}
                  </td>

                  <td className="px-6 py-4 text-slate-600">
                    {getCustomerTypeLabel(customer.customer_type)}
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        score === 100
                          ? "bg-emerald-50 text-emerald-700"
                          : score >= 80
                          ? "bg-blue-50 text-blue-700"
                          : score >= 60
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {score}%
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        customer.risk_level === "high"
                          ? "bg-red-50 text-red-700"
                          : customer.risk_level === "low"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {customer.risk_level === "high" ? "Alto" : customer.risk_level === "low" ? "Bajo" : "Medio"}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {customer.status === "inactive" ? "Inactivo" : "Activo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && filteredCustomers.length === 0 && (
          <div className="p-10 text-center text-slate-500">
            No hay clientes que coincidan con los filtros.
          </div>
        )}

        {loading && (
          <div className="p-10 text-center text-slate-500">
            Cargando clientes...
          </div>
        )}
      </div>
    </div>
  );
}
