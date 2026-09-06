'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useSettings } from '@/hooks/useSettings';
import { Printer, X, CheckCircle2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReceiptModalProps {
  data: any;
  onClose: () => void;
}

export default function ReceiptModal({ data, onClose }: ReceiptModalProps) {
  const { settings, formatCurrency, formatDateTime } = useSettings();
  const [qrUrl, setQrUrl] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const { sale, items, invoice, qrData } = data || {};

  useEffect(() => {
    if (qrData) {
      QRCode.toDataURL(qrData, { width: 140, margin: 1 }, (err, url) => {
        if (!err && url) setQrUrl(url);
      });
    }
  }, [qrData]);

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 80));
  const handleResetZoom = () => setZoomLevel(100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4 backdrop-blur-sm">
      <div className="flex max-h-[96vh] h-[92vh] flex-col rounded-3xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden w-full max-w-2xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Modal Header with Standard View / Zoom Controls */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 print:hidden gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold text-sm">Sale Completed & Locked</span>
            <span className="rounded-full bg-emerald-200/60 dark:bg-emerald-800/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Standard View Mode
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Zoom Controls */}
            <div className="flex items-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 shadow-sm">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 80}
                title="Zoom Out"
                className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom (100%)"
                className="px-1.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 160}
                title="Zoom In"
                className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset to Standard"
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1 text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Section with Standard Mode Full Height Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-100 dark:bg-slate-950 print:p-0 print:bg-white">
          <div
            style={{ zoom: `${zoomLevel}%` }}
            className="w-full flex justify-center transition-all duration-150"
          >
            <div
              id="printable-receipt"
              className="w-full max-w-[120mm] sm:max-w-[130mm] bg-white p-6 sm:p-7 font-mono text-sm shadow-lg border border-slate-300 text-slate-950 rounded-2xl leading-relaxed print:shadow-none print:border-0 print:rounded-none print:p-2 print:max-w-[95mm] print:text-xs"
            >
              <div className="text-center mb-4">
                <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase text-black">
                  {settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}
                </h2>
                {settings.shop_name_ar && (
                  <p className="text-sm sm:text-base font-bold text-slate-800">{settings.shop_name_ar}</p>
                )}
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  CR: {settings.shop_cr_number || '1010123456'} | VAT: {settings.shop_vat_number || '300123456700003'}
                </p>
                <p className="text-xs sm:text-sm text-slate-600">
                  {settings.shop_address || 'King Fahd Road, Riyadh, Saudi Arabia'}
                </p>
                <p className="text-xs sm:text-sm text-slate-600">Tel: {settings.shop_phone || '+966 11 456 7890'}</p>
                <div className="mt-2.5 inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-900 uppercase tracking-wide border border-slate-200">
                  {settings.receipt_header || 'Simplified Tax Invoice (فاتورة ضريبية مبسطة)'}
                </div>
              </div>

              <div className="border-t-2 border-b-2 border-dashed border-slate-400 py-2.5 text-xs sm:text-sm my-3 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Invoice No:</span>
                  <span className="text-slate-900">{invoice?.invoice_no || sale?.reference_no}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Date & Time:</span>
                  <span className="font-medium">
                    {formatDateTime(sale?.created_at || new Date())}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Cashier:</span>
                  <span className="font-bold text-slate-900">{data?.cashierName || 'Cashier'}</span>
                </div>
              </div>

              {/* Items Table with Enhanced Legibility */}
              <table className="w-full text-left mb-4 text-xs sm:text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 font-black uppercase text-xs text-slate-800">
                    <th className="py-2">Item</th>
                    <th className="py-2 text-center">Qty</th>
                    <th className="py-2 text-right">Price</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 font-bold text-slate-900">{item.productName || item.name}</td>
                      <td className="py-2 text-center font-mono font-medium">{item.quantity}</td>
                      <td className="py-2 text-right font-mono">{Number(item.unitPrice).toFixed(2)}</td>
                      <td className="py-2 text-right font-black font-mono text-slate-950">{Number(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t-2 border-dashed border-slate-400 pt-3 text-xs sm:text-sm space-y-2">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal (Taxable Base):</span>
                  <span className="font-mono font-semibold">{formatCurrency(sale?.subtotal || 0)}</span>
                </div>
                {Number(sale?.total_discount) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount:</span>
                    <span className="font-mono">-{formatCurrency(sale?.total_discount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>{settings.tax_label || 'VAT (15%)'}:</span>
                  <span className="font-mono font-semibold">{formatCurrency(sale?.total_tax || 0)}</span>
                </div>
                <div className="flex justify-between font-black text-base sm:text-lg border-t-2 border-slate-400 pt-2.5 text-black">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono">{formatCurrency(sale?.grand_total || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-semibold pt-1">
                  <span>Paid Amount:</span>
                  <span className="font-mono">{formatCurrency(sale?.paid_amount || 0)}</span>
                </div>
                {Number(sale?.due_amount) > 0 && (
                  <div className="flex justify-between text-rose-700 font-black">
                    <span>Customer Due:</span>
                    <span className="font-mono">{formatCurrency(sale?.due_amount || 0)}</span>
                  </div>
                )}
              </div>

              {/* ZATCA QR Code */}
              {qrUrl && (
                <div className="mt-5 text-center">
                  <img src={qrUrl} alt="ZATCA E-Invoice QR" className="mx-auto h-36 w-36 border border-slate-200 p-1.5 rounded-xl shadow-sm bg-white" />
                  <p className="text-[11px] text-slate-500 mt-2 font-sans font-medium">
                    Scan via ZATCA E-Invoice Verification App
                  </p>
                </div>
              )}

              <div className="text-center mt-5 text-xs text-slate-600 border-t border-dashed border-slate-300 pt-3">
                <p className="font-medium">{settings.receipt_footer || 'Thank you for shopping with us! Return within 7 days with invoice.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900 print:hidden">
          <Button variant="secondary" size="md" onClick={onClose} className="w-1/2">
            New Sale (Esc)
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handlePrint}
            leftIcon={<Printer className="h-4 w-4" />}
            className="w-1/2"
          >
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
