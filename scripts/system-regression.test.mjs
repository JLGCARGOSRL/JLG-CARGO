import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the sidebar exposes only implemented modules', async () => {
  const source = await read('src/components/sidebar.tsx')
  assert.doesNotMatch(source, /href: "\/shipments"/)
  assert.doesNotMatch(source, /href: "\/tracking"/)
  assert.doesNotMatch(source, /href: "\/settings"/)
  assert.doesNotMatch(source, /href: "\/warehouse"/)
  assert.match(source, /href: "\/warehouse\/billing"/)
  assert.match(source, /href: "\/communications"/)
})

test('communications preserve server dates and audit manual evidence', async () => {
  const [page, service, migration] = await Promise.all([
    read('src/app/communications/page.tsx'),
    read('src/lib/services/communicationService.ts'),
    read('supabase/migrations/202608120016_communications_and_evidence.sql'),
  ])
  assert.match(page, /Fecha del servidor/)
  assert.match(page, /Fecha declarada/)
  assert.match(page, /fecha real de creación/i)
  assert.match(page, /type="date"/)
  assert.match(service, /record_manual_communication/)
  assert.match(migration, /Evidence dates and origin are immutable/)
  assert.match(migration, /Communication evidence cannot be deleted/)
  assert.match(migration, /communication_audit_logs/)
  assert.match(migration, /p_declared_at > now\(\)/)
})

test('manual communication records allow multiple entries without message ids', async () => {
  const migration = await read('supabase/migrations/202608120017_fix_communication_message_unique.sql')
  assert.match(migration, /drop constraint if exists communication_email_message_unique/i)
  assert.match(migration, /where message_id is not null/i)
})

test('administrators can bulk import authentic email files without duplicates', async () => {
  const [page, parser, migration] = await Promise.all([
    read('src/app/communications/page.tsx'),
    read('src/lib/email/rfc822.ts'),
    read('supabase/migrations/202608120018_bulk_email_import.sql'),
  ])
  assert.match(page, /Importar correos/)
  assert.match(parser, /Message-ID/)
  assert.match(parser, /SHA-256/)
  assert.match(parser, /máximo de 250/i)
  assert.match(migration, /jsonb_array_length\(p_records\) > 250/)
  assert.match(migration, /Administrator access required/)
  assert.match(migration, /on conflict do nothing/i)
})

test('password recovery only accepts a real recovery callback and explains failures', async () => {
  const [client, page] = await Promise.all([
    read('src/lib/supabase/client.ts'),
    read('src/app/account/recover/page.tsx'),
  ])

  assert.match(client, /initialAuthRedirectType/)
  assert.match(client, /initialAuthRedirectType === 'recovery'/)
  assert.match(page, /event === "PASSWORD_RECOVERY"/)
  assert.match(page, /arrivedFromRecoveryLink \|\| recoveryEventReceived/)
  assert.doesNotMatch(page, /if \(event === "PASSWORD_RECOVERY" \|\| session\)/)
  assert.match(page, /same_password/)
  assert.match(page, /session_not_found/)
})

test('production keeps using the original warehouse Supabase project during migration', async () => {
  const config = await read('next.config.ts')
  assert.match(config, /LEGACY_NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(config, /LEGACY_NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  assert.match(config, /NEXT_PUBLIC_SUPABASE_URL: legacySupabaseUrl/)
  assert.match(config, /NEXT_PUBLIC_SUPABASE_ANON_KEY: legacySupabaseAnonKey/)
})

test('legacy and duplicate dashboard routes remain compatible through redirects', async () => {
  const routes = await Promise.all([
    read('src/app/bol/page.tsx'),
    read('src/app/shipments/page.tsx'),
    read('src/app/tracking/page.tsx'),
    read('src/app/warehouse/page.tsx'),
  ])
  for (const source of routes) assert.match(source, /redirect\("\/dashboard"\)/)
})

test('manifest detail loads a manifest rather than a warehouse receipt', async () => {
  const source = await read('src/app/warehouse/manifests/[id]/page.tsx')
  assert.match(source, /getManifestById/)
  assert.match(source, /getManifestItems/)
  assert.doesNotMatch(source, /getWarehouseReceiptById/)
})

test('moving or inspecting cargo does not advance received cargo automatically', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/receipts/[id]/page.tsx'),
    read('src/app/warehouse/inventory/page.tsx'),
  ])
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /receipt\.status\s*===\s*["']received["']\s*\?\s*["']available["']/
    )
    assert.match(source, /defaultValue=\{receipt\.status\}/)
  }
})

test('the production migration revokes anonymous access and protects finance', async () => {
  const source = await read(
    'supabase/migrations/202607190010_security_cleanup_and_billing_view.sql'
  )
  assert.match(source, /revoke all privileges on all tables in schema public from anon/i)
  assert.match(source, /current_system_role\(\).*administrator/is)
  assert.match(source, /warehouse_dispatch_sensitive_changes/i)
  assert.match(source, /warehouse_billing_report/i)
  assert.match(source, /customer_documents add column if not exists notes/i)
})

test('billing supports selecting and printing multiple invoices together', async () => {
  const source = await read('src/app/warehouse/billing/page.tsx')
  assert.match(source, /selectedIds/)
  assert.match(source, /Seleccionar todas las facturas visibles/)
  assert.match(source, /Imprimir seleccionadas/)
  assert.match(source, /\/warehouse\/billing\/print\?ids=/)
})

test('service liquidation supports standard prices, minimum storage days and packages', async () => {
  const [catalog, picker, createPage, editPage, migration, settings] = await Promise.all([
    read('src/lib/serviceCatalog.ts'),
    read('src/components/serviceCatalogPicker.tsx'),
    read('src/app/warehouse/dispatch/[receiptId]/page.tsx'),
    read('src/app/warehouse/dispatch/report/[dispatchId]/edit/page.tsx'),
    read('supabase/migrations/202607210011_service_catalog_and_packages.sql'),
    read('src/app/settings/services/page.tsx'),
  ])

  assert.match(catalog, /standard_price:\s*1240/)
  assert.match(catalog, /standard_price:\s*720/)
  assert.match(catalog, /minimum_quantity:\s*7/)
  assert.match(catalog, /Math\.max\(base, service\.minimum_quantity, 1\)/)
  assert.match(picker, /Paquete de servicios/)
  assert.match(picker, /Servicio adicional/)
  assert.match(picker, /href="\/settings\/services"/)
  assert.match(picker, /Administrar catálogo/)
  assert.match(picker, /SERVICE_CATALOG_UPDATED_EVENT/)
  assert.match(picker, /addEventListener\('storage', refresh\)/)
  assert.match(picker, /Actualizar catálogo/)
  assert.match(picker, /Paquetes en otra moneda/)
  assert.match(picker, /Paquetes inactivos/)
  assert.match(picker, /packageCurrencyMismatch/)
  assert.match(picker, /Moneda diferente:/)
  assert.match(picker, /Cambia la moneda de la liquidación/)
  assert.match(createPage, /<ServiceCatalogPicker/)
  assert.match(editPage, /<ServiceCatalogPicker/)
  assert.match(migration, /warehouse_service_package_items/)
  assert.match(migration, /public\.current_system_role\(\) = 'administrator'/)
  assert.match(settings, /Servicios y paquetes/)
  assert.match(settings, /Catálogo local activo/)
  assert.doesNotMatch(settings, /disabled=\{saving \|\| catalog\?\.usingDefaults\}/)
  assert.match(
    await read('src/lib/services/serviceCatalogService.ts'),
    /localStorage\.setItem\(localCatalogKey/
  )
  assert.match(settings, /removeService/)
  assert.match(settings, /removePackage/)
  assert.match(settings, /Eliminar \$\{service\.name\}/)
  assert.match(settings, /Eliminar \$\{item\.name\}/)
  assert.doesNotMatch(settings, /window\.confirm/)
  assert.match(settings, /role="dialog"/)
  assert.match(settings, /Confirmar eliminación/)
  assert.match(settings, /Las liquidaciones existentes no cambiarán/)
  assert.match(
    await read('src/lib/services/serviceCatalogService.ts'),
    /export async function deleteServicePackage/
  )
})

test('group invoice printing keeps one dispatch report per printed page', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/billing/print/page.tsx'),
    read('src/components/dispatchReportPrint.tsx'),
  ])
  assert.match(sources[0], /getDispatchReports/)
  assert.match(sources[0], /group-print-page/)
  assert.match(sources[0], /page-break-after:\s*always/)
  assert.match(sources[1], /Comprobante de despacho/)
  assert.match(sources[1], /Factura \/ referencia/)
})

test('group invoice printing is not covered by the application navigation', async () => {
  const source = await read('src/components/appShell.tsx')
  assert.match(
    source,
    /pathname === ["']\/warehouse\/billing\/print["']\) return <>{children}<\/>/
  )
})

test('authenticated users can keep the public associate form open', async () => {
  const source = await read('src/components/appShell.tsx')
  assert.match(source, /const isLogin = pathname === LOGIN_ROUTE/)
  assert.match(source, /if \(user && isLogin\) router\.replace/)
  assert.doesNotMatch(source, /if \(user && isPublic\) router\.replace/)
})

test('login provides a complete password recovery flow', async () => {
  const [login, request, recover, shell] = await Promise.all([
    read('src/app/login/page.tsx'),
    read('src/app/forgot-password/page.tsx'),
    read('src/app/account/recover/page.tsx'),
    read('src/components/appShell.tsx'),
  ])

  assert.match(login, /href="\/forgot-password"/)
  assert.match(request, /resetPasswordForEmail/)
  assert.match(request, /\/account\/recover/)
  assert.match(request, /Si existe una cuenta asociada/)
  assert.match(recover, /PASSWORD_RECOVERY/)
  assert.match(recover, /updateUser\(\{ password \}\)/)
  assert.match(recover, /password_recovered/)
  assert.match(shell, /"\/forgot-password"/)
  assert.match(shell, /"\/account\/recover"/)
})

test('selected invoices can be downloaded as a real PDF file', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/billing/print/page.tsx'),
    read('src/lib/pdf/dispatchInvoicesPdf.ts'),
  ])
  assert.match(sources[0], /Descargar PDF/)
  assert.match(sources[0], /downloadDispatchInvoicesPdf/)
  assert.match(sources[1], /new jsPDF/)
  assert.match(sources[1], /\.save\(`facturas-jlg-\$\{day\}\.pdf`\)/)
})
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the sidebar exposes only implemented modules', async () => {
  const source = await read('src/components/sidebar.tsx')
  assert.doesNotMatch(source, /href: "\/shipments"/)
  assert.doesNotMatch(source, /href: "\/tracking"/)
  assert.doesNotMatch(source, /href: "\/settings"/)
  assert.doesNotMatch(source, /href: "\/warehouse"/)
  assert.match(source, /href: "\/warehouse\/billing"/)
  assert.match(source, /href: "\/communications"/)
})

test('communications preserve server dates and audit manual evidence', async () => {
  const [page, service, migration] = await Promise.all([
    read('src/app/communications/page.tsx'),
    read('src/lib/services/communicationService.ts'),
    read('supabase/migrations/202608120016_communications_and_evidence.sql'),
  ])
  assert.match(page, /Fecha del servidor/)
  assert.match(page, /Fecha declarada/)
  assert.match(page, /fecha real de creación/i)
  assert.match(page, /type="date"/)
  assert.match(service, /record_manual_communication/)
  assert.match(migration, /Evidence dates and origin are immutable/)
  assert.match(migration, /Communication evidence cannot be deleted/)
  assert.match(migration, /communication_audit_logs/)
  assert.match(migration, /p_declared_at > now\(\)/)
})

test('password recovery only accepts a real recovery callback and explains failures', async () => {
  const [client, page] = await Promise.all([
    read('src/lib/supabase/client.ts'),
    read('src/app/account/recover/page.tsx'),
  ])

  assert.match(client, /initialAuthRedirectType/)
  assert.match(client, /initialAuthRedirectType === 'recovery'/)
  assert.match(page, /event === "PASSWORD_RECOVERY"/)
  assert.match(page, /arrivedFromRecoveryLink \|\| recoveryEventReceived/)
  assert.doesNotMatch(page, /if \(event === "PASSWORD_RECOVERY" \|\| session\)/)
  assert.match(page, /same_password/)
  assert.match(page, /session_not_found/)
})

test('production keeps using the original warehouse Supabase project during migration', async () => {
  const config = await read('next.config.ts')
  assert.match(config, /LEGACY_NEXT_PUBLIC_SUPABASE_URL/)
  assert.match(config, /LEGACY_NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  assert.match(config, /NEXT_PUBLIC_SUPABASE_URL: legacySupabaseUrl/)
  assert.match(config, /NEXT_PUBLIC_SUPABASE_ANON_KEY: legacySupabaseAnonKey/)
})

test('legacy and duplicate dashboard routes remain compatible through redirects', async () => {
  const routes = await Promise.all([
    read('src/app/bol/page.tsx'),
    read('src/app/shipments/page.tsx'),
    read('src/app/tracking/page.tsx'),
    read('src/app/warehouse/page.tsx'),
  ])
  for (const source of routes) assert.match(source, /redirect\("\/dashboard"\)/)
})

test('manifest detail loads a manifest rather than a warehouse receipt', async () => {
  const source = await read('src/app/warehouse/manifests/[id]/page.tsx')
  assert.match(source, /getManifestById/)
  assert.match(source, /getManifestItems/)
  assert.doesNotMatch(source, /getWarehouseReceiptById/)
})

test('moving or inspecting cargo does not advance received cargo automatically', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/receipts/[id]/page.tsx'),
    read('src/app/warehouse/inventory/page.tsx'),
  ])
  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /receipt\.status\s*===\s*["']received["']\s*\?\s*["']available["']/
    )
    assert.match(source, /defaultValue=\{receipt\.status\}/)
  }
})

test('the production migration revokes anonymous access and protects finance', async () => {
  const source = await read(
    'supabase/migrations/202607190010_security_cleanup_and_billing_view.sql'
  )
  assert.match(source, /revoke all privileges on all tables in schema public from anon/i)
  assert.match(source, /current_system_role\(\).*administrator/is)
  assert.match(source, /warehouse_dispatch_sensitive_changes/i)
  assert.match(source, /warehouse_billing_report/i)
  assert.match(source, /customer_documents add column if not exists notes/i)
})

test('billing supports selecting and printing multiple invoices together', async () => {
  const source = await read('src/app/warehouse/billing/page.tsx')
  assert.match(source, /selectedIds/)
  assert.match(source, /Seleccionar todas las facturas visibles/)
  assert.match(source, /Imprimir seleccionadas/)
  assert.match(source, /\/warehouse\/billing\/print\?ids=/)
})

test('service liquidation supports standard prices, minimum storage days and packages', async () => {
  const [catalog, picker, createPage, editPage, migration, settings] = await Promise.all([
    read('src/lib/serviceCatalog.ts'),
    read('src/components/serviceCatalogPicker.tsx'),
    read('src/app/warehouse/dispatch/[receiptId]/page.tsx'),
    read('src/app/warehouse/dispatch/report/[dispatchId]/edit/page.tsx'),
    read('supabase/migrations/202607210011_service_catalog_and_packages.sql'),
    read('src/app/settings/services/page.tsx'),
  ])

  assert.match(catalog, /standard_price:\s*1240/)
  assert.match(catalog, /standard_price:\s*720/)
  assert.match(catalog, /minimum_quantity:\s*7/)
  assert.match(catalog, /Math\.max\(base, service\.minimum_quantity, 1\)/)
  assert.match(picker, /Paquete de servicios/)
  assert.match(picker, /Servicio adicional/)
  assert.match(picker, /href="\/settings\/services"/)
  assert.match(picker, /Administrar catálogo/)
  assert.match(picker, /SERVICE_CATALOG_UPDATED_EVENT/)
  assert.match(picker, /addEventListener\('storage', refresh\)/)
  assert.match(picker, /Actualizar catálogo/)
  assert.match(picker, /Paquetes en otra moneda/)
  assert.match(picker, /Paquetes inactivos/)
  assert.match(picker, /packageCurrencyMismatch/)
  assert.match(picker, /Moneda diferente:/)
  assert.match(picker, /Cambia la moneda de la liquidación/)
  assert.match(createPage, /<ServiceCatalogPicker/)
  assert.match(editPage, /<ServiceCatalogPicker/)
  assert.match(migration, /warehouse_service_package_items/)
  assert.match(migration, /public\.current_system_role\(\) = 'administrator'/)
  assert.match(settings, /Servicios y paquetes/)
  assert.match(settings, /Catálogo local activo/)
  assert.doesNotMatch(settings, /disabled=\{saving \|\| catalog\?\.usingDefaults\}/)
  assert.match(
    await read('src/lib/services/serviceCatalogService.ts'),
    /localStorage\.setItem\(localCatalogKey/
  )
  assert.match(settings, /removeService/)
  assert.match(settings, /removePackage/)
  assert.match(settings, /Eliminar \$\{service\.name\}/)
  assert.match(settings, /Eliminar \$\{item\.name\}/)
  assert.doesNotMatch(settings, /window\.confirm/)
  assert.match(settings, /role="dialog"/)
  assert.match(settings, /Confirmar eliminación/)
  assert.match(settings, /Las liquidaciones existentes no cambiarán/)
  assert.match(
    await read('src/lib/services/serviceCatalogService.ts'),
    /export async function deleteServicePackage/
  )
})

test('group invoice printing keeps one dispatch report per printed page', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/billing/print/page.tsx'),
    read('src/components/dispatchReportPrint.tsx'),
  ])
  assert.match(sources[0], /getDispatchReports/)
  assert.match(sources[0], /group-print-page/)
  assert.match(sources[0], /page-break-after:\s*always/)
  assert.match(sources[1], /Comprobante de despacho/)
  assert.match(sources[1], /Factura \/ referencia/)
})

test('group invoice printing is not covered by the application navigation', async () => {
  const source = await read('src/components/appShell.tsx')
  assert.match(
    source,
    /pathname === ["']\/warehouse\/billing\/print["']\) return <>{children}<\/>/
  )
})

test('authenticated users can keep the public associate form open', async () => {
  const source = await read('src/components/appShell.tsx')
  assert.match(source, /const isLogin = pathname === LOGIN_ROUTE/)
  assert.match(source, /if \(user && isLogin\) router\.replace/)
  assert.doesNotMatch(source, /if \(user && isPublic\) router\.replace/)
})

test('login provides a complete password recovery flow', async () => {
  const [login, request, recover, shell] = await Promise.all([
    read('src/app/login/page.tsx'),
    read('src/app/forgot-password/page.tsx'),
    read('src/app/account/recover/page.tsx'),
    read('src/components/appShell.tsx'),
  ])

  assert.match(login, /href="\/forgot-password"/)
  assert.match(request, /resetPasswordForEmail/)
  assert.match(request, /\/account\/recover/)
  assert.match(request, /Si existe una cuenta asociada/)
  assert.match(recover, /PASSWORD_RECOVERY/)
  assert.match(recover, /updateUser\(\{ password \}\)/)
  assert.match(recover, /password_recovered/)
  assert.match(shell, /"\/forgot-password"/)
  assert.match(shell, /"\/account\/recover"/)
})

test('selected invoices can be downloaded as a real PDF file', async () => {
  const sources = await Promise.all([
    read('src/app/warehouse/billing/print/page.tsx'),
    read('src/lib/pdf/dispatchInvoicesPdf.ts'),
  ])
  assert.match(sources[0], /Descargar PDF/)
  assert.match(sources[0], /downloadDispatchInvoicesPdf/)
  assert.match(sources[1], /new jsPDF/)
  assert.match(sources[1], /\.save\(`facturas-jlg-\$\{day\}\.pdf`\)/)
})
