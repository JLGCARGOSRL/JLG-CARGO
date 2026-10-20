import { supabase } from '../supabase/client';
import { cleanQuotationConditions, validate, type Company, type Quote, type QuoteDraft } from '../quotations/model';
function failure(error: { code?: string; message: string }) {
  if (['42P01', 'PGRST205'].includes(error.code || '')) return new Error('Cotizaciones requiere aplicar la migración 202610200020 en Supabase.');
  return new Error(error.message);
}
export async function getQuotationCompanies(): Promise<Company[]> {
  const companies: Company[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('customers').select('id,company_name,tax_id').order('company_name').order('id').range(offset, offset + 499);
    if (error) throw failure(error);
    companies.push(...(data || []));
    if (!data || data.length < 500) return companies;
  }
}
export async function getQuotations(): Promise<Quote[]> {
  const { data, error } = await supabase.from('warehouse_quotations').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw failure(error);
  return ((data || []) as Quote[]).map(quote => ({ ...quote, conditions: cleanQuotationConditions(quote.conditions) }));
}
export async function saveQuotation(draft: QuoteDraft, existing?: Quote): Promise<Quote> {
  const problem = validate(draft);
  if (problem) throw new Error(problem);
  // Explicit payload prevents audit fields from being overwritten by a loaded record.
  const payload: QuoteDraft = { customer_id: draft.customer_id, operation: draft.operation, presentation: draft.presentation, currency: draft.currency, valid_until: draft.valid_until || '', shipment: draft.shipment, cargo: draft.cargo, charges: draft.charges, conditions: cleanQuotationConditions(draft.conditions) };
  const query = existing
    ? supabase.from('warehouse_quotations').update(payload).eq('id', existing.id).eq('updated_at', existing.updated_at)
    : supabase.from('warehouse_quotations').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error?.code === 'PGRST116') throw new Error('La cotización cambió en otra sesión. Abre la versión actual antes de editarla.');
  if (error) throw failure(error);
  return data as Quote;
}
