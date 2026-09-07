'use client';

import QRCode from 'qrcode';

// Date formatting matching session report style: "17 Aug, 12:46PM"
export const formatReceiptDate = (date: Date | string | number | undefined | null, timezone?: string): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  try {
    const tz = timezone || 'Asia/Riyadh';
    const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: tz });
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: tz });
    const timeParts = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz })
      .replace(/\u202f/g, ' ')
      .trim();
    const time = timeParts.replace(/\s+(AM|PM)/i, '$1');
    return `${day} ${month}, ${time}`;
  } catch {
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${mon}, ${h}:${min}${ampm}`;
  }
};

/**
 * Directly prints standard 80mm thermal receipt to native printer via isolated hidden iframe.
 * Eliminates preview dialog and prints directly.
 */
export async function printThermalReceipt(data: any, settings: any = {}) {
  if (!data) return;

  const { sale, items, invoice, qrData, cashierName, payments, tenderedAmount, changeAmount } = data || {};

  // 1. Generate ZATCA QR Code Data URL if qrData is present
  let qrUrl = '';
  if (qrData) {
    try {
      qrUrl = await QRCode.toDataURL(qrData, { width: 140, margin: 1 });
    } catch (e) {
      console.warn('Failed to generate ZATCA QR Code for receipt:', e);
    }
  }

  const shopName = settings.shop_name_en || settings.shop_name || settings.shop_name_ar || 'AL-NOOR SUPERMARKET';
  const shopAddress = settings.shop_address || '';
  const shopPhone = settings.shop_phone || '';
  const vatNumber = settings.shop_vat_number || '300123456700003';
  const invoiceNo = invoice?.invoice_no || sale?.reference_no || 'INV-0000';
  const invoiceDate = formatReceiptDate(sale?.created_at || new Date(), settings.timezone);
  const cashier = cashierName || 'Cashier';

  const grandTotal = Number(sale?.grand_total || 0);
  const subtotal = Number(sale?.subtotal || 0);
  const totalTax = Number(sale?.total_tax || 0);
  const totalDiscount = Number(sale?.total_discount || 0);
  const paidAmount = Number(sale?.paid_amount || 0);
  const dueAmount = Number(sale?.due_amount || 0);

  // Cash payment & change calculation
  const cashPayment = Array.isArray(payments) ? payments.find((p: any) => p.paymentMethodId === 1 || p.payment_method_id === 1) : null;
  const cardPayment = Array.isArray(payments) ? payments.find((p: any) => p.paymentMethodId === 2 || p.payment_method_id === 2) : null;

  // Customer Paid & Returnable / Change calculation
  const totalTendered = tenderedAmount !== undefined && tenderedAmount !== null
    ? Number(tenderedAmount)
    : (Array.isArray(payments) && payments.length > 0
        ? payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
        : paidAmount);

  const calculatedChange = changeAmount !== undefined && changeAmount !== null
    ? Number(changeAmount)
    : Math.max(0, Math.round((totalTendered - grandTotal) * 100) / 100);

  const printContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Invoice_${invoiceNo}</title>
    <style>
      @page {
        size: 80mm auto;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
        color: #000000;
        font-family: 'Courier New', Courier, monospace;
        font-size: 12px;
        line-height: 1.35;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt {
        width: 76mm;
        margin: 0 auto;
        padding: 4mm 2mm;
        box-sizing: border-box;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .bold { font-weight: 900; }
      .title { font-size: 15px; font-weight: 900; letter-spacing: -0.02em; }
      .divider { border-top: 1px dashed #000000; margin: 6px 0; }
      .double-divider { border-top: 1.5px solid #000000; border-bottom: 1.5px solid #000000; height: 2px; margin: 7px 0; }
      .row { display: flex; justify-content: space-between; align-items: baseline; margin: 2.5px 0; font-size: 12px; }
      .row-bold { display: flex; justify-content: space-between; align-items: baseline; margin: 3px 0; font-weight: 900; font-size: 13px; }
      .item-row { margin: 4px 0; }
      .item-name { font-weight: 900; font-size: 12px; word-break: break-word; }
      .item-calc { display: flex; justify-content: space-between; font-size: 11.5px; margin-top: 1px; }
      .qr-container { text-align: center; margin-top: 10px; margin-bottom: 4px; }
      .qr-image { width: 130px; height: 130px; margin: 0 auto; display: block; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="text-center">
        <div class="title">${shopName}</div>
        ${shopAddress ? `<div style="font-size: 10px; margin-top: 2px;">${shopAddress}</div>` : ''}
        ${shopPhone ? `<div style="font-size: 10px;">Tel: ${shopPhone}</div>` : ''}
        ${vatNumber ? `<div style="font-size: 10px; margin-top: 1px;">VAT: ${vatNumber}</div>` : ''}
      </div>

      <div class="divider"></div>
      <div class="row"><span>Invoice No:</span><span class="bold">${invoiceNo}</span></div>
      <div class="row"><span>Date & Time:</span><span>${invoiceDate}</span></div>
      <div class="row"><span>Cashier:</span><span class="bold">${cashier}</span></div>

      <div class="divider"></div>
      <div class="row bold" style="font-size: 11px; text-transform: uppercase;">
        <span>Item Description</span>
        <span>Total</span>
      </div>
      <div class="divider"></div>

      ${items?.map((item: any) => {
        const name = item.productName || item.name || 'Product';
        const qty = Number(item.quantity || 1);
        const price = Number(item.unitPrice || 0);
        const total = Number(item.subtotal || qty * price);
        return `
          <div class="item-row">
            <div class="item-name">${name}</div>
            <div class="item-calc">
              <span>${qty} x ${price.toFixed(2)} SAR</span>
              <span class="bold">${total.toFixed(2)} SAR</span>
            </div>
          </div>
        `;
      }).join('')}

      <div class="divider"></div>
      <div class="row"><span>Subtotal (Taxable Base):</span><span class="bold">${subtotal.toFixed(2)} SAR</span></div>
      ${totalDiscount > 0 ? `<div class="row"><span>Discount:</span><span class="bold">-${totalDiscount.toFixed(2)} SAR</span></div>` : ''}
      <div class="row"><span>VAT (15%):</span><span class="bold">${totalTax.toFixed(2)} SAR</span></div>

      <div class="double-divider"></div>
      <div class="row-bold"><span>TOTAL AMOUNT:</span><span class="bold">${grandTotal.toFixed(2)} SAR</span></div>
      <div class="double-divider"></div>

      <div class="row bold"><span>Customer Paid:</span><span class="bold">${totalTendered.toFixed(2)} SAR</span></div>
      ${cashPayment ? `<div class="row" style="font-size: 11px;"><span>- Cash Tendered:</span><span>${Number(cashPayment.amount || 0).toFixed(2)} SAR</span></div>` : ''}
      ${cardPayment ? `<div class="row" style="font-size: 11px;"><span>- Mada / Card:</span><span>${Number(cardPayment.amount || 0).toFixed(2)} SAR</span></div>` : ''}
      <div class="row-bold" style="font-size: 12.5px; margin-top: 3px; border-top: 1px dashed #000000; padding-top: 3px;"><span>Returnable / Change:</span><span class="bold">${calculatedChange.toFixed(2)} SAR</span></div>
      ${dueAmount > 0 ? `<div class="row bold" style="font-size: 11px; color: #b91c1c;"><span>Customer Due:</span><span>${dueAmount.toFixed(2)} SAR</span></div>` : ''}

      ${qrUrl ? `
        <div class="qr-container">
          <img src="${qrUrl}" alt="ZATCA QR" class="qr-image" />
          <div style="font-size: 9px; margin-top: 3px; color: #444;">Scan via ZATCA E-Invoice App</div>
        </div>
      ` : ''}

      <div class="divider"></div>
      <div class="text-center" style="font-size: 10px; color: #333; margin-top: 6px;">
        <div>${settings.receipt_footer || 'Thank you for shopping with us!'}</div>
        <div style="margin-top: 4px; font-weight: bold;">*** END OF INVOICE ***</div>
      </div>
    </div>
  </body>
</html>`;

  // Direct print via isolated hidden iframe
  let printFrame = document.getElementById('receipt-print-frame') as HTMLIFrameElement | null;
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'receipt-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }

  const doc = printFrame.contentWindow?.document || printFrame.contentDocument;
  if (doc) {
    doc.open();
    doc.write(printContent);
    doc.close();
    setTimeout(() => {
      printFrame?.contentWindow?.focus();
      printFrame?.contentWindow?.print();
    }, 200);
  }
}

// Default export returns null (preview modal removed)
export default function ReceiptModal({ data }: { data?: any; onClose?: () => void }) {
  return null;
}
