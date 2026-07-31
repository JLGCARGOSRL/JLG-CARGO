"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase/client";

const documentTypes = [
  { value: "RNC", label: "RNC" },
  { value: "RNC_CERTIFICATE", label: "Certificación RNC" },
  { value: "COMMITMENT_LETTER", label: "Carta Compromiso" },
  { value: "COMPLIANCE_CHECKLIST", label: "Checklist Cumplimiento" },
  { value: "MANAGER_ID", label: "Cédula del Gerente" },
  { value: "KYC_FORM", label: "Formulario KYC" },
  { value: "SANCTIONS_SCREENING", label: "Verificación de Sanciones" },
  { value: "CERTIFICATION", label: "Certificación" },
  { value: "INSURANCE", label: "Seguro" },
  { value: "CONTRACT", label: "Contrato" },
  { value: "OTHER", label: "Otro" },
];

export default function UploadCustomerDocumentPage() {
  const router = useRouter();
  const params = useParams();

  const customerId = String(params.id || "");

  const [documentType, setDocumentType] = useState("RNC");
  const [documentName, setDocumentName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!customerId) {
      setErrorMessage("No se pudo identificar el cliente.");
      return;
    }

    if (!file) {
      setErrorMessage("Debe seleccionar un archivo PDF.");
      return;
    }

    if (file.type !== "application/pdf") {
      setErrorMessage("Solo se permiten archivos PDF.");
      return;
    }

    setLoading(true);

    const safeFileName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.\-_]/g, "-");

    const filePath = `${customerId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("customer-documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setLoading(false);
      setErrorMessage("Error subiendo el PDF: " + uploadError.message);
      return;
    }
  const publicUrl =
  `https://rgavbykdeizykqrvujjh.supabase.co/storage/v1/object/public/customer-documents/${filePath}`;
    
    const documentRecord = {
      customer_id: customerId,
      document_type: documentType,
      document_name: documentName || file.name,
      file_name: file.name,
      file_path: filePath,
      file_url: publicUrl,
      file_size: file.size,
      issue_date: issueDate || null,
      expiration_date: expirationDate || null,
      notes: notes.trim() || null,
      status: "active",
    };

    let { error: insertError } = await supabase
      .from("customer_documents")
      .insert([documentRecord]);

    if (insertError?.code === "PGRST204" && insertError.message.includes("notes")) {
      const { notes: _notes, ...compatibleRecord } = documentRecord;
      void _notes;
      const retry = await supabase
        .from("customer_documents")
        .insert([compatibleRecord]);
      insertError = retry.error;
    }

    setLoading(false);

    if (insertError) {
      setErrorMessage(
        "El PDF se subió, pero no se pudo registrar en la base de datos: " +
          insertError.message
      );
      return;
    }

    setSuccessMessage("Documento cargado correctamente.");

    setTimeout(() => {
      router.push(`/customers/${customerId}`);
      router.refresh();
    }, 1200);
  }

  return (
    <div className="max-w-4xl">
      {successMessage && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="font-semibold text-emerald-800">Documento guardado</p>
          <p className="text-sm text-emerald-700">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="font-semibold text-red-800">Error</p>
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Expediente del Cliente
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Subir Documento OEA
          </h1>

          <p className="mt-2 text-slate-500">
            Adjunta PDFs al expediente documental del cliente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/customers/${customerId}`)}
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Volver al expediente
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Datos del documento
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Selecciona el tipo de documento y adjunta el PDF correspondiente.
          </p>
        </div>

        <div className="space-y-6 p-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Tipo de documento
              </label>

              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Nombre del documento
              </label>

              <input
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Ejemplo: Certificación RNC 2026"
                className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha de emisión
              </label>

              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Fecha de vencimiento
              </label>

              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Archivo PDF *
            </label>

            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4"
              required
            />

            <p className="mt-2 text-xs text-slate-500">
              Solo se permiten archivos PDF.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Observaciones
            </label>

            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre este documento."
              className="w-full rounded-xl border border-slate-300 p-3 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            El archivo se guardará en Supabase Storage dentro del expediente del cliente.
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
              {loading ? "Subiendo..." : "Guardar Documento"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
