'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Printer, Barcode as BarcodeIcon } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { generateBarcodeVector } from '@/lib/barcodeGenerator';

export interface ProductItem {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  selling_price: number | string;
  current_stock?: number | string;
  tax_rate?: number;
  tax_type?: string;
  [key: string]: any;
}

export interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null;
  catalogProducts?: ProductItem[];
}

const LABEL_SIZES = [
  { id: '50x25', label: '50mm × 25mm (Standard Shelf / Sticker)', width: 50, height: 25 },
  { id: '40x30', label: '40mm × 30mm (Compact Price Tag)', width: 40, height: 30 },
  { id: '50x30', label: '50mm × 30mm (Retail Tag with Header)', width: 50, height: 30 },
  { id: '38x25', label: '38mm × 25mm (Small / Pharmacy Tag)', width: 38, height: 25 },
  { id: '60x40', label: '60mm × 40mm (Large / Carton Label)', width: 60, height: 40 },
];

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const { settings, formatCurrency } = useSettings();

  // 1. Label Size & Print Copies
  const [selectedSizeId, setSelectedSizeId] = useState<string>('50x25');
  const [copies, setCopies] = useState<number>(1);

  // Set default copies to current stock whenever product loads
  useEffect(() => {
    if (product) {
      const stock = Math.max(1, Math.round(Number(product.current_stock || 1)));
      setCopies(stock);
    }
  }, [product]);

  // 2. The 6 Main Options (2 Rows of 3)
  const [showTitle, setShowTitle] = useState<boolean>(true);
  const [showBarcodeNumber, setShowBarcodeNumber] = useState<boolean>(true); // 'Barcode' toggle controls digits below
  const [showShopName, setShowShopName] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showVatBadge, setShowVatBadge] = useState<boolean>(true);
  const [showSku, setShowSku] = useState<boolean>(true);

  // 3. Option Seekers (Sliders)
  const [titleFontSize, setTitleFontSize] = useState<number>(10); // 8px to 18px
  const [barcodeHeight, setBarcodeHeight] = useState<number>(30); // 16px to 70px
  const [barcodeWidth, setBarcodeWidth] = useState<number>(1.35); // 0.8 to 2.2 module width

  const [barcodeSvg, setBarcodeSvg] = useState<string>('');

  const currentSize = useMemo(() => {
    return LABEL_SIZES.find((s) => s.id === selectedSizeId) || LABEL_SIZES[0];
  }, [selectedSizeId]);

  const shopName =
    settings.shop_name_en || settings.shop_name_ar || 'AL-NOOR SUPERMARKET';

  const barcodeValue = product?.barcode || product?.sku || '00000000';

  // Generate crisp scannable barcode vector SVG
  useEffect(() => {
    if (!product) return;
    let isCurrent = true;

    generateBarcodeVector(barcodeValue, 'AUTO', {
      height: barcodeHeight,
      barWidth: barcodeWidth,
      showText: showBarcodeNumber,
      fontSize: 9,
    }).then((res) => {
      if (isCurrent) {
        setBarcodeSvg(res.svg);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [barcodeValue, barcodeHeight, barcodeWidth, showBarcodeNumber, product]);

  if (!isOpen || !product) return null;

  const priceFormatted = formatCurrency(product.selling_price);
  const isInclusive = product.tax_type === 'inclusive';
  const vatText = isInclusive ? 'Inc. VAT' : 'Ex. VAT';

  // Direct clean thermal print
  const handlePrint = () => {
    const { width, height } = currentSize;

    const singleLabelHtml = `
      <div class="label-page">
        <div class="label-card">
          ${showShopName ? `<div class="shop-name">${shopName}</div>` : ''}
          ${
            showTitle
              ? `<div class="product-name" style="font-size: ${titleFontSize}px;">${product.name}</div>`
              : ''
          }
          <div class="barcode-wrap" style="height: ${barcodeHeight}px;">
            ${barcodeSvg}
          </div>
          <div class="footer-row">
            ${showSku ? `<div class="sku-code">${product.sku}</div>` : '<div></div>'}
            ${
              showPrice
                ? `<div class="price-wrap">
                    <span class="price-val">${priceFormatted}</span>
                    ${showVatBadge ? `<span class="vat-badge">${vatText}</span>` : ''}
                  </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;

    const labelsList = Array(copies).fill(singleLabelHtml).join('');

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${product.name} - ${product.sku}</title>
  <style>
    @page {
      size: ${width}mm ${height}mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background: #fff;
      color: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .label-page {
      width: ${width}mm;
      height: ${height}mm;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
    }
    .label-card {
      width: 100%;
      height: 100%;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      background: #fff;
      color: #000;
    }
    .shop-name {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 0.5px solid #000;
      padding-bottom: 0.8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .product-name {
      font-weight: 700;
      line-height: 1.15;
      margin: 1px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .barcode-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 1px 0;
      overflow: hidden;
    }
    .barcode-wrap svg {
      max-width: 100%;
      height: ${barcodeHeight}px;
      width: auto;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 0.5px solid #000;
      padding-top: 1px;
      margin-top: 1px;
    }
    .sku-code {
      font-size: 8px;
      font-family: 'JetBrains Mono', monospace, sans-serif;
      font-weight: 700;
      line-height: 1;
    }
    .price-wrap {
      text-align: right;
      line-height: 1;
    }
    .price-val {
      font-size: 11px;
      font-weight: 900;
      font-family: 'JetBrains Mono', monospace, sans-serif;
    }
    .vat-badge {
      font-size: 6.5px;
      font-weight: normal;
      margin-left: 2px;
      color: #222;
    }
  </style>
</head>
<body>
  ${labelsList}
</body>
</html>
    `;

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
    if (!doc) return;

    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 250);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={<BarcodeIcon className="h-5 w-5" />}
      title="Thermal Barcode Label Generator"
      subtitle={
        product.name.length > 32
          ? `${product.name.slice(0, 30)}… (${product.sku})`
          : `${product.name} (${product.sku})`
      }
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end w-full gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            leftIcon={<Printer className="h-4 w-4" />}
            onClick={handlePrint}
          >
            Print {copies} Label{copies > 1 ? 's' : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Top Section: Label Size & Print Copies */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 dark:bg-slate-850 p-4 border border-slate-200 dark:border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Label Size
            </label>
            <select
              value={selectedSizeId}
              onChange={(e) => setSelectedSizeId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {LABEL_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Print Copies
            </label>
            <input
              type="number"
              min={1}
              max={500}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* 6 Options in 2 Rows */}
        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            {/* Row 1: Title, Barcode, Shop Name */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTitle}
                onChange={(e) => setShowTitle(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Title
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showBarcodeNumber}
                onChange={(e) => setShowBarcodeNumber(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Barcode
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showShopName}
                onChange={(e) => setShowShopName(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Shop Name
            </label>

            {/* Row 2: Selling Price, VAT Status, SKU */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Selling Price
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showVatBadge}
                onChange={(e) => setShowVatBadge(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              VAT Status
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSku}
                onChange={(e) => setShowSku(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              SKU
            </label>
          </div>
        </div>

        {/* Option Seekers (Sliders): Font Size, Barcode Height, Barcode Width */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-850 p-4 border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Seeker 1: Title Font Size */}
            <div className={!showTitle ? 'opacity-40 pointer-events-none' : ''}>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Title Font Size</span>
                <span className="font-mono text-blue-600 dark:text-sky-400 font-bold">{titleFontSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={18}
                step={1}
                value={titleFontSize}
                onChange={(e) => setTitleFontSize(parseInt(e.target.value) || 10)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Seeker 2: Barcode Height */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Barcode Height</span>
                <span className="font-mono text-blue-600 dark:text-sky-400 font-bold">{barcodeHeight}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={70}
                step={2}
                value={barcodeHeight}
                onChange={(e) => setBarcodeHeight(parseInt(e.target.value) || 30)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Seeker 3: Barcode Width */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Barcode Width</span>
                <span className="font-mono text-blue-600 dark:text-sky-400 font-bold">{barcodeWidth.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.8}
                max={2.2}
                step={0.05}
                value={barcodeWidth}
                onChange={(e) => setBarcodeWidth(parseFloat(e.target.value) || 1.35)}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Live Actual-Size Thermal Label Preview */}
        <div>
          <div className="flex justify-center p-6 rounded-2xl bg-slate-200 dark:bg-slate-950 border border-slate-300 dark:border-slate-800">
            <div
              id="printable-label"
              style={{
                width: `${currentSize.width}mm`,
                height: `${currentSize.height}mm`,
                padding: '1.5mm 2mm',
              }}
              className="bg-white text-black rounded-sm shadow-xl border border-slate-400 flex flex-col justify-between text-center select-none overflow-hidden box-border"
            >
              {/* Shop Header */}
              {showShopName && (
                <div className="text-[8px] font-black uppercase tracking-tight truncate w-full text-slate-900 border-b border-black pb-[0.8px] leading-tight">
                  {shopName}
                </div>
              )}

              {/* Product Title (Configurable font size) */}
              {showTitle && (
                <div
                  style={{ fontSize: `${titleFontSize}px` }}
                  className="font-bold text-black truncate w-full leading-tight my-[1px]"
                >
                  {product.name}
                </div>
              )}

              {/* Real Scannable Vector Barcode */}
              <div
                style={{ height: `${barcodeHeight}px` }}
                className="w-full flex items-center justify-center my-[1px] overflow-hidden"
              >
                <div
                  style={{ height: `${barcodeHeight}px` }}
                  className="w-full flex justify-center items-center"
                  dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                />
              </div>

              {/* Footer: SKU Code (without "SKU:" label) on Left, Price & VAT on Right */}
              <div className="flex items-end justify-between w-full border-t border-black pt-[1px] mt-[1px] text-black">
                {showSku ? (
                  <span className="text-[8px] font-mono font-bold text-black tracking-tight leading-none">
                    {product.sku}
                  </span>
                ) : (
                  <span></span>
                )}
                {showPrice && (
                  <span className="font-mono text-[11px] font-black leading-none text-right">
                    {priceFormatted}{' '}
                    {showVatBadge && (
                      <span className="text-[6.5px] font-normal text-slate-700">
                        {vatText}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
