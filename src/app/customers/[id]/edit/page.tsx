"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";

type Country = {
  code: string;
  name: string;
};

type TabId =
  | "company"
  | "contact"
  | "address"
  | "tax"
  | "operations"
  | "compliance";

type CustomerForm = {
  company_name: string;
  legal_name: string;
  trade_name: string;

  customer_type: string;
  partner_type: string;
  supplier_category: string;

  contact_name: string;
  email: string;
  phone: string;
  mobile_phone: string;
  whatsapp: string;

  address: string;
  city: string;
  country: string;
  postal_code: string;
  website: string;

  tax_id: string;
  tax_country: string;
  tax_exempt: boolean;

  preferred_transport: string;
  incoterm: string;
  account_manager: string;

  credit_limit: number;
  payment_terms: number;

  risk_level: string;
  kyc_completed: boolean;
  sanctions_checked: boolean;

  rnc_up_to_date: boolean;
  rnc_certificate_up_to_date: boolean;
  commitment_letter: boolean;
  compliance_checklist: boolean;
  manager_id_copy: boolean;
  has_certifications: boolean;
  certifications_details: string;

  status: string;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-blue-500 focus:outline-none";

const initialForm: CustomerForm = {
  company_name: "",
  legal_name: "",
  trade_name: "",

  customer_type: "importer",
  partner_type: "customer",
  supplier_category: "",

  contact_name: "",
  email: "",
  phone: "",
  mobile_phone: "",
  whatsapp: "",

  address: "",
  city: "",
  country: "",
  postal_code: "",
  website: "",

  tax_id: "",
  tax_country: "",
  tax_exempt: false,

  preferred_transport: "ocean",
  incoterm: "FOB",
  account_manager: "",

  credit_limit: 0,
  payment_terms: 30,

  risk_level: "medium",
  kyc_completed: false,
  sanctions_checked: false,

  rnc_up_to_date: false,
  rnc_certificate_up_to_date: false,
  commitment_letter: false,
  compliance_checklist: false,
  manager_id_copy: false,
  has_certifications: false,
  certifications_details: "",

  status: "active",
};

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = String(params.id || "");

  const [activeTab, setActiveTab] = useState<TabId>("company");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [form, setForm] = useState<CustomerForm>(initialForm);

  useEffect(() => {
    async function loadData() {
      if (!customerId) return;

      setPageLoading(true);
      setErrorMessage("");

      const [{ data: countriesData }, { data: customerData, error }] =
        await Promise.all([
          supabase
            .from("countries")
            .select("code, name")
            .order("name", { ascending: true }),

          supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .single(),
        ]);

      if (countriesData) {
        setCountries(countriesData);
      }

      if (error || !customerData) {
        setErrorMessage("No se pudo cargar el cliente.");
        setPageLoading(false);
        return;
      }

      setForm({
        company_name: customerData.company_name || "",
        legal_name: customerData.legal_name || "",
        trade_name: customerData.trade_name || "",

        customer_type: customerData.customer_type || "importer",
        partner_type: customerData.partner_type || "customer",
        supplier_category: customerData.supplier_category || "",

        contact_name: customerData.contact_name || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        mobile_phone: customerData.mobile_phone || "",
        whatsapp: customerData.whatsapp || "",

        address: customerData.address || "",
        city: customerData.city || "",
        country: customerData.country || "",
        postal_code: customerData.postal_code || "",
        website: customerData.website || "",

        tax_id: customerData.tax_id || "",
        tax_country: customerData.tax_country || "",
        tax_exempt: Boolean(customerData.tax_exempt),

        preferred_transport: customerData.preferred_transport || "ocean",
        incoterm: customerData.incoterm || "FOB",
        account_manager: customerData.account_manager || "",

        credit_limit: Number(customerData.credit_limit || 0),
        payment_terms: Number(customerData.payment_terms || 30),

        risk_level: customerData.risk_level || "medium",
        kyc_completed: Boolean(customerData.kyc_completed),
        sanctions_checked: Boolean(customerData.sanctions_checked),

        rnc_up_to_date: Boolean(customerData.rnc_up_to_date),
        rnc_certificate_up_to_date: Boolean(
          customerData.rnc_certificate_up_to_date
        ),
        commitment_letter: Boolean(customerData.commitment_letter),
        compliance_checklist: Boolean(customerData.compliance_checklist),
        manager_id_copy: Boolean(customerData.manager_id_copy),
        has_certifications: Boolean(customerData.has_certifications),
        certifications_details: customerData.certifications_details || "",

        status: customerData.status || "active",
      });

      setPageLoading(false);
    }

    loadData();
  }, [customerId]);

  function updateField(
    field: keyof CustomerForm,
    value: string | boolean | number
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const compliancePercent = useMemo(() => {
    const checks = [
      form.rnc_up_to_date,
      form.rnc_certificate_up_to_date,
      form.commitment_letter,
      form.compliance_checklist,
      form.manager_id_copy,
      form.kyc_completed,
      form.sanctions_checked,
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [
    form.rnc_up_to_date,
    form.rnc_certificate_up_to_date,
    form.commitment_letter,
    form.compliance_checklist,
    form.manager_id_copy,
    form.kyc_completed,
    form.sanctions_checked,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerId) {
      setErrorMessage("No se pudo identificar el cliente.");
      return;
    }

    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("customers")
      .update(form)
      .eq("id", customerId);

    setLoading(false);

    if (error) {
      if (
        error.message.includes("customers_tax_id_unique") ||
        error.message.includes("duplicate key")
      ) {
        setErrorMessage("Ya existe otro cliente registrado con este RNC / Tax ID.");
      } else {
        setErrorMessage("No se pudo actualizar el cliente: " + error.message);
      }

      return;
    }

    setSuccessMessage(
      "Cliente actualizado correctamente. Redirigiendo al expediente..."
    );

    setTimeout(() => {
      router.push(`/customers/${customerId}`);
      router.refresh();
    }, 1200);
  }

  const tabs: { id: TabId; label: string; description: string }[] = [
    { id: "company", label: "Empresa", description: "Datos corporativos" },
    { id: "contact", label: "Contacto", description: "Responsables y teléfonos" },
    { id: "address", label: "Dirección", description: "País, ciudad y dirección" },
    { id: "tax", label: "Fiscal", description: "RNC y datos tributarios" },
    { id: "operations", label: "Operaciones", description: "Logística y crédito" },
    { id: "compliance", label: "OEA / KYC", description: "Documentación requerida" },
  ];

  if (pageLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        Cargando cliente...
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {successMessage && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              ✓
            </div>

            <div>
              <p className="font-semibold text-emerald-800">
                Cliente actualizado
              </p>
              <p className="text-sm text-emerald-700">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700">
              ✕
            </div>

            <div>
              <p className="font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">JLG LOGISTICS WAREHOUSE</p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Editar Cliente
          </h1>

          <p className="mt-2 max-w-3xl text-slate-500">
            Actualiza el expediente comercial, fiscal, logístico y documental OEA del tercero.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/customers/${customerId}`)}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Volver al Expediente
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 bg-slate-50 p-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-sm font-semibold text-blue-900">
                Código del Cliente
              </p>

              <input
                type="text"
                value="El código se mantiene automáticamente"
                disabled
                className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm text-slate-500"
              />

              <p className="mt-2 text-xs text-blue-700">
                El código no se modifica manualmente.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-900">
                Cumplimiento documental
              </p>

              <p className="mt-2 text-3xl font-bold text-emerald-900">
                {compliancePercent}%
              </p>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600"
                  style={{ width: `${compliancePercent}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">
                Expediente OEA
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Actualiza las pestañas necesarias y guarda los cambios.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {tab.label}
                    </span>

                    <span
                      className={`mt-1 block text-xs ${
                        isActive ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {tab.description}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-h-[520px] p-6">
            {activeTab === "company" && (
              <section>
                <SectionTitle
                  title="Información de la Empresa"
                  description="Identificación comercial y clasificación del tercero."
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Nombre de la Empresa *">
                    <input
                      type="text"
                      required
                      value={form.company_name}
                      onChange={(e) =>
                        updateField("company_name", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Tipo de Cliente">
                    <select
                      value={form.customer_type}
                      onChange={(e) =>
                        updateField("customer_type", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="importer">Importador</option>
                      <option value="exporter">Exportador</option>
                      <option value="both">Importador / Exportador</option>
                      <option value="freight_forwarder">Freight Forwarder</option>
                      <option value="customs_broker">Agente Aduanal</option>
                      <option value="carrier">Transportista</option>
                      <option value="warehouse_customer">Cliente de Almacén</option>
                      <option value="supplier">Proveedor</option>
                      <option value="other">Otro</option>
                    </select>
                  </Field>

                  <Field label="Tipo de Relación">
                    <select
                      value={form.partner_type}
                      onChange={(e) =>
                        updateField("partner_type", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="customer">Cliente</option>
                      <option value="supplier">Suplidor</option>
                      <option value="both">Cliente y Suplidor</option>
                      <option value="relation">Empresa Relacionada</option>
                    </select>
                  </Field>

                  {(form.partner_type === "supplier" ||
                    form.partner_type === "both") && (
                    <Field label="Categoría del Suplidor">
                      <select
                        value={form.supplier_category}
                        onChange={(e) =>
                          updateField("supplier_category", e.target.value)
                        }
                        className={inputClass}
                      >
                        <option value="">Seleccione</option>
                        <option value="shipping_line">Naviera</option>
                        <option value="airline">Aerolínea</option>
                        <option value="trucking_company">Transportista</option>
                        <option value="warehouse">Almacén</option>
                        <option value="customs_broker">Agente Aduanal</option>
                        <option value="insurance">Seguro</option>
                        <option value="technology">Tecnología</option>
                        <option value="security">Seguridad</option>
                        <option value="consulting">Consultoría</option>
                        <option value="other">Otro</option>
                      </select>
                    </Field>
                  )}

                  <Field label="Razón Social">
                    <input
                      type="text"
                      value={form.legal_name}
                      onChange={(e) =>
                        updateField("legal_name", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Nombre Comercial">
                    <input
                      type="text"
                      value={form.trade_name}
                      onChange={(e) =>
                        updateField("trade_name", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Website">
                    <input
                      type="text"
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Estado">
                    <select
                      value={form.status}
                      onChange={(e) => updateField("status", e.target.value)}
                      className={inputClass}
                    >
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                    </select>
                  </Field>
                </div>
              </section>
            )}

            {activeTab === "contact" && (
              <section>
                <SectionTitle
                  title="Contacto Principal"
                  description="Datos de contacto para operaciones y seguimiento."
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Nombre del Contacto">
                    <input
                      type="text"
                      value={form.contact_name}
                      onChange={(e) =>
                        updateField("contact_name", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Teléfono">
                    <input
                      type="text"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Móvil">
                    <input
                      type="text"
                      value={form.mobile_phone}
                      onChange={(e) =>
                        updateField("mobile_phone", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="WhatsApp">
                    <input
                      type="text"
                      value={form.whatsapp}
                      onChange={(e) => updateField("whatsapp", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === "address" && (
              <section>
                <SectionTitle
                  title="Dirección"
                  description="Ubicación principal del cliente."
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Dirección">
                      <textarea
                        rows={3}
                        value={form.address}
                        onChange={(e) =>
                          updateField("address", e.target.value)
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="País">
                    <select
                      value={form.country}
                      onChange={(e) => updateField("country", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione un país</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Ciudad">
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Código Postal">
                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={(e) =>
                        updateField("postal_code", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === "tax" && (
              <section>
                <SectionTitle
                  title="Información Fiscal"
                  description="Datos tributarios y documentación fiscal."
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="RNC / Tax ID">
                    <input
                      type="text"
                      value={form.tax_id}
                      onChange={(e) => updateField("tax_id", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="País Fiscal">
                    <select
                      value={form.tax_country}
                      onChange={(e) =>
                        updateField("tax_country", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Seleccione un país</option>
                      {countries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <CheckCard
                    label="Exento de impuestos"
                    checked={form.tax_exempt}
                    onChange={(checked) => updateField("tax_exempt", checked)}
                  />
                </div>
              </section>
            )}

            {activeTab === "operations" && (
              <section>
                <SectionTitle
                  title="Operaciones Logísticas"
                  description="Preferencias operativas, crédito y responsable comercial."
                />

                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Transporte Preferido">
                    <select
                      value={form.preferred_transport}
                      onChange={(e) =>
                        updateField("preferred_transport", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="air">Aéreo</option>
                      <option value="ocean">Marítimo</option>
                      <option value="ground">Terrestre</option>
                    </select>
                  </Field>

                  <Field label="Incoterm">
                    <select
                      value={form.incoterm}
                      onChange={(e) => updateField("incoterm", e.target.value)}
                      className={inputClass}
                    >
                      <option value="EXW">EXW</option>
                      <option value="FOB">FOB</option>
                      <option value="CIF">CIF</option>
                      <option value="DAP">DAP</option>
                      <option value="DDP">DDP</option>
                      <option value="FCA">FCA</option>
                      <option value="CFR">CFR</option>
                      <option value="CPT">CPT</option>
                    </select>
                  </Field>

                  <Field label="Ejecutivo de Cuenta">
                    <input
                      type="text"
                      value={form.account_manager}
                      onChange={(e) =>
                        updateField("account_manager", e.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Límite de Crédito">
                    <input
                      type="number"
                      value={form.credit_limit}
                      onChange={(e) =>
                        updateField("credit_limit", Number(e.target.value))
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Términos de Pago">
                    <input
                      type="number"
                      value={form.payment_terms}
                      onChange={(e) =>
                        updateField("payment_terms", Number(e.target.value))
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </section>
            )}

            {activeTab === "compliance" && (
              <section>
                <SectionTitle
                  title="Cumplimiento OEA / KYC"
                  description="Checklist documental requerido para el expediente del cliente."
                />

                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Avance documental
                      </p>
                      <p className="text-sm text-slate-500">
                        Marca los documentos recibidos o validados.
                      </p>
                    </div>

                    <p className="text-2xl font-bold text-slate-900">
                      {compliancePercent}%
                    </p>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{ width: `${compliancePercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <CheckCard
                    label="RNC al día"
                    checked={form.rnc_up_to_date}
                    onChange={(checked) =>
                      updateField("rnc_up_to_date", checked)
                    }
                  />

                  <CheckCard
                    label="Certificación de RNC al día"
                    checked={form.rnc_certificate_up_to_date}
                    onChange={(checked) =>
                      updateField("rnc_certificate_up_to_date", checked)
                    }
                  />

                  <CheckCard
                    label="Carta compromiso"
                    checked={form.commitment_letter}
                    onChange={(checked) =>
                      updateField("commitment_letter", checked)
                    }
                  />

                  <CheckCard
                    label="Checklist de cumplimiento"
                    checked={form.compliance_checklist}
                    onChange={(checked) =>
                      updateField("compliance_checklist", checked)
                    }
                  />

                  <CheckCard
                    label="Cédula del gerente"
                    checked={form.manager_id_copy}
                    onChange={(checked) =>
                      updateField("manager_id_copy", checked)
                    }
                  />

                  <CheckCard
                    label="KYC completado"
                    checked={form.kyc_completed}
                    onChange={(checked) => updateField("kyc_completed", checked)}
                  />

                  <CheckCard
                    label="Verificación de sanciones realizada"
                    checked={form.sanctions_checked}
                    onChange={(checked) =>
                      updateField("sanctions_checked", checked)
                    }
                  />

                  <CheckCard
                    label="Tiene certificaciones"
                    checked={form.has_certifications}
                    onChange={(checked) =>
                      updateField("has_certifications", checked)
                    }
                  />

                  <Field label="Nivel de Riesgo">
                    <select
                      value={form.risk_level}
                      onChange={(e) =>
                        updateField("risk_level", e.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="low">Bajo</option>
                      <option value="medium">Medio</option>
                      <option value="high">Alto</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="¿Cuáles certificaciones tiene?">
                      <textarea
                        rows={3}
                        value={form.certifications_details}
                        onChange={(e) =>
                          updateField("certifications_details", e.target.value)
                        }
                        placeholder="Ejemplo: BASC, ISO 9001, OEA, C-TPAT..."
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            Al guardar, se actualizará el expediente del cliente.
          </p>

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={() => router.push(`/customers/${customerId}`)}
              className="rounded-xl border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 transition ${
        checked
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <span className="font-medium text-slate-800">{label}</span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
    </label>
  );
}
