/**
 * Direct Print Engine for Official Register & Period Z-Reports
 * Strictly optimized for 80mm POS Thermal Receipt Printers
 * Directly prints to native printer via invisible iframe without preview modal.
 */

export interface ZReportPrintPayload {
  isRange?: boolean;
  periodLabel?: string;
  sessionId: string;
  shiftSequence?: number | string;
  cashierName: string;
  cashierUsername?: string;
  cashierRole?: string;
  status?: string;
  openedAt?: string;
  closedAt?: string;
  duration?: string;
  totalShifts?: number;
  openingFloat: number;
  openingCardFloat?: number;
  grossSales: number;
  cashSales: number;
  cardSales: number;
  vatCollected: number;
  invoicesCount?: number;
  cashRefunds?: number;
  cashExpenses?: number;
  manualCashIns?: number;
  expectedCash: number;
  actualCash: number;
  cashVariance: number;
  expectedCard?: number;
  actualCard?: number;
  cardVariance?: number;
  forceClosedByName?: string | null;
}

export function printZReportDirectly(
  data: ZReportPrintPayload,
  settings: any,
  formatCurrencyFn?: (val: number) => string,
  formatDateTimeFn?: (val: any) => string
) {
  if (typeof window === 'undefined') return;

  // Guard: Shift Z-Report is strictly not applicable for active/open sessions
  if (!data.isRange && data.status !== 'closed') {
    alert('Shift Z-Report is only applicable for closed register sessions.');
    return;
  }

  const fmtCurrency = (val: number | undefined | null) => {
    const num = Number(val || 0);
    if (formatCurrencyFn) return formatCurrencyFn(num);
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
  };

  const fmtDateTime = (val: any) => {
    if (!val) return 'N/A';
    if (formatDateTimeFn) return formatDateTimeFn(val);
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
  };

  const netSales = Math.max(0, (data.grossSales || 0) - (data.vatCollected || 0));

  // Single clean shop name (avoid double name)
  const shopName = settings?.shop_name_en || settings?.shop_name_ar || 'AL-NOOR SUPERMARKET';
  const vatNumber = settings?.shop_vat_number || settings?.vat_number || '300123456700003';
  const crNumber = settings?.shop_cr_number || settings?.cr_number || '1010123456';
  const phone = settings?.shop_phone || settings?.phone || '+966 11 456 7890';
  const address = settings?.shop_address || settings?.address || 'Riyadh, Saudi Arabia';

  // Format clean Cashier name (e.g. "Shamim Hossen" without "(Manager)", "(@admin)", or usernames)
  const cleanCashierName = (data.cashierName || 'Cashier')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/@\w+/g, '')
    .trim();

  const cashPct = data.grossSales > 0 ? ((data.cashSales / data.grossSales) * 100).toFixed(1) : '0.0';
  const cardPct = data.grossSales > 0 ? ((data.cardSales / data.grossSales) * 100).toFixed(1) : '0.0';

  const cashVar = Number(data.cashVariance || 0);
  const isCashBalanced = Math.abs(cashVar) < 0.01;

  const cardVar = Number(data.cardVariance || 0);
  const isCardBalanced = Math.abs(cardVar) < 0.01;

  const totalOpening = (data.openingFloat || 0) + (data.openingCardFloat || 0);
  const totalExpected = (data.expectedCash || 0) + (data.expectedCard || 0);
  const totalCounted = (data.actualCash || 0) + (data.actualCard || 0);
  const totalVariance = cashVar + cardVar;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Z-Report - ${data.sessionId}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
      font-size: 11px;
      line-height: 1.35;
    }
    .thermal-receipt {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto;
      padding: 4mm 1.5mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .font-mono { font-family: "Courier New", Courier, monospace; }
    .uppercase { text-transform: uppercase; }

    .divider-double {
      border-top: 1.5px dashed #000;
      margin: 6px 0;
    }
    .divider-single {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .divider-solid {
      border-top: 1.5px solid #000;
      margin: 6px 0;
    }

    .shop-header {
      margin-bottom: 4px;
    }
    .shop-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.25;
    }
    .shop-meta {
      font-size: 9.5px;
      color: #111;
      margin-top: 2px;
      line-height: 1.3;
    }

    .report-title {
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.2px;
      line-height: 1.25;
      text-transform: uppercase;
    }

    .grid-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1.5px 0;
    }
    .grid-row.highlight {
      font-weight: 700;
    }
    .grid-row.bold-total {
      font-weight: 900;
      font-size: 11.5px;
      padding: 2.5px 0;
    }
    .section-header {
      font-weight: 900;
      font-size: 10px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 5px;
      margin-bottom: 2px;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
    }

    .signatures-block {
      margin-top: 12px;
      padding-top: 4px;
    }
    .sig-line {
      border-top: 1px solid #000;
      margin-top: 28px;
      margin-bottom: 3px;
    }
    .sig-row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }
    .sig-col {
      flex: 1;
      text-align: center;
    }
    .sig-title {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .footer-seal {
      margin-top: 10px;
      font-size: 8.5px;
      color: #222;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <div class="thermal-receipt">
    <!-- SINGLE SHOP HEADER (NO DUPLICATE) -->
    <div class="shop-header text-center">
      <div class="shop-title">${shopName}</div>
      <div class="shop-meta">
        ${address ? `<div>${address}</div>` : ''}
        <div>${phone ? `Tel: ${phone}` : ''} ${crNumber ? `| CR: ${crNumber}` : ''}</div>
        <div class="font-bold">VAT No: ${vatNumber}</div>
      </div>
    </div>

    <div class="divider-double"></div>

    <!-- DOCUMENT TITLE: ONLY DAILY REGISTER CLOSURE & CASH DRAWER AUDIT -->
    <div class="text-center" style="margin: 2px 0;">
      <div class="report-title">
        ${data.isRange ? 'CONSOLIDATED PERIOD CASH DRAWER AUDIT' : 'DAILY REGISTER CLOSURE & CASH DRAWER AUDIT'}
      </div>
    </div>

    <div class="divider-single"></div>

    <!-- METADATA -->
    ${data.isRange ? `
    <div class="grid-row">
      <span class="text-left">Audit Period:</span>
      <span class="text-right font-bold font-mono">${data.periodLabel || data.sessionId}</span>
    </div>
    <div class="grid-row">
      <span class="text-left">Audit Scope:</span>
      <span class="text-right font-bold">Consolidated Store Ledger</span>
    </div>
    <div class="grid-row">
      <span class="text-left">Closed Shifts:</span>
      <span class="text-right font-bold">${data.totalShifts || 0} Shifts</span>
    </div>
    ` : `
    <div class="grid-row">
      <span class="text-left">Audited Shift:</span>
      <span class="text-right font-bold font-mono">${data.shiftSequence ? `Shift #${data.shiftSequence}` : data.sessionId}</span>
    </div>
    <div class="grid-row">
      <span class="text-left">Cashier:</span>
      <span class="text-right font-bold">${cleanCashierName}</span>
    </div>
    <div class="grid-row">
      <span class="text-left">Shift Opened:</span>
      <span class="text-right font-mono">${fmtDateTime(data.openedAt)}</span>
    </div>
    <div class="grid-row">
      <span class="text-left">Shift Closed:</span>
      <span class="text-right font-mono font-bold">${fmtDateTime(data.closedAt)}</span>
    </div>
    ${data.duration ? `
    <div class="grid-row">
      <span class="text-left">Shift Duration:</span>
      <span class="text-right font-mono font-bold">${data.duration}</span>
    </div>` : ''}
    ${data.forceClosedByName ? `
    <div class="grid-row">
      <span class="text-left">Force Closed By:</span>
      <span class="text-right font-bold">${data.forceClosedByName}</span>
    </div>` : ''}
    `}
    <div class="grid-row">
      <span class="text-left">Print Date:</span>
      <span class="text-right font-mono">${new Date().toLocaleString()}</span>
    </div>

    <!-- 1. SALES & VAT SUMMARY -->
    <div class="section-header">
      <span>1. Sales & VAT Performance</span>
      <span>SAR</span>
    </div>

    <div class="grid-row bold-total">
      <span>GROSS SALES (VAT INCL.):</span>
      <span class="font-mono">${fmtCurrency(data.grossSales)}</span>
    </div>
    <div class="grid-row">
      <span>Net Taxable Sales:</span>
      <span class="font-mono">${fmtCurrency(netSales)}</span>
    </div>
    <div class="grid-row highlight">
      <span>VAT Collected (15.0% Standard):</span>
      <span class="font-mono">${fmtCurrency(data.vatCollected)}</span>
    </div>
    <div class="grid-row">
      <span>Total Invoices Generated:</span>
      <span class="font-bold">${data.invoicesCount || 0} Transactions</span>
    </div>

    <!-- 2. PAYMENT TENDER BREAKDOWN -->
    <div class="section-header">
      <span>2. Tender Breakdown</span>
      <span>SHARE</span>
    </div>

    <div class="grid-row highlight">
      <span>Direct Physical Cash:</span>
      <span class="font-mono">${fmtCurrency(data.cashSales)} <span style="font-size:9px">(${cashPct}%)</span></span>
    </div>
    <div class="grid-row highlight">
      <span>Electronic Card (Mada):</span>
      <span class="font-mono">${fmtCurrency(data.cardSales)} <span style="font-size:9px">(${cardPct}%)</span></span>
    </div>
    <div class="grid-row bold-total" style="border-top:1px dashed #000; margin-top:2px;">
      <span>Total Tender Received:</span>
      <span class="font-mono">${fmtCurrency(data.grossSales)}</span>
    </div>

    <!-- 3. CASH DRAWER RECONCILIATION -->
    <div class="section-header">
      <span>3. Cash Drawer Reconciliation</span>
      <span>AUDIT</span>
    </div>

    <div class="grid-row">
      <span>(+) Opening Cash Float:</span>
      <span class="font-mono font-bold">${fmtCurrency(data.openingFloat)}</span>
    </div>
    <div class="grid-row">
      <span>(+) Direct Cash Sales:</span>
      <span class="font-mono">${fmtCurrency(data.cashSales)}</span>
    </div>
    ${Number(data.manualCashIns || 0) > 0 ? `
    <div class="grid-row">
      <span>(+) Cash In / Float Additions:</span>
      <span class="font-mono">+${fmtCurrency(data.manualCashIns)}</span>
    </div>` : ''}
    ${Number(data.cashRefunds || 0) > 0 ? `
    <div class="grid-row">
      <span>(-) Cash Customer Refunds:</span>
      <span class="font-mono">-${fmtCurrency(data.cashRefunds)}</span>
    </div>` : ''}
    ${Number(data.cashExpenses || 0) > 0 ? `
    <div class="grid-row">
      <span>(-) Cash Expenses Paid Out:</span>
      <span class="font-mono">-${fmtCurrency(data.cashExpenses)}</span>
    </div>` : ''}

    <div class="grid-row highlight" style="border-top:1px dashed #000; margin-top:2px; padding-top:2px;">
      <span>(=) Expected Cash In Drawer:</span>
      <span class="font-mono font-black">${fmtCurrency(data.expectedCash)}</span>
    </div>
    <div class="grid-row highlight">
      <span>Actual Counted Cash:</span>
      <span class="font-mono font-black">${fmtCurrency(data.actualCash)}</span>
    </div>
    <div class="grid-row bold-total" style="border-top:1px solid #000; margin-top:2px; padding-top:2px;">
      <span>Cash Drawer Variance:</span>
      <span class="font-mono">
        ${isCashBalanced ? '0.00 SAR' : (cashVar > 0 ? `+${fmtCurrency(cashVar)}` : fmtCurrency(cashVar))}
      </span>
    </div>

    <!-- 4. CARD TERMINAL SETTLEMENT -->
    <div class="section-header">
      <span>4. Electronic Card Terminal</span>
      <span>SETTLEMENT</span>
    </div>

    ${Number(data.openingCardFloat || 0) > 0 ? `
    <div class="grid-row">
      <span>(+) Opening Card Float:</span>
      <span class="font-mono">${fmtCurrency(data.openingCardFloat)}</span>
    </div>` : ''}
    <div class="grid-row">
      <span>(+) Terminal Card Sales:</span>
      <span class="font-mono font-bold">${fmtCurrency(data.cardSales)}</span>
    </div>
    <div class="grid-row highlight">
      <span>(=) Expected Terminal Total:</span>
      <span class="font-mono font-black">${fmtCurrency(data.expectedCard ?? data.cardSales)}</span>
    </div>
    <div class="grid-row highlight">
      <span>Actual Settled Terminal:</span>
      <span class="font-mono font-black">${fmtCurrency(data.actualCard ?? data.cardSales)}</span>
    </div>
    <div class="grid-row bold-total" style="border-top:1px solid #000; margin-top:2px; padding-top:2px;">
      <span>Card Terminal Variance:</span>
      <span class="font-mono">
        ${isCardBalanced ? '0.00 SAR' : (cardVar > 0 ? `+${fmtCurrency(cardVar)}` : fmtCurrency(cardVar))}
      </span>
    </div>

    <!-- 5. COMBINED SHIFT TOTALS -->
    <div class="divider-solid"></div>
    <div class="section-header" style="border:none; margin:0; padding:0;">
      <span>5. Total Shift Audit Settlement</span>
      <span>TOTAL</span>
    </div>
    <div class="grid-row">
      <span>Total Opening Floats:</span>
      <span class="font-mono">${fmtCurrency(totalOpening)}</span>
    </div>
    <div class="grid-row highlight">
      <span>Total Shift Expected:</span>
      <span class="font-mono font-bold">${fmtCurrency(totalExpected)}</span>
    </div>
    <div class="grid-row highlight">
      <span>Total Shift Counted & Settled:</span>
      <span class="font-mono font-bold">${fmtCurrency(totalCounted)}</span>
    </div>
    <div class="grid-row bold-total" style="font-size:10.5px; border-top:1px solid #000; margin-top:2px;">
      <span>NET SHIFT VARIANCE:</span>
      <span class="font-mono">
        ${Math.abs(totalVariance) < 0.01 ? '0.00 SAR' : (totalVariance > 0 ? `+${fmtCurrency(totalVariance)}` : fmtCurrency(totalVariance))}
      </span>
    </div>

    <div class="divider-double"></div>

    <!-- SIGNATURE LINES -->
    <div class="signatures-block">
      ${data.isRange ? `
      <div style="max-width: 170px; margin: 0 auto; text-align: center;">
        <div class="sig-line"></div>
        <div class="sig-title">Manager Verification</div>
      </div>
      ` : `
      <div class="sig-row">
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Cashier Signature</div>
        </div>
        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-title">Manager Verification</div>
        </div>
      </div>
      `}
    </div>

    <!-- FOOTER SEAL -->
    <div class="footer-seal text-center">
      <div class="font-bold uppercase" style="letter-spacing:0.5px; margin-top:6px;">
        *** AUDIT VERIFIED • ${data.isRange ? 'PERIOD SETTLED' : 'REGISTER SETTLED'} ***
      </div>
      <div>Point of Sale Financial Audit Ledger</div>
    </div>
  </div>
</body>
</html>
  `;

  // Create an invisible iframe for direct, seamless native printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Give the browser iframe a brief moment to finish layout and font rendering, then trigger native print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Direct print failed, falling back to window.print', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }
  }, 250);
}
