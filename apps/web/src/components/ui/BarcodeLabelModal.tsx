'use client';

import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Printer, Barcode as BarcodeIcon, Check } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

export interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: number;
    name: string;
    sku: string;
    barcode?: string;
    selling_price: number | string;
    tax_rate?: number;
    tax_type?: string;
  } | null;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const { settings, formatCurrency } = useSettings();
  const [labelSize, setLabelSize] = useState<'50x25' | '40x30'>('50x25');
  const [printCopies, setPrintCopies] = useState<number>(1);
  const [includeShopName, setIncludeShopName] = useState<boolean>(true);
  const [includePrice, setIncludePrice] = useState<boolean>(true);

  if (!product) return null;

  const barcodeValue = product.barcode || product.sku;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BarcodeIcon className="h-5 w-5 text-blue-600 dark:text-sky-400" />
          <span>Thermal Barcode Label Generator</span>
        </div>
      }
      subtitle={`Product: ${product.name} (SKU: ${product.sku})`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
            Print {printCopies} Label{printCopies > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Label Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-200 dark:border-slate-700">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Thermal Label Size
            </label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as any)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              <option value="50x25">50mm × 25mm (Standard Shelf / Sticker)</option>
              <option value="40x30">40mm × 30mm (Compact Product Label)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Print Copies
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={printCopies}
              onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeShopName}
                onChange={(e) => setIncludeShopName(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show Shop Name ({settings.shop_name_en || 'AL-NOOR SUPERMARKET'})
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includePrice}
                onChange={(e) => setIncludePrice(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Show Selling Price with VAT
            </label>
          </div>
        </div>

        {/* Live Label Thermal Preview */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Thermal Label Preview ({labelSize === '50x25' ? '50mm × 25mm' : '40mm × 30mm'})
          </div>

          <div className="flex justify-center p-6 rounded-2xl bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
            <div
              id="printable-label"
              className={`bg-white text-black p-2.5 rounded shadow-md border border-slate-300 flex flex-col justify-between items-center text-center font-sans ${
                labelSize === '50x25' ? 'w-[240px] h-[130px]' : 'w-[200px] h-[150px]'
              }`}
            >
              {includeShopName && (
                <div className="text-[10px] font-black tracking-tight uppercase truncate max-w-full text-slate-900 border-b border-black/20 pb-0.5 w-full">
                  {settings.shop_name_en || 'AL-NOOR SUPERMARKET'}
                </div>
              )}

              <div className="text-xs font-bold text-black truncate max-w-full leading-tight my-1">
                {product.name}
              </div>

              {/* Barcode Vector Graphic Simulation */}
              <div className="flex flex-col items-center my-0.5">
                <div className="font-mono text-lg font-black tracking-widest text-black flex items-center gap-0.5">
                  <span className="inline-block w-1.5 h-6 bg-black"></span>
                  <span className="inline-block w-0.5 h-6 bg-black"></span>
                  <span className="inline-block w-1 h-6 bg-black"></span>
                  <span className="inline-block w-2 h-6 bg-black"></span>
                  <span className="inline-block w-0.5 h-6 bg-black"></span>
                  <span className="inline-block w-1.5 h-6 bg-black"></span>
                  <span className="inline-block w-2 h-6 bg-black"></span>
                  <span className="inline-block w-1 h-6 bg-black"></span>
                  <span className="inline-block w-0.5 h-6 bg-black"></span>
                  <span className="inline-block w-2 h-6 bg-black"></span>
                  <span className="inline-block w-1 h-6 bg-black"></span>
                  <span className="inline-block w-1.5 h-6 bg-black"></span>
                </div>
                <span className="font-mono text-[9px] font-bold text-black tracking-wider">{barcodeValue}</span>
              </div>

              {includePrice && (
                <div className="flex items-center justify-between w-full border-t border-black/20 pt-0.5 text-black">
                  <span className="text-[9px] font-semibold text-slate-700">SKU: {product.sku}</span>
                  <span className="font-mono text-xs font-black">
                    {formatCurrency(product.selling_price)} <span className="text-[8px] font-normal">Inc VAT</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
