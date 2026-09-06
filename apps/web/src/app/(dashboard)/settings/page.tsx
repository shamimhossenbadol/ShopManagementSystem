'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { Button, IconButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { MetricCard } from '@/components/ui/MetricCard';
import {
  Store,
  Percent,
  Coins,
  Palette,
  Printer,
  ShieldCheck,
  Save,
  Plus,
  Edit2,
  CheckCircle,
  AlertCircle,
  Upload,
  Database,
  Sliders,
  Check,
  Scale,
  Sparkles,
  Monitor,
} from 'lucide-react';

export default function SettingsCustomizerPage() {
  const {
    settings,
    refreshSettings,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSizeScale,
    setFontSizeScale,
  } = useSettings();

  const [activeTab, setActiveTab] = useState<'shop' | 'tax' | 'currency' | 'theme' | 'hardware'>('shop');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  // Tax Rate Modal State
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [taxForm, setTaxForm] = useState({ id: null, name: '', rate: 15, is_active: true, is_default: false });

  useEffect(() => {
    setFormData(settings);
    loadTaxRates();
  }, [settings]);

  const loadTaxRates = async () => {
    const res = await apiRequest('/settings/tax-rates');
    if (res.success && res.data) {
      setTaxRates(res.data);
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const res = await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(formData),
    });

    setSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      await refreshSettings();
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setErrorMessage(res.message || 'Failed to save settings.');
    }
  };

  const handleSeedDemoData = async () => {
    if (
      !confirm(
        'This will populate your catalog with 37+ realistic supermarket items, suppliers, customers, perishable batches, and promotions. Proceed?'
      )
    ) {
      return;
    }
    setSeedingDemo(true);
    setSeedSuccessMessage(null);
    setErrorMessage(null);

    const res = await apiRequest('/settings/seed-demo', { method: 'POST' });
    setSeedingDemo(false);
    if (res.success) {
      setSeedSuccessMessage(res.message || 'Realistic supermarket dataset loaded successfully!');
      await refreshSettings();
      await loadTaxRates();
    } else {
      setErrorMessage(res.message || 'Failed to seed demo data.');
    }
  };

  const handleSaveTaxRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taxForm.id) {
      await apiRequest(`/settings/tax-rates/${taxForm.id}`, {
        method: 'PUT',
        body: JSON.stringify(taxForm),
      });
    } else {
      await apiRequest('/settings/tax-rates', {
        method: 'POST',
        body: JSON.stringify(taxForm),
      });
    }
    setIsTaxModalOpen(false);
    loadTaxRates();
    refreshSettings();
  };

  const colorPresets = [
    { name: 'Brand Blue', hex: '#2563eb' },
    { name: 'Emerald Green', hex: '#059669' },
    { name: 'Royal Indigo', hex: '#4f46e5' },
    { name: 'Purple Violet', hex: '#7c3aed' },
    { name: 'Amber Gold', hex: '#d97706' },
    { name: 'Slate Gray', hex: '#475569' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            System Customizer & Settings Matrix
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure store profile, ZATCA tax settings, active currency, day/night theme, and POS hardware peripherals.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={handleSeedDemoData}
            isLoading={seedingDemo}
            leftIcon={<Database className="h-4 w-4" />}
          >
            Load Realistic Demo Dataset
          </Button>

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              Settings saved!
            </div>
          )}

          {seedSuccessMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="h-4 w-4" />
              {seedSuccessMessage}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-4 text-xs font-bold text-rose-800 dark:text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
        {[
          { id: 'shop', label: '1. Store Identity & ZATCA', icon: Store },
          { id: 'tax', label: '2. Dynamic VAT & Tax Rates', icon: Percent },
          { id: 'currency', label: '3. Currency & Locale', icon: Coins },
          { id: 'theme', label: '4. Theme & Appearance', icon: Palette },
          { id: 'hardware', label: '5. POS & Hardware Peripherals', icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-blue-700 text-white shadow-sm dark:bg-sky-500 dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* TAB 1: SHOP PROFILE */}
        {activeTab === 'shop' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Store className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              Store Business Identity & ZATCA Receipt Customization
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Shop English Name *"
                required
                value={formData.shop_name_en || ''}
                onChange={(e) => handleInputChange('shop_name_en', e.target.value)}
                placeholder="e.g. AL-NOOR SUPERMARKET"
              />

              <Input
                label="Shop Arabic Subtitle (POS Receipt Header)"
                value={formData.shop_name_ar || ''}
                onChange={(e) => handleInputChange('shop_name_ar', e.target.value)}
                placeholder="سوبرماركت النور"
              />

              <Input
                label="Commercial Registration (CR) Number"
                value={formData.shop_cr_number || ''}
                onChange={(e) => handleInputChange('shop_cr_number', e.target.value)}
                placeholder="1010123456"
              />

              <Input
                label="Saudi VAT Registration Number (15 Digits) *"
                required
                value={formData.shop_vat_number || ''}
                onChange={(e) => handleInputChange('shop_vat_number', e.target.value)}
                placeholder="300123456700003"
                helperText="Used in ZATCA Phase-1 TLV QR Code generation"
              />

              <Input
                label="Store Contact Phone"
                value={formData.shop_phone || ''}
                onChange={(e) => handleInputChange('shop_phone', e.target.value)}
                placeholder="+966 11 123 4567"
              />

              <Input
                label="Store Email"
                type="email"
                value={formData.shop_email || ''}
                onChange={(e) => handleInputChange('shop_email', e.target.value)}
                placeholder="contact@alnoor-market.sa"
              />

              <Input
                label="Daily Shop Closing Hour (24h format: HH:MM) *"
                value={formData.shop_closing_hour || '00:00'}
                onChange={(e) => handleInputChange('shop_closing_hour', e.target.value)}
                placeholder="00:00"
                helperText="Default 00:00 (12:00 AM). Daily business day records, dashboard metrics, and cash drawer summaries cycle at this time."
              />
            </div>

            <Textarea
              label="Physical Store Address"
              value={formData.shop_address || ''}
              onChange={(e) => handleInputChange('shop_address', e.target.value)}
              placeholder="King Fahd Road, Al-Olaya, Riyadh, Kingdom of Saudi Arabia"
              rows={2}
            />

            <Textarea
              label="Thermal Receipt Footer Message"
              value={formData.receipt_footer_message || ''}
              onChange={(e) => handleInputChange('receipt_footer_message', e.target.value)}
              placeholder="Thank you for shopping at Al-Noor Supermarket! Returns accepted within 7 days with original receipt."
              rows={2}
            />
          </div>
        )}

        {/* TAB 2: TAX RATES */}
        {activeTab === 'tax' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Percent className="h-5 w-5 text-blue-700 dark:text-sky-400" />
                  Dynamic VAT Rates & Saudi Tax Authority Rules
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standard VAT (15%), Zero-Rated (0%), and Exempt products.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setTaxForm({ id: null, name: '', rate: 15, is_active: true, is_default: false });
                  setIsTaxModalOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Add Tax Rate
              </Button>
            </div>

            <DataTable
              data={taxRates}
              keyExtractor={(t: any) => t.id}
              columns={[
                {
                  header: 'Tax Rate Name',
                  accessor: (t: any) => (
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                      {t.is_default && (
                        <span className="text-[10px] text-blue-700 dark:text-sky-400 font-bold uppercase">
                          ● Default System Tax
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  header: 'Rate Percentage',
                  align: 'center',
                  accessor: (t: any) => (
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {t.rate}%
                    </span>
                  ),
                },
                {
                  header: 'Status',
                  align: 'center',
                  accessor: (t: any) => (
                    <Badge variant={t.is_active ? 'success' : 'neutral'}>
                      {t.is_active ? 'ACTIVE' : 'DISABLED'}
                    </Badge>
                  ),
                },
                {
                  header: 'Action',
                  align: 'right',
                  accessor: (t: any) => (
                    <IconButton
                      title="Edit Tax Rate"
                      icon={<Edit2 className="h-4 w-4" />}
                      size="sm"
                      onClick={() => {
                        setTaxForm(t);
                        setIsTaxModalOpen(true);
                      }}
                    />
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* TAB 3: CURRENCY & LOCALE */}
        {activeTab === 'currency' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Coins className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              Currency Representation & Timezone Locale
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Currency Code *"
                required
                value={formData.currency_code || 'SAR'}
                onChange={(e) => handleInputChange('currency_code', e.target.value)}
                placeholder="SAR"
              />

              <Input
                label="Currency Symbol Display *"
                required
                value={formData.currency_symbol || 'SAR'}
                onChange={(e) => handleInputChange('currency_symbol', e.target.value)}
                placeholder="SAR"
              />

              <Select
                label="Currency Symbol Position"
                value={formData.currency_position || 'after'}
                onChange={(e) => handleInputChange('currency_position', e.target.value)}
              >
                <option value="after">Suffix (e.g. 100.00 SAR)</option>
                <option value="before">Prefix (e.g. SAR 100.00)</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="System Timezone"
                value={formData.timezone || 'Asia/Riyadh'}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                placeholder="Asia/Riyadh"
                helperText="Arabia Standard Time (UTC+3)"
              />

              <Select
                label="Decimal Financial Precision"
                value={formData.decimal_places || 2}
                onChange={(e) => handleInputChange('decimal_places', parseInt(e.target.value))}
              >
                <option value={2}>2 Decimal Places (0.00 SAR)</option>
                <option value={3}>3 Decimal Places (0.000 SAR)</option>
                <option value={4}>4 Decimal Precision (WAC Internal)</option>
              </Select>
            </div>
          </div>
        )}

        {/* TAB 4: THEME & APPEARANCE */}
        {activeTab === 'theme' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Palette className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              Day / Night Theme & Display Typography Scaling
            </h2>

            {/* Dark / Light Mode Switcher */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                Display Mode (Theme)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-3 rounded-2xl border p-4 font-bold text-xs transition ${
                    theme === 'light'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-950/40 dark:text-sky-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Monitor className="h-5 w-5" />
                  <span>Day Mode (High-Contrast White)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-3 rounded-2xl border p-4 font-bold text-xs transition ${
                    theme === 'dark'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-700 dark:bg-blue-950/40 dark:text-sky-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Monitor className="h-5 w-5" />
                  <span>Night Mode (Dark Slate Supermarket POS)</span>
                </button>
              </div>
            </div>

            {/* Font Size Scaling */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                Typography Scale Factor (Touch Screen Optimization)
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFontSizeScale('100%')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    fontSizeScale === '100%' || fontSizeScale === '1.0'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-white">100% Standard Scale</div>
                  <div className="text-[11px] text-slate-400 mt-1">Recommended for 1080p desktop monitors</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFontSizeScale('110%')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    fontSizeScale === '110%' || fontSizeScale === '1.1'
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900 dark:text-white">110% Large POS Touch Scale</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Optimized for 15-inch cashier touch screens
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: POS HARDWARE PERIPHERALS */}
        {activeTab === 'hardware' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
              <Printer className="h-5 w-5 text-blue-700 dark:text-sky-400" />
              Thermal Receipt Printers, Cash Drawers & Produce Scales
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Thermal Receipt Paper Format"
                value={formData.receipt_printer_width || '80mm'}
                onChange={(e) => handleInputChange('receipt_printer_width', e.target.value)}
              >
                <option value="80mm">80mm Standard POS Thermal Roll (ESC/POS)</option>
                <option value="58mm">58mm Compact Receipt Roll</option>
              </Select>

              <Select
                label="Thermal Barcode Label Size"
                value={formData.barcode_label_format || '50x25'}
                onChange={(e) => handleInputChange('barcode_label_format', e.target.value)}
              >
                <option value="50x25">50mm × 25mm Standard Shelf Label</option>
                <option value="40x30">40mm × 30mm Compact Produce Label</option>
              </Select>

              <Input
                label="Produce Weight Barcode Prefix"
                value={formData.scale_barcode_prefix || '20,21,22,23,24,25,26,27,28,29'}
                onChange={(e) => handleInputChange('scale_barcode_prefix', e.target.value)}
                placeholder="20-29"
                helperText="Prefixes identifying embedded-weight price tags"
              />

              <Input
                label="Cash Drawer Kick-Out Pulse Code"
                value={formData.cash_drawer_kick_code || '<27><112><0><25><250>'}
                onChange={(e) => handleInputChange('cash_drawer_kick_code', e.target.value)}
                placeholder="ESC/POS Pulse Command"
              />
            </div>
          </div>
        )}

        {/* Global Save Button Bar */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={saving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save All Configuration Changes
          </Button>
        </div>
      </form>

      {/* Tax Rate Modal */}
      {isTaxModalOpen && (
        <Modal
          isOpen={isTaxModalOpen}
          onClose={() => setIsTaxModalOpen(false)}
          title={taxForm.id ? 'Edit Tax Rate' : 'Create Tax Rate'}
          subtitle="Configure VAT rate percentage and defaults"
          maxWidth="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsTaxModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveTaxRate}>
                Save Tax Rate
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveTaxRate} className="space-y-4">
            <Input
              label="Tax Rate Name *"
              required
              value={taxForm.name}
              onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
              placeholder="e.g. Standard VAT 15%"
            />

            <Input
              label="Rate Percentage (%) *"
              type="number"
              step="0.01"
              required
              value={taxForm.rate}
              onChange={(e) => setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) || 0 })}
            />

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxForm.is_default}
                  onChange={(e) => setTaxForm({ ...taxForm, is_default: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Set as Default Tax Rate for New Products</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={taxForm.is_active}
                  onChange={(e) => setTaxForm({ ...taxForm, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Tax Rate is Active</span>
              </label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
