import type { DispatchRecord } from '../../types/dispatch'

const DISPATCH_STATUS_LABELS: Record<DispatchRecord['dispatch_status'], string> = {
  confirmed: 'Confirmado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
const BILLING_STATUS_LABELS: Record<DispatchRecord['billing_status'], string> = {
  pending: 'Pendiente de liquidar',
  ready: 'Listo para facturar',
  invoiced: 'Facturado',
  paid: 'Pagado',
  cancelled: 'Cancelado',
}

const PAGE_WIDTH = 215.9
const PAGE_HEIGHT = 279.4
const MARGIN = 12
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const NAVY: [number, number, number] = [15, 23, 42]
const SLATE: [number, number, number] = [71, 85, 105]
const LIGHT: [number, number, number] = [248, 250, 252]

type PdfDocument = import('jspdf').jsPDF

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString('es-DO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatDate(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function text(doc: PdfDocument, value: string, x: number, y: number, options?: Parameters<PdfDocument['text']>[3]) {
  doc.text(value || '-', x, y, options)
}

function labelValue(
  doc: PdfDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number
) {
  doc.setTextColor(...SLATE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  text(doc, label.toUpperCase(), x, y)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const lines = doc.splitTextToSize(value || '-', width) as string[]
  doc.text(lines.slice(0, 2), x, y + 3.1)
}

function sectionBox(doc: PdfDocument, title: string, y: number, height: number) {
  doc.setFillColor(...LIGHT)
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.35)
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 3, 3, 'FD')
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  text(doc, title.toUpperCase(), MARGIN + 3, y + 5)
}

function drawHeader(doc: PdfDocument, dispatch: DispatchRecord, logoData?: string) {
  if (logoData) {
    try {
      doc.addImage(logoData, 'JPEG', MARGIN, 11, 28, 14)
    } catch {
      // The company name below keeps the PDF identifiable if the image cannot load.
    }
  }

  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.5)
  doc.line(43, 11, 43, 29)
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  text(doc, 'Comprobante de despacho', 47, 16)
  doc.setFontSize(7.5)
  doc.setTextColor(...SLATE)
  text(doc, 'Entrega individual por Bill of Lading', 47, 20.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  text(doc, 'ALMACEN JLG CARGO - AUTOPISTA DUARTE, KM 17 1/2 - RNC: 131784925', 47, 25.5)

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  text(doc, dispatch.dispatch_number, PAGE_WIDTH - MARGIN, 15, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  text(doc, formatDate(dispatch.dispatched_at), PAGE_WIDTH - MARGIN, 19.5, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  text(
    doc,
    `${DISPATCH_STATUS_LABELS[dispatch.dispatch_status]} | ${BILLING_STATUS_LABELS[dispatch.billing_status]}`,
    PAGE_WIDTH - MARGIN,
    24,
    { align: 'right' }
  )
  doc.setLineWidth(0.55)
  doc.line(MARGIN, 32, PAGE_WIDTH - MARGIN, 32)
}

function drawClientSection(doc: PdfDocument, dispatch: DispatchRecord) {
  const y = 36
  const col = (CONTENT_WIDTH - 12) / 4
  const x = (index: number) => MARGIN + 3 + index * (col + 2)
  sectionBox(doc, 'Cliente y BL', y, 52)

  labelValue(doc, 'Cliente', dispatch.customer_name, x(0), y + 11, col)
  labelValue(doc, 'Código', dispatch.customer_code || '-', x(1), y + 11, col)
  labelValue(doc, 'BL individual', dispatch.document_number, x(2), y + 11, col)
  labelValue(doc, 'WR', dispatch.wr_number, x(3), y + 11, col)

  labelValue(doc, 'Dirección del cliente', dispatch.customer_address || '-', x(0), y + 22, col * 2 + 2)
  labelValue(doc, 'Contenido de la carga', dispatch.cargo_description || '-', x(2), y + 22, col * 2 + 2)

  labelValue(doc, 'Fecha de llegada', formatDate(dispatch.arrival_date), x(0), y + 33, col)
  labelValue(doc, 'Fecha de recepción', formatDate(dispatch.received_at), x(1), y + 33, col)
  labelValue(doc, 'Fecha de despacho', formatDate(dispatch.dispatched_at), x(2), y + 33, col)
  labelValue(doc, 'Días de almacenaje', String(dispatch.storage_days), x(3), y + 33, col)

  labelValue(doc, 'IGRA aprobado', dispatch.igra_number || '-', x(0), y + 44, col)
  labelValue(doc, 'Estado IGRA', dispatch.igra_approved ? 'Aprobado' : 'No aprobado', x(1), y + 44, col)
  labelValue(doc, 'Monto liquidación', formatMoney(dispatch.liquidation_amount, dispatch.currency), x(2), y + 44, col)
  labelValue(doc, `Seguro (${formatNumber(dispatch.insurance_rate, 2)}%)`, formatMoney(dispatch.insurance_amount, dispatch.currency), x(3), y + 44, col)
}

function drawMetrics(doc: PdfDocument, dispatch: DispatchRecord) {
  const y = 92
  const width = CONTENT_WIDTH / 3
  const metrics = [
    ['Bultos entregados', formatNumber(dispatch.pieces_dispatched)],
    ['Peso entregado', `${formatNumber(dispatch.weight_dispatched_kg, 3)} KG`],
    ['Bultos restantes', formatNumber(dispatch.remaining_pieces)],
  ]
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.55)
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 18, 3, 3, 'S')
  metrics.forEach(([label, value], index) => {
    const center = MARGIN + width * index + width / 2
    if (index) doc.line(MARGIN + width * index, y, MARGIN + width * index, y + 18)
    doc.setTextColor(...SLATE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    text(doc, label.toUpperCase(), center, y + 5, { align: 'center' })
    doc.setTextColor(...NAVY)
    doc.setFontSize(12)
    text(doc, value, center, y + 13, { align: 'center' })
  })
}

function drawTransportSection(doc: PdfDocument, dispatch: DispatchRecord) {
  const y = 114
  const col = (CONTENT_WIDTH - 8) / 3
  const x = (index: number) => MARGIN + 3 + index * (col + 1)
  sectionBox(doc, 'Autorizado a retirar y transporte', y, 36)
  labelValue(doc, 'Autorizado a retirar', dispatch.recipient_name, x(0), y + 11, col)
  labelValue(doc, 'Identificación', dispatch.recipient_identification || '-', x(1), y + 11, col)
  labelValue(doc, 'Teléfono', dispatch.recipient_phone || '-', x(2), y + 11, col)
  labelValue(doc, 'Transportista', dispatch.carrier_name || '-', x(0), y + 22, col)
  labelValue(doc, 'Conductor', dispatch.driver_name || '-', x(1), y + 22, col)
  labelValue(doc, 'Placa', dispatch.vehicle_plate || '-', x(2), y + 22, col)
  labelValue(doc, 'Observaciones', dispatch.delivery_notes || '-', x(0), y + 31, CONTENT_WIDTH - 6)
}

function drawTotals(doc: PdfDocument, dispatch: DispatchRecord, startY: number) {
  const x = 145
  const right = PAGE_WIDTH - MARGIN
  let y = startY
  doc.setFontSize(7.5)
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...SLATE)
    text(doc, label, x, y)
    doc.setTextColor(...NAVY)
    text(doc, value, right, y, { align: 'right' })
    y += 4.3
  }
  row('Subtotal', formatMoney(dispatch.subtotal, dispatch.currency))
  row(`Impuesto (${formatNumber(dispatch.tax_rate, 2)}%)`, formatMoney(dispatch.tax_amount, dispatch.currency))
  row('Descuento', `-${formatMoney(dispatch.discount_amount, dispatch.currency)}`)
  doc.setLineWidth(0.45)
  doc.line(x, y - 1.5, right, y - 1.5)
  y += 2
  doc.setFontSize(11)
  row('Total', formatMoney(dispatch.total_amount, dispatch.currency), true)
  if (dispatch.invoice_reference) {
    doc.setFontSize(6.5)
    doc.setTextColor(...SLATE)
    text(doc, `Factura / referencia: ${dispatch.invoice_reference}`, right, y, { align: 'right' })
    y += 4
  }
  return y
}

function drawSignaturesAndFooter(doc: PdfDocument, dispatch: DispatchRecord, startY: number) {
  const signatureY = Math.max(startY + 10, 253)
  const width = 52
  const starts = [MARGIN, (PAGE_WIDTH - width) / 2, PAGE_WIDTH - MARGIN - width]
  const labels = ['Entregado por JLG', 'Conductor / transportista', 'Recibido conforme']
  starts.forEach((x, index) => {
    doc.setDrawColor(...NAVY)
    doc.setLineWidth(0.3)
    doc.line(x, signatureY, x + width, signatureY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.3)
    doc.setTextColor(...SLATE)
    text(doc, labels[index].toUpperCase(), x + width / 2, signatureY + 3, { align: 'center' })
  })
  doc.setDrawColor(203, 213, 225)
  doc.line(MARGIN, PAGE_HEIGHT - 9, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(...SLATE)
  text(
    doc,
    `Almacén JLG Cargo - Autopista Duarte, Km 17 1/2 - RNC: 131784925 - ${dispatch.dispatch_number}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 5,
    { align: 'center' }
  )
}

async function loadLogo() {
  try {
    const response = await fetch('/jlg-cargo-logo.jpg')
    if (!response.ok) return undefined
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

export async function buildDispatchInvoicesPdf(
  dispatches: DispatchRecord[],
  logoData?: string
) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' })

  dispatches.forEach((dispatch, index) => {
    if (index) doc.addPage('letter', 'portrait')
    drawHeader(doc, dispatch, logoData)
    drawClientSection(doc, dispatch)
    drawMetrics(doc, dispatch)
    drawTransportSection(doc, dispatch)

    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    text(doc, 'Liquidación de servicios', MARGIN, 157)
    doc.setFontSize(7)
    text(doc, `Moneda: ${dispatch.currency}`, PAGE_WIDTH - MARGIN, 157, { align: 'right' })

    autoTable(doc, {
      startY: 161,
      margin: { left: MARGIN, right: MARGIN, bottom: 48 },
      theme: 'grid',
      head: [['Concepto', 'Cantidad', 'Unidad', 'Tarifa', 'Base', 'ITBIS', 'Total']],
      body: dispatch.charges.length
        ? dispatch.charges.map((charge) => [
            charge.description,
            formatNumber(charge.quantity, 2),
            charge.unit,
            formatMoney(charge.unit_rate, dispatch.currency),
            formatMoney(charge.amount || 0, dispatch.currency),
            formatMoney((charge.amount || 0) * dispatch.tax_rate / 100, dispatch.currency),
            formatMoney((charge.amount || 0) * (1 + dispatch.tax_rate / 100), dispatch.currency),
          ])
        : [['Sin cargos registrados.', '', '', '', '', '', '']],
      styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 1.7, textColor: NAVY },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 46 },
        1: { halign: 'right', cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
    })

    const tableDoc = doc as typeof doc & { lastAutoTable?: { finalY: number } }
    let totalY = (tableDoc.lastAutoTable?.finalY || 190) + 5
    if (totalY > 232) {
      doc.addPage('letter', 'portrait')
      drawHeader(doc, dispatch, logoData)
      totalY = 45
    }
    const endY = drawTotals(doc, dispatch, totalY)
    drawSignaturesAndFooter(doc, dispatch, endY)
  })

  return doc
}

export async function downloadDispatchInvoicesPdf(dispatches: DispatchRecord[]) {
  if (!dispatches.length) return
  const logoData = await loadLogo()
  const doc = await buildDispatchInvoicesPdf(dispatches, logoData)
  const day = new Date().toISOString().slice(0, 10)
  doc.save(`facturas-jlg-${day}.pdf`)
}
