"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type {
  BankReference,
  BusinessAssociateFormData,
  RepeatedContact,
} from "../../types/businessAssociate";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100";
const sectionClass =
  "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";

const emptyContact = (): RepeatedContact => ({
  name: "",
  identification: "",
  phone: "",
  mobile: "",
  email: "",
  company: "",
  participation: "",
});

const emptyBankReference = (): BankReference => ({
  ...emptyContact(),
  accountNumber: "",
});

const initialForm: BusinessAssociateFormData = {
  associateTypes: [],
  clientTypes: [],
  supplierTypes: [],
  otherAssociateType: "",
  contractorFormality: "",
  company: {
    hasCertifications: "",
    certifications: [],
    otherCertification: "",
    commercialName: "",
    rnc: "",
    economicActivity: "",
    regime: "",
    address: "",
    sector: "",
    city: "",
    phone: "",
    fax: "",
    email: "",
    description: "",
  },
  representative: {
    fullName: "",
    idNumber: "",
    occupation: "",
    maritalStatus: "",
    address: "",
    sector: "",
    city: "",
    phone: "",
    mobile: "",
    email: "",
  },
  operations: {
    merchandiseClasses: "",
    vehicleClasses: "",
  },
  shareholders: [emptyContact()],
  legalRepresentatives: [emptyContact()],
  contacts: {
    commercial: emptyContact(),
    payments: emptyContact(),
    dispatch: emptyContact(),
    other: emptyContact(),
  },
  commercialReferences: [emptyContact()],
  bankReferences: [emptyBankReference()],
  familyReferences: [emptyContact()],
  guarantor: {
    fullName: "",
    idNumber: "",
    occupation: "",
    maritalStatus: "",
    address: "",
    sector: "",
    city: "",
    phone: "",
    mobile: "",
    email: "",
  },
  emergencyContacts: [emptyContact()],
  payment: {
    method: "",
    creditDays: "",
    currencies: [],
  },
  documentsConfirmed: [],
  authorization: {
    accepted: false,
    applicantName: "",
    date: new Date().toISOString().slice(0, 10),
    signatureCaptured: false,
  },
};

const steps = [
  { title: "Empresa", icon: Building2 },
  { title: "Representante", icon: Users },
  { title: "Organización", icon: Users },
  { title: "Contactos", icon: Users },
  { title: "Referencias", icon: FileCheck2 },
  { title: "Documentos", icon: Upload },
  { title: "Autorizar", icon: ShieldCheck },
];

const documents = [
  { id: "rnc", label: "Tarjeta o certificación de RNC" },
  { id: "registro_mercantil", label: "Registro mercantil vigente" },
  { id: "estatutos", label: "Estatutos sociales" },
  { id: "ultima_asamblea", label: "Última asamblea" },
  { id: "identificaciones", label: "Cédulas de representantes legales" },
  { id: "certificaciones", label: "Certificaciones vigentes, si aplica" },
  { id: "cedula_persona", label: "Cédula de identidad, para persona física" },
  { id: "cedula_garante", label: "Cédula del garante, para persona física" },
  { id: "pagos_automaticos", label: "Formulario de pagos automáticos, si aplica" },
];

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export default function BusinessAssociateRegistrationPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null);
  const startedAt = useRef(Date.now());

  const completed = useMemo(() => {
    return [
      form.associateTypes.length > 0 &&
        Boolean(form.company.commercialName && form.company.email),
      Boolean(form.representative.fullName || form.contacts.commercial.name),
      form.shareholders.some((row) => row.name) ||
        form.legalRepresentatives.some((row) => row.name),
      Boolean(
        form.contacts.commercial.name ||
          form.contacts.payments.name ||
          form.contacts.dispatch.name
      ),
      form.commercialReferences.some((row) => row.company || row.name),
      Object.values(files).some(Boolean) || form.documentsConfirmed.length > 0,
      Boolean(
        form.authorization.accepted &&
          form.authorization.applicantName &&
          signatureBlob
      ),
    ];
  }, [files, form, signatureBlob]);

  function updateCompany(field: keyof BusinessAssociateFormData["company"], value: string) {
    setForm((current) => ({
      ...current,
      company: { ...current.company, [field]: value },
    }));
  }

  function updateRepresentative(
    field: keyof BusinessAssociateFormData["representative"],
    value: string
  ) {
    setForm((current) => ({
      ...current,
      representative: { ...current.representative, [field]: value },
    }));
  }

  async function submit() {
    setError("");
    if (
      form.associateTypes.length === 0 ||
      !form.company.commercialName.trim() ||
      !form.company.email.trim()
    ) {
      setStep(0);
      setError("Complete el tipo de asociado, nombre comercial y correo electrónico.");
      return;
    }
    if (
      !form.authorization.accepted ||
      !form.authorization.applicantName.trim() ||
      !signatureBlob
    ) {
      setStep(6);
      setError(
        "Debe aceptar la autorización, escribir el nombre y dibujar la firma."
      );
      return;
    }

    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("payload", JSON.stringify(form));
      body.set("started_at", String(startedAt.current));
      body.set("middle_name", "");
      Object.entries(files).forEach(([type, file]) => {
        if (file) body.append(`document__${type}`, file);
      });
      body.append(
        "document__firma_electronica",
        signatureBlob,
        "firma-electronica.png"
      );

      const response = await fetch("/api/business-associate-applications", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        error?: string;
        trackingCode?: string;
      };
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la solicitud.");
      setTrackingCode(result.trackingCode || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la solicitud."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (trackingCode) {
    return (
      <PublicFrame>
        <main className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-12">
          <div className="w-full rounded-[2rem] border border-emerald-200 bg-white p-7 text-center shadow-xl shadow-slate-200/70 sm:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={42} />
            </div>
            <p className="mt-7 text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Solicitud recibida
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Gracias por completar su registro
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-slate-600">
              El equipo de JLG Cargo revisará la información y los documentos antes de
              aprobar el expediente.
            </p>
            <div className="mx-auto mt-8 max-w-md rounded-2xl border border-blue-200 bg-blue-50 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
                Número de seguimiento
              </p>
              <p className="mt-2 break-all text-2xl font-black text-blue-950">
                {trackingCode}
              </p>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              Guarde este número para cualquier consulta relacionada con su solicitud.
            </p>
          </div>
        </main>
      </PublicFrame>
    );
  }

  return (
    <PublicFrame>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="grid gap-7 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                GS-AN-08-001
              </p>
              <h1 className="mt-2 text-2xl font-black leading-tight">
                Registro de Asociado de Negocio
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Complete únicamente los campos que correspondan a su tipo de relación
                con JLG Cargo.
              </p>
              <div className="mt-6 hidden space-y-2 lg:block">
                {steps.map((item, index) => {
                  const Icon = item.icon;
                  const active = index === step;
                  return (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => setStep(index)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "bg-blue-600 font-bold text-white"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${
                          completed[index]
                            ? "bg-emerald-500 text-white"
                            : active
                              ? "bg-white/15"
                              : "bg-slate-800"
                        }`}
                      >
                        {completed[index] ? <Check size={15} /> : <Icon size={15} />}
                      </span>
                      {item.title}
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
                <LockKeyhole size={16} className="shrink-0 text-emerald-400" />
                Sus datos serán tratados de forma confidencial.
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex gap-1.5 lg:hidden">
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setStep(index)}
                  aria-label={`Ir a ${item.title}`}
                  className={`h-2 flex-1 rounded-full ${
                    index === step
                      ? "bg-blue-600"
                      : completed[index]
                        ? "bg-emerald-500"
                        : "bg-slate-300"
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
                {error}
              </div>
            )}

            {step === 0 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 1 de 7"
                  title="Tipo de asociado e información de la empresa"
                  description="Identifique la relación comercial y los datos principales de la organización."
                />
                <section className={sectionClass}>
                  <SectionTitle title="Tipo de asociado de negocio" />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["cliente", "Cliente"],
                      ["suplidor", "Suplidor"],
                      ["otro", "Otro"],
                    ].map(([value, label]) => (
                      <ChoiceCard
                        key={value}
                        checked={form.associateTypes.includes(value)}
                        label={label}
                        onChange={() =>
                          setForm((current) => ({
                            ...current,
                            associateTypes: toggleValue(
                              current.associateTypes,
                              value
                            ),
                          }))
                        }
                      />
                    ))}
                  </div>
                  {form.associateTypes.includes("cliente") && (
                    <div className="mt-6">
                      <FieldLabel>Tipo de cliente</FieldLabel>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {[
                          "Almacén personal",
                          "Almacén general",
                          "Almacén fiscal",
                          "Reexportación y desconsolidación",
                          "Depósito de vehículos",
                        ].map((value) => (
                          <CheckLine
                            key={value}
                            label={value}
                            checked={form.clientTypes.includes(value)}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                clientTypes: toggleValue(
                                  current.clientTypes,
                                  value
                                ),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {form.associateTypes.includes("suplidor") && (
                    <div className="mt-6">
                      <FieldLabel>Tipo de suplidor</FieldLabel>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {["Transporte", "Servicios", "Contratista"].map((value) => (
                          <CheckLine
                            key={value}
                            label={value}
                            checked={form.supplierTypes.includes(value)}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                supplierTypes: toggleValue(
                                  current.supplierTypes,
                                  value
                                ),
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {form.associateTypes.includes("otro") && (
                    <Field label="Especifique el tipo de asociado">
                      <input
                        className={inputClass}
                        value={form.otherAssociateType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            otherAssociateType: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  )}
                </section>

                <section className={sectionClass}>
                  <SectionTitle title="Información de la empresa" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Nombre comercial *">
                      <input
                        required
                        className={inputClass}
                        value={form.company.commercialName}
                        onChange={(event) =>
                          updateCompany("commercialName", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="RNC">
                      <input
                        className={inputClass}
                        value={form.company.rnc}
                        onChange={(event) => updateCompany("rnc", event.target.value)}
                      />
                    </Field>
                    <Field label="Actividad económica">
                      <input
                        className={inputClass}
                        value={form.company.economicActivity}
                        onChange={(event) =>
                          updateCompany("economicActivity", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Régimen">
                      <select
                        className={inputClass}
                        value={form.company.regime}
                        onChange={(event) =>
                          updateCompany("regime", event.target.value)
                        }
                      >
                        <option value="">Seleccione</option>
                        <option>Regular</option>
                        <option>Especial</option>
                        <option>Gubernamental</option>
                      </select>
                    </Field>
                    <Field label="Dirección" wide>
                      <input
                        className={inputClass}
                        value={form.company.address}
                        onChange={(event) =>
                          updateCompany("address", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Sector">
                      <input
                        className={inputClass}
                        value={form.company.sector}
                        onChange={(event) =>
                          updateCompany("sector", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Ciudad">
                      <input
                        className={inputClass}
                        value={form.company.city}
                        onChange={(event) => updateCompany("city", event.target.value)}
                      />
                    </Field>
                    <Field label="Teléfono">
                      <input
                        type="tel"
                        className={inputClass}
                        value={form.company.phone}
                        onChange={(event) =>
                          updateCompany("phone", event.target.value)
                        }
                      />
                    </Field>
                    <Field label="Correo electrónico *">
                      <input
                        required
                        type="email"
                        className={inputClass}
                        value={form.company.email}
                        onChange={(event) => updateCompany("email", event.target.value)}
                      />
                    </Field>
                    <Field label="Descripción de la empresa o servicio" wide>
                      <textarea
                        rows={4}
                        className={inputClass}
                        value={form.company.description}
                        onChange={(event) =>
                          updateCompany("description", event.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <FieldLabel>¿La empresa tiene certificaciones?</FieldLabel>
                    <div className="mt-2 flex gap-3">
                      {["Sí", "No"].map((value) => (
                        <ChoiceCard
                          key={value}
                          compact
                          checked={form.company.hasCertifications === value}
                          label={value}
                          onChange={() => updateCompany("hasCertifications", value)}
                        />
                      ))}
                    </div>
                    {form.company.hasCertifications === "Sí" && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        {["BASC", "OEA", "C-TPAT", "Otra"].map((value) => (
                          <CheckLine
                            key={value}
                            label={value}
                            checked={form.company.certifications.includes(value)}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                company: {
                                  ...current.company,
                                  certifications: toggleValue(
                                    current.company.certifications,
                                    value
                                  ),
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 2 de 7"
                  title="Persona física o representante legal"
                  description="Complete los datos de la persona responsable ante JLG Cargo."
                />
                <section className={sectionClass}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[
                      ["fullName", "Nombres y apellidos"],
                      ["idNumber", "Cédula o identificación"],
                      ["occupation", "Ocupación"],
                      ["maritalStatus", "Estado civil"],
                      ["address", "Dirección"],
                      ["sector", "Sector"],
                      ["city", "Ciudad"],
                      ["phone", "Teléfono"],
                      ["mobile", "Celular"],
                      ["email", "Correo electrónico"],
                    ].map(([field, label]) => (
                      <Field
                        key={field}
                        label={label}
                        wide={field === "address"}
                      >
                        <input
                          type={field === "email" ? "email" : "text"}
                          className={inputClass}
                          value={
                            form.representative[
                              field as keyof typeof form.representative
                            ]
                          }
                          onChange={(event) =>
                            updateRepresentative(
                              field as keyof BusinessAssociateFormData["representative"],
                              event.target.value
                            )
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </section>
                <section className={sectionClass}>
                  <SectionTitle title="Información operativa" />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Clase de mercancías">
                      <textarea
                        rows={4}
                        className={inputClass}
                        value={form.operations.merchandiseClasses}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            operations: {
                              ...current.operations,
                              merchandiseClasses: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Clase de vehículos a utilizar">
                      <textarea
                        rows={4}
                        className={inputClass}
                        value={form.operations.vehicleClasses}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            operations: {
                              ...current.operations,
                              vehicleClasses: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </section>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 3 de 7"
                  title="Estructura de la organización"
                  description="Registre socios con más del 20% y representantes legales."
                />
                <RepeaterSection
                  title="Socios o accionistas con participación mayor al 20%"
                  rows={form.shareholders}
                  columns={[
                    ["name", "Nombres y apellidos"],
                    ["identification", "Identificación"],
                    ["participation", "% participación"],
                  ]}
                  onChange={(rows) =>
                    setForm((current) => ({ ...current, shareholders: rows }))
                  }
                />
                <RepeaterSection
                  title="Representantes legales"
                  rows={form.legalRepresentatives}
                  columns={[
                    ["name", "Nombres y apellidos"],
                    ["identification", "Identificación"],
                    ["phone", "Teléfono / celular"],
                  ]}
                  onChange={(rows) =>
                    setForm((current) => ({
                      ...current,
                      legalRepresentatives: rows,
                    }))
                  }
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 4 de 7"
                  title="Contactos de la empresa"
                  description="Indique las personas responsables de cada área."
                />
                <section className={sectionClass}>
                  <div className="space-y-6">
                    {(
                      [
                        ["commercial", "Contacto comercial"],
                        ["payments", "Contacto de pagos"],
                        ["dispatch", "Contacto de despachos"],
                        ["other", "Otro contacto"],
                      ] as const
                    ).map(([key, label]) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <h2 className="font-bold text-slate-900">{label}</h2>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {(
                            [
                              ["name", "Nombres y apellidos"],
                              ["phone", "Teléfono"],
                              ["email", "Correo electrónico"],
                            ] as const
                          ).map(([field, fieldLabel]) => (
                            <Field key={field} label={fieldLabel}>
                              <input
                                type={field === "email" ? "email" : "text"}
                                className={inputClass}
                                value={form.contacts[key][field] || ""}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    contacts: {
                                      ...current.contacts,
                                      [key]: {
                                        ...current.contacts[key],
                                        [field]: event.target.value,
                                      },
                                    },
                                  }))
                                }
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 5 de 7"
                  title="Referencias y datos para personas físicas"
                  description="Complete solo las secciones que apliquen."
                />
                <RepeaterSection
                  title="Referencias comerciales"
                  rows={form.commercialReferences}
                  columns={[
                    ["company", "Empresa"],
                    ["name", "Contacto"],
                    ["phone", "Teléfono"],
                    ["email", "Correo"],
                  ]}
                  onChange={(rows) =>
                    setForm((current) => ({
                      ...current,
                      commercialReferences: rows,
                    }))
                  }
                />
                <BankRepeater
                  rows={form.bankReferences}
                  onChange={(rows) =>
                    setForm((current) => ({ ...current, bankReferences: rows }))
                  }
                />
                <RepeaterSection
                  title="Referencias familiares - personas físicas"
                  rows={form.familyReferences}
                  columns={[
                    ["name", "Nombre"],
                    ["phone", "Teléfono"],
                    ["email", "Correo"],
                  ]}
                  onChange={(rows) =>
                    setForm((current) => ({
                      ...current,
                      familyReferences: rows,
                    }))
                  }
                />
                <section className={sectionClass}>
                  <SectionTitle
                    title="Información del garante"
                    subtitle="Aplica para personas físicas"
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[
                      ["fullName", "Nombres y apellidos"],
                      ["idNumber", "Cédula"],
                      ["occupation", "Ocupación"],
                      ["maritalStatus", "Estado civil"],
                      ["address", "Dirección"],
                      ["sector", "Sector"],
                      ["city", "Ciudad"],
                      ["phone", "Teléfono"],
                      ["mobile", "Celular"],
                      ["email", "Correo"],
                    ].map(([field, label]) => (
                      <Field key={field} label={label} wide={field === "address"}>
                        <input
                          type={field === "email" ? "email" : "text"}
                          className={inputClass}
                          value={
                            form.guarantor[field as keyof typeof form.guarantor]
                          }
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              guarantor: {
                                ...current.guarantor,
                                [field]: event.target.value,
                              },
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </section>
                <RepeaterSection
                  title="Contactos de emergencia"
                  rows={form.emergencyContacts}
                  columns={[
                    ["name", "Nombres y apellidos"],
                    ["phone", "Teléfono"],
                    ["mobile", "Celular"],
                  ]}
                  onChange={(rows) =>
                    setForm((current) => ({
                      ...current,
                      emergencyContacts: rows,
                    }))
                  }
                />
              </div>
            )}

            {step === 5 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 6 de 7"
                  title="Condiciones de pago y documentos"
                  description="Los términos de pago aplican a suplidores y contratistas."
                />
                <section className={sectionClass}>
                  <SectionTitle title="Términos y condiciones de pago" />
                  <div className="grid gap-6 sm:grid-cols-3">
                    <Field label="Modalidad">
                      <select
                        className={inputClass}
                        value={form.payment.method}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            payment: {
                              ...current.payment,
                              method: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Seleccione</option>
                        <option value="credito">Crédito</option>
                        <option value="contado">Contado</option>
                      </select>
                    </Field>
                    <Field label="Plazo de crédito">
                      <select
                        className={inputClass}
                        value={form.payment.creditDays}
                        disabled={form.payment.method !== "credito"}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            payment: {
                              ...current.payment,
                              creditDays: event.target.value,
                            },
                          }))
                        }
                      >
                        <option value="">Seleccione</option>
                        {["15", "30", "60", "90"].map((days) => (
                          <option key={days} value={days}>
                            {days} días
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div>
                      <FieldLabel>Moneda para pago</FieldLabel>
                      <div className="mt-2 flex gap-3">
                        {["RD$", "US$"].map((currency) => (
                          <CheckLine
                            key={currency}
                            label={currency}
                            checked={form.payment.currencies.includes(currency)}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                payment: {
                                  ...current.payment,
                                  currencies: toggleValue(
                                    current.payment.currencies,
                                    currency
                                  ),
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
                <section className={sectionClass}>
                  <SectionTitle
                    title="Documentos requeridos"
                    subtitle="Adjunte PDF, JPG o PNG. Máximo 8 MB por archivo."
                  />
                  <div className="grid gap-3">
                    {documents.map((document) => (
                      <label
                        key={document.id}
                        className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                          files[document.id]
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            files[document.id]
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {files[document.id] ? (
                            <Check size={20} />
                          ) : (
                            <Upload size={20} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900">
                            {document.label}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {files[document.id]?.name || "Seleccionar archivo"}
                          </span>
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            if (file && file.size > 8 * 1024 * 1024) {
                              setError(
                                `${document.label}: el archivo supera el límite de 8 MB.`
                              );
                              event.target.value = "";
                              return;
                            }
                            setFiles((current) => ({
                              ...current,
                              [document.id]: file,
                            }));
                            setForm((current) => ({
                              ...current,
                              documentsConfirmed: file
                                ? Array.from(
                                    new Set([
                                      ...current.documentsConfirmed,
                                      document.id,
                                    ])
                                  )
                                : current.documentsConfirmed.filter(
                                    (id) => id !== document.id
                                  ),
                            }));
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-6">
                <FormHeading
                  eyebrow="Paso 7 de 7"
                  title="Autorización y envío"
                  description="Revise los datos y confirme la autorización para completar la solicitud."
                />
                <section className={sectionClass}>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-950">
                    Autorizo a JLG CARGO SRL a verificar y confirmar las
                    informaciones suministradas e investigar el historial crediticio
                    para fines de aprobación de esta solicitud. Asimismo, me
                    comprometo a remitir cualquier documentación adicional requerida
                    para completar el proceso.
                  </div>
                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-slate-300 accent-blue-600"
                      checked={form.authorization.accepted}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          authorization: {
                            ...current.authorization,
                            accepted: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span>
                      <span className="block font-bold text-slate-900">
                        Acepto la autorización y declaro que los datos son correctos.
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        Esta aceptación y el nombre escrito funcionarán como
                        confirmación electrónica de la solicitud.
                      </span>
                    </span>
                  </label>
                  <div className="mt-6">
                    <FieldLabel>Firma electrónica *</FieldLabel>
                    <p className="mt-1 text-sm text-slate-500">
                      Dibuje su firma con el dedo, lápiz digital o mouse.
                    </p>
                    <SignaturePad
                      onChange={(blob) => {
                        setSignatureBlob(blob);
                        setForm((current) => ({
                          ...current,
                          authorization: {
                            ...current.authorization,
                            signatureCaptured: Boolean(blob),
                          },
                        }));
                      }}
                    />
                  </div>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    <Field label="Nombre completo del solicitante *">
                      <input
                        className={inputClass}
                        value={form.authorization.applicantName}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            authorization: {
                              ...current.authorization,
                              applicantName: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                    <Field label="Fecha">
                      <input
                        type="date"
                        className={inputClass}
                        value={form.authorization.date}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            authorization: {
                              ...current.authorization,
                              date: event.target.value,
                            },
                          }))
                        }
                      />
                    </Field>
                  </div>
                </section>
                <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-xl">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-blue-300">
                        Solicitud lista para enviar
                      </p>
                      <p className="mt-1 max-w-xl text-sm text-slate-300">
                        JLG Cargo recibirá el expediente como pendiente de revisión.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void submit()}
                      disabled={submitting}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? (
                        <LoaderCircle className="animate-spin" size={20} />
                      ) : (
                        <Send size={19} />
                      )}
                      {submitting ? "Enviando..." : "Enviar solicitud"}
                    </button>
                  </div>
                </section>
              </div>
            )}

            <div className="mt-7 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={step === 0 || submitting}
                onClick={() => {
                  setError("");
                  setStep((current) => Math.max(0, current - 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:invisible"
              >
                <ArrowLeft size={18} /> Anterior
              </button>
              {step < steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    if (step === 5 && !form.authorization.applicantName) {
                      const suggestedName =
                        form.representative.fullName ||
                        form.contacts.commercial.name;
                      if (suggestedName) {
                        setForm((current) => ({
                          ...current,
                          authorization: {
                            ...current.authorization,
                            applicantName: suggestedName,
                          },
                        }));
                      }
                    }
                    setStep((current) => Math.min(steps.length - 1, current + 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
                >
                  Siguiente <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </PublicFrame>
  );
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,transparent_34%),linear-gradient(#f8fafc,#eef2f7)]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Image
              src="/jlg-cargo-logo.png"
              alt="JLG Cargo"
              width={160}
              height={80}
              className="h-14 w-auto object-contain"
              priority
            />
            <div className="hidden border-l border-slate-200 pl-4 sm:block">
              <p className="text-sm font-black tracking-tight text-slate-950">
                JLG CARGO, SRL
              </p>
              <p className="text-xs text-slate-500">Operadora logística</p>
            </div>
          </div>
          <div className="text-right text-xs leading-5 text-slate-500">
            <p className="font-bold text-slate-700">Formulario seguro</p>
            <p>Clasificación: Restringido</p>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
        JLG Cargo, SRL · Av. 27 de Febrero #409, Ens. Quisqueya, Santo Domingo ·
        (809) 620-9250
      </footer>
    </div>
  );
}

function FormHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-bold text-slate-700">{children}</span>;
}

function ChoiceCard({
  checked,
  label,
  onChange,
  compact = false,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={`flex items-center gap-3 rounded-2xl border text-left text-sm font-bold transition ${
        compact ? "px-4 py-3" : "p-4"
      } ${
        checked
          ? "border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
      }`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
          checked
            ? "border-blue-600 bg-blue-600 text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {checked && <Check size={14} />}
      </span>
      {label}
    </button>
  );
}

function CheckLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 accent-blue-600"
      />
      {label}
    </label>
  );
}

function RepeaterSection({
  title,
  rows,
  columns,
  onChange,
}: {
  title: string;
  rows: RepeatedContact[];
  columns: [keyof RepeatedContact, string][];
  onChange: (rows: RepeatedContact[]) => void;
}) {
  function update(index: number, field: keyof RepeatedContact, value: string) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  return (
    <section className={sectionClass}>
      <SectionTitle title={title} />
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Registro {index + 1}
              </p>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  aria-label={`Eliminar registro ${index + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
            <div
              className={`grid gap-3 ${
                columns.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"
              }`}
            >
              {columns.map(([field, label]) => (
                <Field key={field} label={label}>
                  <input
                    type={field === "email" ? "email" : "text"}
                    className={inputClass}
                    value={row[field] || ""}
                    onChange={(event) => update(index, field, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < 4 && (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyContact()])}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-100"
        >
          <Plus size={17} /> Agregar otro
        </button>
      )}
    </section>
  );
}

function BankRepeater({
  rows,
  onChange,
}: {
  rows: BankReference[];
  onChange: (rows: BankReference[]) => void;
}) {
  const columns: [keyof BankReference, string][] = [
    ["company", "Entidad financiera"],
    ["accountNumber", "No. de cuenta"],
    ["name", "Contacto"],
    ["phone", "Teléfono"],
    ["email", "Correo"],
  ];

  return (
    <section className={sectionClass}>
      <SectionTitle title="Referencias bancarias" />
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Referencia {index + 1}
              </p>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
                  }
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                  aria-label={`Eliminar referencia ${index + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {columns.map(([field, label]) => (
                <Field key={field} label={label}>
                  <input
                    type={field === "email" ? "email" : "text"}
                    className={inputClass}
                    value={row[field] || ""}
                    onChange={(event) =>
                      onChange(
                        rows.map((item, rowIndex) =>
                          rowIndex === index
                            ? { ...item, [field]: event.target.value }
                            : item
                        )
                      )
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
      </div>
      {rows.length < 4 && (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyBankReference()])}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-800 hover:bg-blue-100"
        >
          <Plus size={17} /> Agregar otra
        </button>
      )}
    </section>
  );
}

function SignaturePad({
  onChange,
}: {
  onChange: (signature: Blob | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    lastPoint.current = point(event);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current || !lastPoint.current) return;
    event.preventDefault();
    const nextPoint = point(event);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.strokeStyle = "#0f172a";
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(lastPoint.current.x, lastPoint.current.y);
    context.lineTo(nextPoint.x, nextPoint.y);
    context.stroke();
    lastPoint.current = nextPoint;
    setHasSignature(true);
  }

  function finish() {
    drawing.current = false;
    lastPoint.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const context = exportCanvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.drawImage(canvas, 0, 0);
    exportCanvas.toBlob((blob) => onChange(blob), "image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    drawing.current = false;
    lastPoint.current = null;
    onChange(null);
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-300 bg-white">
      <canvas
        ref={canvasRef}
        width={900}
        height={260}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
        className="block h-44 w-full touch-none cursor-crosshair bg-[linear-gradient(to_bottom,transparent_78%,#cbd5e1_78%,#cbd5e1_79%,transparent_79%)]"
        aria-label="Área para dibujar la firma electrónica"
      />
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
        <span
          className={`text-xs font-bold ${
            hasSignature ? "text-emerald-700" : "text-slate-500"
          }`}
        >
          {hasSignature ? "Firma capturada" : "Firme sobre la línea"}
        </span>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
        >
          <Trash2 size={15} /> Limpiar
        </button>
      </div>
    </div>
  );
}
