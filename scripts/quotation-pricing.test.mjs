import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/quotations/model.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { newDraft, newCharge, newCargo, totals, quantity, structure, tariffStructure, cleanQuotationCharges, cleanQuotationConditions, validate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const line = (name, basis, price, cost = 0) => ({ ...newCharge(name, basis), price, cost });
test('a whole-container cost is charged once regardless of the HBL count', () => {
  const draft = newDraft();
  draft.cargo = Array.from({ length: 10 }, (_, i) => ({ ...newCargo(), hbl: `HBL-${i}` }));
  draft.shipment.dispatches = 2;
  draft.charges = [line('Contenedor', 'container', 750, 600), line('Despachos', 'dispatches', 60, 40)];
  assert.equal(totals(draft).subtotal, 870);
  assert.equal(totals(draft).cost, 680);
});
test('HBL charges deduct included HBL and apply a billable minimum', () => {
  const draft = newDraft();
  draft.cargo = ['A', 'B', ''].map(hbl => ({ ...newCargo(), hbl }));
  const charge = { ...line('Clasificación adicional', 'hbl', 20), included: 1 };
  assert.equal(quantity(charge, draft), 1);
  assert.equal(quantity({ ...charge, included: 10 }, draft), 0);
  assert.equal(quantity({ ...charge, included: 10, minimum: 2 }, draft), 2);
});
test('pallets and loose pieces use independent quantities in mixed cargo', () => {
  const draft = newDraft(); draft.presentation = 'mixed';
  draft.cargo = [{ ...newCargo(), pallets: 8, boxes: 100, kg: 1500, m3: 12.5 }];
  draft.charges = [line('Paletas', 'pallets', 10), line('Bultos sueltos', 'boxes', 2)];
  assert.equal(totals(draft).subtotal, 280);
  assert.equal(quantity(line('Peso', 'kg', 1), draft), 1500);
  assert.equal(quantity(line('Volumen', 'm3', 1), draft), 12.5);
});
test('tax is rounded per line and margin excludes tax', () => {
  const draft = newDraft();
  draft.charges = [{ ...line('Manejo', 'container', 100, 70), tax: 18 }];
  assert.deepEqual(totals(draft), { cost: 70, subtotal: 100, tax: 18, total: 118, margin: 30, pendingCost: false, pendingPrice: false });
  draft.charges = [1, 2].map(n => ({ ...line(`Cargo ${n}`, 'container', 0.03), tax: 18 }));
  assert.equal(totals(draft).tax, 0.02);
});
test('an explicit zero rate differs from an unpriced service', () => {
  const draft = newDraft();
  draft.charges = [newCharge('Pendiente')];
  assert.equal(totals(draft).pendingPrice, true);
  draft.charges = [line('Incluido', 'container', 0)];
  assert.equal(totals(draft).pendingPrice, false);
});
test('operation and cargo presentation create distinct structures without borrowed rates', () => {
  const cross = structure('cross_docking', 'palletized');
  const imp = structure('deconsolidation', 'loose');
  const exp = structure('export', 'mixed');
  assert.match(cross[0].name, /transferencia.*paletizada/);
  assert.match(imp[1].name, /HBL/);
  assert.match(exp[1].name, /llenado/);
  assert.match(exp[0].name, /mixta/);
  for (const charge of [...cross, ...imp, ...exp]) assert.equal(charge.price, null);
});
test('validation rejects missing company, duplicate HBL, fractional pieces and invalid prices', () => {
  const draft = newDraft();
  assert.match(validate(draft), /empresa/);
  draft.customer_id = 'existing-company';
  assert.equal(validate(draft), null);
  draft.cargo = [' abc ', 'ABC'].map(hbl => ({ ...newCargo(), hbl }));
  assert.match(validate(draft), /duplicados/);
  draft.cargo = [{ ...newCargo(), boxes: 0.5 }];
  assert.match(validate(draft), /enteros/);
  draft.cargo = [];
  draft.charges = [line('Cargo', 'container', -1)];
  assert.match(validate(draft), /no negativos/);
  draft.charges[0].price = NaN;
  assert.match(validate(draft), /no negativos/);
});

test('new DOP quotations apply the approved 5 percent rate reduction with cent rounding', () => {
  const draft = newDraft();
  assert.deepEqual(draft.charges.map(c => c.price), [945.15, 1414.55, 1697.46, 4243.65, 841.77, 33.90]);
  assert.equal(draft.currency, 'DOP');
  assert.equal(totals(draft).subtotal, 9176.48);
  assert.equal(totals(draft).tax, 1651.77);
  assert.equal(totals(draft).total, 10828.25);
  assert.equal(totals(draft).pendingCost, true);
  assert.equal(draft.conditions, '');
  assert.ok(draft.charges.every(c => c.notes === '' && !('reference' in c)));
});
test('manual service quantities do not change with HBL count, volume or dispatch count', () => {
  const draft = newDraft();
  draft.cargo = Array.from({ length: 10 }, (_, i) => ({ ...newCargo(), hbl: `BL-${i}`, m3: 100 }));
  draft.shipment.dispatches = 20;
  assert.equal(totals(draft).subtotal, 9176.48);
});
test('specialized cross-docking and export services keep their own unpriced scope', () => {
  for (const operation of ['export', 'cross_docking']) {
    const draft = { ...newDraft(), operation, charges: tariffStructure(operation, 'mixed') };
    assert.equal(totals(draft).pendingPrice, true);
    assert.equal(draft.charges.filter(c => c.price !== null).length, 6);
  }
});
test('legacy supplier notes are removed without repricing saved quotations or erasing other conditions', () => {
  const original = { ...line('Manejo logístico', 'manual', 886.07), notes: 'Tarifa provisional MARDOM: 886.07 DOP por Unidad.', reference: { supplier: 'MARDOM', document: 'FAC547460' } };
  const [clean] = cleanQuotationCharges([original]);
  assert.equal(clean.price, 886.07);
  assert.equal(clean.notes, '');
  assert.ok(!('reference' in clean));
  assert.ok('reference' in original);
  assert.equal(cleanQuotationConditions('Pago al contado.\nTarifas MARDOM FAC547460.\nEntrega coordinada.'), 'Pago al contado.\nEntrega coordinada.');
});
