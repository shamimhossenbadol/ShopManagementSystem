'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useSettings } from '@/hooks/useSettings';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  data: any;
  onClose: () => void;
}

export default function ReceiptModal({ data, onClose }: ReceiptModalProps) {
  const { settings, formatCurrency } = useSettings();
  const [qrUrl, setQrUrl] = useState<string>('');

  const { sale, items, invoice, qrData } = data;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl overflow-hidden w-full max-w-md border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-bold">Sale Completed Successfully</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable 80mm Thermal Receipt Section */}
        <div className="overflow-y-auto p-6 flex justify-center bg-slate-100 dark:bg-slate-950">
          <div id="printable-receipt" className="w-[80mm] bg-white p-4 font-mono text-xs shadow-md border border-slate-200 text-slate-900">
            <div className="text-center mb-3">
              <h2 className="text-sm font-bold tracking-tight uppercase">{settings.shop_name_en || 'AL-NOOR SUPERMARKET & HYPERMARKET'}</h2>
              {settings.shop_name_ar && <p className="text-xs font-bold text-slate-700">{settings.shop_name_ar}</p>}
              <p className="text-[10px] text-slate-500">VAT: {settings.shop_vat_number || '300123456700003'} | CR: {settings.shop_cr_number || '1010123456'}</p>
              <p className="text-[10px] text-slate-500">{settings.shop_address || 'King Fahd Road, Riyadh, KSA'}</p>
              <p className="text-[10px] text-slate-500">Tel: {settings.shop_phone || '+966 11 456 7890'}</p>
              <p className="text-[10px] font-bold text-slate-600 mt-1">{settings.receipt_header || 'Simplified Tax Invoice'}</p>
            </div>

            <div className="border-t border-b border-dashed border-slate-400 py-1.5 text-[11px] mb-2">
              <div className="flex justify-between">
                <span>Invoice: {invoice?.invoice_no || sale?.reference_no}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Date: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full text-left mb-2 text-[11px]">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1 font-semibold">{item.productName || item.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-1 text-right font-bold">{Number(item.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-dashed border-slate-400 pt-2 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>Subtotal (Taxable):</span>
                <span>{formatCurrency(sale?.subtotal || 0)}</span>
              </div>
              {Number(sale?.total_discount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(sale?.total_discount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{settings.tax_label || 'VAT (15%)'}:</span>
                <span>{formatCurrency(sale?.total_tax || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm border-t border-slate-400 pt-1">
                <span>GRAND TOTAL:</span>
                <span>{formatCurrency(sale?.grand_total || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Paid Amount:</span>
                <span>{formatCurrency(sale?.paid_amount || 0)}</span>
              </div>
              {Number(sale?.due_amount) > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Due Balance:</span>
                  <span>{formatCurrency(sale?.due_amount || 0)}</span>
                </div>
              )}
            </div>

            {/* ZATCA QR Code */}
            {qrUrl && (
              <div className="mt-4 text-center">
                <img src={qrUrl} alt="ZATCA E-Invoice QR" className="mx-auto h-24 w-24" />
                <p className="text-[9px] text-slate-400 mt-1">ZATCA Compliant E-Invoice (Phase 1/2)</p>
              </div>
            )}

            <div className="text-center mt-3 text-[10px] text-slate-500 border-t border-dashed border-slate-300 pt-2">
              <p>{settings.receipt_footer || 'Thank you for shopping with us!'}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 border-t border-slate-100 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
          <button
            onClick={onClose}
            className="w-1/2 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            New Sale (Esc)
          </button>
          <button
            onClick={handlePrint}
            className="flex w-1/2 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
