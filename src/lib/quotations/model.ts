export const OPERATIONS = { cross_docking: 'Cross-docking', deconsolidation: 'Desconsolidación de importación', export: 'Exportación' } as const;
export const PRESENTATIONS = { palletized: 'Paletizada', loose: 'Suelta', mixed: 'Mixta' } as const;
export const BASES = { container: 'Contenedor', hbl: 'HBL', boxes: 'Cajas / bultos', kg: 'Kg', m3: 'M³', pallets: 'Paletas', dispatches: 'Despachos', manual: 'Cantidad manual' } as const;
export type Operation = keyof typeof OPERATIONS;
export type Presentation = keyof typeof PRESENTATIONS;
export type Basis = keyof typeof BASES;
export type Cargo = { id: string; hbl: string; consignee: string; content: string; boxes: number; kg: number; m3: number; pallets: number };
export type Charge = { id: string; name: string; basis: Basis; quantity: number; included: number; minimum: number; cost: number | null; price: number | null; tax: number; notes: string; reference?: { supplier: 'MARDOM'; document: string; date: string; unit: string; price: number; provisional: true } };
export type QuoteDraft = {
  customer_id: string; operation: Operation; presentation: Presentation; currency: 'USD' | 'DOP'; valid_until: string;
  shipment: { container: string; size: string; master_bl: string; manifest: string; port: string; dispatches: number };
  cargo: Cargo[]; charges: Charge[]; conditions: string;
};
export type Quote = QuoteDraft & { id: string; number: number; created_at: string; updated_at: string };
export type Company = { id: string; company_name: string | null; tax_id: string | null };
const id = () => crypto.randomUUID();
export const newCargo = (): Cargo => ({ id: id(), hbl: '', consignee: '', content: '', boxes: 0, kg: 0, m3: 0, pallets: 0 });
export const newCharge = (name = '', basis: Basis = 'container'): Charge => ({ id: id(), name, basis, quantity: 1, included: 0, minimum: 0, cost: null, price: null, tax: 0, notes: '' });
export function structure(operation: Operation, presentation: Presentation): Charge[] {
  const handling = presentation === 'palletized' ? 'carga paletizada' : presentation === 'loose' ? 'carga suelta' : 'carga mixta';
  const names = operation === 'cross_docking'
    ? [`Recepción, manejo y transferencia de ${handling}`]
    : operation === 'deconsolidation'
      ? [`Recepción y descarga de ${handling}`, 'Separación e identificación por HBL']
      : [`Recepción de ${handling}`, 'Preparación, llenado y estiba del contenedor'];
  return [...names.map(name => newCharge(name)), newCharge('Despachos', 'dispatches')];
}
// Reference amounts from one invoice, not a provider tariff by volume or HBL.
export function provisionalStructure(operation: Operation, presentation: Presentation): Charge[] {
  const observed: [string, number, string][] = [
    ['Almacenaje seco', 994.89, 'M²'],
    ['Servicio de interconexión', 1489, 'BL'],
    ['Verificación', 1786.80, 'Unidad'],
    ['Emisión de tarja', 4467, 'Unidad'],
    ['Manejo logístico', 886.07, 'Unidad'],
    ['Seguro de mercancía', 35.68, 'Unidad'],
  ];
  const references = observed.map(([name, price, unit]): Charge => ({
    ...newCharge(name, 'manual'), price, tax: 18,
    notes: `Tarifa provisional MARDOM: ${price.toFixed(2)} DOP por ${unit}; cantidad de referencia 1. Revisar alcance y cantidad de esta operación.`,
    reference: { supplier: 'MARDOM', document: 'FAC547460', date: '2026-05-29', unit, price, provisional: true },
  }));
  // The supplied import invoice does not establish a complete cross-docking
  // or export rate. Keep the specialized services explicitly unpriced.
  return operation === 'deconsolidation' ? references : [...structure(operation, presentation), ...references];
}
export function cleanQuotationConditions(value: string): string {
  return value.replace('Tarifas provisionales basadas en la factura MARDOM FAC547460 del 29/05/2026, en DOP. Cantidades e importes sujetos al alcance de esta operación. El almacenaje no establece días libres ni una tarifa por M³/día. Servicios no detallados se cotizan por separado.', '').trim();
}
export function newDraft(): QuoteDraft {
  return { customer_id: '', operation: 'deconsolidation', presentation: 'loose', currency: 'DOP', valid_until: '', shipment: { container: '', size: '40HC', master_bl: '', manifest: '', port: '', dispatches: 1 }, cargo: [newCargo()], charges: provisionalStructure('deconsolidation', 'loose'), conditions: '' };
}
export function cargoTotals(cargo: Cargo[]) {
  return cargo.reduce((sum, item) => ({ boxes: sum.boxes + item.boxes, kg: sum.kg + item.kg, m3: sum.m3 + item.m3, pallets: sum.pallets + item.pallets }), { boxes: 0, kg: 0, m3: 0, pallets: 0 });
}
export function quantity(charge: Charge, draft: QuoteDraft): number {
  const totals = cargoTotals(draft.cargo);
  const raw = charge.basis === 'container' ? 1 : charge.basis === 'hbl' ? draft.cargo.filter(c => c.hbl.trim()).length : charge.basis === 'dispatches' ? draft.shipment.dispatches : charge.basis === 'manual' ? charge.quantity : totals[charge.basis];
  return Math.max(charge.minimum, raw - charge.included, 0);
}
export const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function totals(draft: QuoteDraft) {
  const result = draft.charges.reduce((sum, line) => {
    const q = quantity(line, draft);
    const sale = money(q * (line.price ?? 0));
    return { cost: sum.cost + money(q * (line.cost ?? 0)), subtotal: sum.subtotal + sale, tax: sum.tax + money(sale * line.tax / 100) };
  }, { cost: 0, subtotal: 0, tax: 0 });
  const cost = money(result.cost), subtotal = money(result.subtotal), tax = money(result.tax);
  return { cost, subtotal, tax, total: money(subtotal + tax), margin: subtotal ? (subtotal - cost) / subtotal * 100 : 0, pendingCost: draft.charges.some(c => c.cost === null), pendingPrice: draft.charges.some(c => c.price === null) };
}
export function validate(draft: QuoteDraft): string | null {
  if (!draft.customer_id) return 'Selecciona una empresa previamente registrada.';
  if (!(draft.operation in OPERATIONS) || !(draft.presentation in PRESENTATIONS)) return 'Operación o presentación inválida.';
  if (!['USD', 'DOP'].includes(draft.currency)) return 'Moneda inválida.';
  if (!Number.isInteger(draft.shipment.dispatches) || draft.shipment.dispatches < 0) return 'La cantidad de despachos debe ser un entero no negativo.';
  const hbls = draft.cargo.map(c => c.hbl.trim().toUpperCase()).filter(Boolean);
  if (new Set(hbls).size !== hbls.length) return 'Hay números de HBL duplicados.';
  for (const c of draft.cargo) {
    for (const key of ['boxes', 'kg', 'm3', 'pallets'] as const) if (!Number.isFinite(c[key]) || c[key] < 0) return 'Los datos de carga deben ser números no negativos.';
    if (!Number.isInteger(c.boxes) || !Number.isInteger(c.pallets)) return 'Cajas y paletas deben ser enteros.';
  }
  if (!draft.charges.length) return 'Agrega al menos un cargo.';
  for (const c of draft.charges) {
    if (!c.name.trim() || !(c.basis in BASES)) return 'Cada cargo necesita descripción y base válida.';
    for (const n of [c.quantity, c.included, c.minimum, c.tax, c.cost ?? 0, c.price ?? 0]) if (!Number.isFinite(n) || n < 0) return 'Los cargos deben contener números no negativos.';
    if (c.tax > 100) return 'El impuesto no puede superar 100%.';
  }
  return null;
}
