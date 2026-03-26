const data = {
    currency: {
        CHF: { code: 'CHF', name: 'Schweizer Franken', symbol: 'Fr.', decimal_places: 2 },
        EUR: { code: 'EUR', name: 'Euro',              symbol: '€',   decimal_places: 2 },
        USD: { code: 'USD', name: 'US-Dollar',         symbol: '$',   decimal_places: 2 },
    },
    fiscal_year: {
        1: { id: 1, name: '2024', start_date: '2024-01-01', end_date: '2024-12-31', is_closed: false },
    },
    account: {
        1: { id: 1, number: '1000', name: 'Kasse',             type: 'asset',   currency: 'CHF', is_active: true },
        2: { id: 2, number: '1020', name: 'Bank UBS',          type: 'asset',   currency: 'CHF', is_active: true },
        3: { id: 3, number: '2000', name: 'Kreditoren',        type: 'liability', currency: 'CHF', is_active: true },
        4: { id: 4, number: '3000', name: 'Umsatzerlöse',      type: 'revenue', currency: 'CHF', is_active: true },
        5: { id: 5, number: '4000', name: 'Wareneinkauf',      type: 'expense', currency: 'CHF', is_active: true },
        6: { id: 6, number: '2200', name: 'MWST-Schuld',       type: 'liability', currency: 'CHF', is_active: true },
        7: { id: 7, number: '1100', name: 'Debitoren',         type: 'asset',   currency: 'CHF', is_active: true },
    },
    cost_center: {
        1: { id: 1, number: 'CC01', name: 'Vertrieb' },
        2: { id: 2, number: 'CC02', name: 'Verwaltung' },
    },
    tax_rate: {
        1: { id: 1, name: 'MWST 8.1%', rate: 8.1, account_id: 6, valid_from: '2024-01-01' },
        2: { id: 2, name: 'Steuerfrei', rate: 0,   account_id: 6, valid_from: '2024-01-01' },
    },
    contact: {
        1: { id: 1, type: 'customer', name: 'Muster AG',     is_company: true,  email: 'info@muster.ch', city: 'Zürich',   country: 'CH', currency: 'CHF', payment_days: 30, account_id: 7 },
        2: { id: 2, type: 'vendor',   name: 'Lieferant GmbH', is_company: true, email: 'info@lief.de',   city: 'Stuttgart', country: 'DE', currency: 'EUR', payment_days: 14, account_id: 3 },
    },
    journal: {
        1: { id: 1, name: 'Allgemein',  type: 'general',  fiscal_year_id: 1 },
        2: { id: 2, name: 'Verkauf',    type: 'sales',    fiscal_year_id: 1 },
        3: { id: 3, name: 'Bank',       type: 'bank',     fiscal_year_id: 1 },
    },
    entry: {
        1: { id: 1, date: '2024-03-01', reference: 'RE-2024-001', description: 'Rechnung Muster AG', journal_id: 2, contact_id: 1, currency: 'CHF', exchange_rate: 1, is_posted: true, source: 'invoice' },
        2: { id: 2, date: '2024-03-10', reference: 'ZAH-2024-001', description: 'Zahlung Muster AG', journal_id: 3, contact_id: 1, currency: 'CHF', exchange_rate: 1, is_posted: true, source: 'payment' },
    },
    entry_line: {
        1: { id: 1, entry_id: 1, account_id: 7, debit: 1081,  credit: 0,    tax_rate_id: 1, tax_amount: 81,  description: 'Debitoren' },
        2: { id: 2, entry_id: 1, account_id: 4, debit: 0,     credit: 1000, tax_rate_id: 1, tax_amount: 0,   description: 'Erlös' },
        3: { id: 3, entry_id: 1, account_id: 6, debit: 0,     credit: 81,   tax_rate_id: 1, tax_amount: 0,   description: 'MWST' },
        4: { id: 4, entry_id: 2, account_id: 2, debit: 1081,  credit: 0,    tax_rate_id: 2, tax_amount: 0,   description: 'Zahlungseingang' },
        5: { id: 5, entry_id: 2, account_id: 7, debit: 0,     credit: 1081, tax_rate_id: 2, tax_amount: 0,   description: 'Debitoren' },
    },
    product: {
        1: { id: 1, sku: 'P001', name: 'Webdesign Stunde', unit: 'h',   price: 150, account_id: 4, tax_rate_id: 1, is_active: true },
        2: { id: 2, sku: 'P002', name: 'Hosting Paket',    unit: 'Stk.', price: 240, account_id: 4, tax_rate_id: 1, is_active: true },
    },
    invoice: {
        1: { id: 1, type: 'outgoing', number: 'RE-2024-001', contact_id: 1, date: '2024-03-01', due_date: '2024-03-31', currency: 'CHF', status: 'paid', entry_id: 1, total_net: 1000, total_tax: 81, total_gross: 1081 },
    },
    invoice_line: {
        1: { id: 1, invoice_id: 1, product_id: 1, description: 'Webdesign März', quantity: 6, unit: 'h', unit_price: 150, discount_pct: 0, account_id: 4, tax_rate_id: 1, total_net: 900 },
        2: { id: 2, invoice_id: 1, product_id: 2, description: 'Hosting 2024',   quantity: 1, unit: 'Stk.', unit_price: 100, discount_pct: 0, account_id: 4, tax_rate_id: 1, total_net: 100 },
    },
    payment: {
        1: { id: 1, date: '2024-03-10', amount: 1081, currency: 'CHF', account_id: 2, contact_id: 1, reference: '000000000000001', entry_id: 2, method: 'bank' },
    },
    payment_invoice: {
        '1_1': { payment_id: 1, invoice_id: 1, amount: 1081 },
    },
    bank_statement_line: {
        1: { id: 1, account_id: 2, date: '2024-03-10', valuta: '2024-03-10', amount: 1081, balance: 15081, description: 'Überweisung Muster AG RE-2024-001', reference: '000000000000001', matched_entry_id: 2, is_reconciled: true },
    },
    user: {
        1: { id: 1, firstname: 'Tobias', lastname: 'Müller', email: 'tobias@example.ch', role: 'admin',      is_active: true },
        2: { id: 2, firstname: 'Anna',   lastname: 'Keller', email: 'anna@example.ch',   role: 'accountant', is_active: true },
    },
};

export default data;
