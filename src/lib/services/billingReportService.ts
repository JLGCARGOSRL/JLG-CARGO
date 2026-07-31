import { supabase } from '../supabase/client'
import { getDispatchDashboard } from './dispatchService'
import type {
  DispatchBillingStatus,
  DispatchCurrency,
} from '../../types/dispatch'

type BillingStatusEvent = {
  dispatch_id: string
  metadata: { billing_status?: string } | null
  created_at: string
}

export type BillingReportRecord = {
  id: string
  dispatch_number: string
  billing_status: Extract<DispatchBillingStatus, 'invoiced' | 'paid'>
  currency: DispatchCurrency
  invoice_reference: string | null
  subtotal: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  wr_number: string
  manifest_number: string
  document_number: string
  customer_name: string
  customer_code: string | null
  invoiced_at: string | null
  paid_at: string | null
  billing_date: string
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRecord(row: Record<string, unknown>): BillingReportRecord {
  return {
    id: String(row.id),
    dispatch_number: String(row.dispatch_number || '-'),
    billing_status: row.billing_status as BillingReportRecord['billing_status'],
    currency: row.currency as DispatchCurrency,
    invoice_reference: row.invoice_reference ? String(row.invoice_reference) : null,
    subtotal: numberValue(row.subtotal),
    tax_amount: numberValue(row.tax_amount),
    discount_amount: numberValue(row.discount_amount),
    total_amount: numberValue(row.total_amount),
    wr_number: String(row.wr_number || '-'),
    manifest_number: String(row.manifest_number || '-'),
    document_number: String(row.document_number || '-'),
    customer_name: String(row.customer_name || 'Cliente sin nombre'),
    customer_code: row.customer_code ? String(row.customer_code) : null,
    invoiced_at: row.invoiced_at ? String(row.invoiced_at) : null,
    paid_at: row.paid_at ? String(row.paid_at) : null,
    billing_date: String(row.billing_date),
  }
}

async function getLegacyBillingReport(): Promise<BillingReportRecord[]> {
  const [dashboard, eventResult] = await Promise.all([
    getDispatchDashboard(),
    supabase
      .from('warehouse_dispatch_events')
      .select('dispatch_id, metadata, created_at')
      .eq('event_type', 'billing_status_changed')
      .order('created_at', { ascending: true }),
  ])

  if (eventResult.error) throw new Error(eventResult.error.message)

  const eventDates = new Map<
    string,
    { invoiced_at: string | null; paid_at: string | null }
  >()

  for (const event of (eventResult.data || []) as BillingStatusEvent[]) {
    const current = eventDates.get(event.dispatch_id) || {
      invoiced_at: null,
      paid_at: null,
    }

    if (event.metadata?.billing_status === 'invoiced') {
      current.invoiced_at ||= event.created_at
    }
    if (event.metadata?.billing_status === 'paid') {
      current.paid_at ||= event.created_at
    }
    eventDates.set(event.dispatch_id, current)
  }

  return dashboard.dispatches
    .filter(
      (dispatch) =>
        dispatch.dispatch_status !== 'cancelled' &&
        ['invoiced', 'paid'].includes(dispatch.billing_status)
    )
    .map((dispatch) => {
      const dates = eventDates.get(dispatch.id) || {
        invoiced_at: null,
        paid_at: null,
      }
      const billingDate =
        dates.invoiced_at ||
        dates.paid_at ||
        dispatch.updated_at ||
        dispatch.dispatched_at

      return normalizeRecord({
        ...dispatch,
        ...dates,
        billing_date: billingDate,
      })
    })
    .sort(
      (left, right) =>
        new Date(right.billing_date).getTime() -
        new Date(left.billing_date).getTime()
    )
}

export async function getBillingReport(): Promise<BillingReportRecord[]> {
  const { data, error } = await supabase
    .from('warehouse_billing_report')
    .select('*')
    .order('billing_date', { ascending: false })

  if (!error) {
    return ((data || []) as Record<string, unknown>[]).map(normalizeRecord)
  }

  // Keep the currently deployed database compatible until the new migration
  // is applied; afterward the focused view is used automatically.
  if (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.message.includes('warehouse_billing_report')
  ) {
    return getLegacyBillingReport()
  }

  throw new Error(error.message)
}
