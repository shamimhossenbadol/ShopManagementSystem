'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
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
} from 'lucide-react';

export default function SettingsCustomizerPage() {
  const { settings, refreshSettings, theme, setTheme, accentColor, setAccentColor, fontSizeScale, setFontSizeScale } = useSettings();

  const [activeTab, setActiveTab] = useState<'shop' | 'tax' | 'currency' | 'theme' | 'hardware'>('shop');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedSuccessMessage, setSeedSuccessMessage] = useState<string | null>(null);

  const handleSeedDemoData = async () => {
    if (!confirm('This will load 37+ realistic supermarket products, 7 suppliers, 6 customers, batches with expiry, and promotions. Proceed?')) {
      return;
    }
    setSeedingDemo(true);
    setSeedSuccessMessage(null);
    setErrorMessage(null);

    const res = await apiRequest('/settings/seed-demo', { method: 'POST' });
    setSeedingDemo(false);
    if (res.success) {
      setSeedSuccessMessage(res.message || 'Demo data loaded successfully!');
      await refreshSettings();
      await loadTaxRates();
    } else {
      setErrorMessage(res.message || 'Failed to load demo data.');
    }
  };

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
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            System Customizer & Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure store profile, dynamic VAT rates, active currency, day/night themes, and POS hardware.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleSeedDemoData}
            disabled={seedingDemo}
            className="flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-50"
          >
            <Database className="h-4 w-4" />
            {seedingDemo ? 'Seeding Demo Dataset...' : 'Load Realistic Supermarket Demo Data'}
          </button>

          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully!
            </div>
          )}

          {seedSuccessMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <CheckCircle className="h-4 w-4" />
              {seedSuccessMessage}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'shop', label: '1. Shop Profile & Branding', icon: Store },
          { id: 'tax', label: '2. Dynamic VAT & Tax Rates', icon: Percent },
          { id: 'currency', label: '3. Currency & Locale', icon: Coins },
          { id: 'theme', label: '4. Theme & Appearance', icon: Palette },
          { id: 'hardware', label: '5. POS & Hardware Peripheral', icon: Printer },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* TAB 1: SHOP PROFILE */}
        {activeTab === 'shop' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Store className="h-4 w-4 text-blue-500" />
              Store Business Identity & Receipt Customization
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Shop English Name *</label>
                <input
                  type="text"
                  required
                  value={formData.shop_name_en || ''}
                  onChange={(e) => handleInputChange('shop_name_en', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. AL-NOOR SUPERMARKET & HYPERMARKET"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Shop Secondary Identifier (POS Sub-Header)</label>
                <input
                  type="text"
                  value={formData.shop_name_ar || ''}
                  onChange={(e) => handleInputChange('shop_name_ar', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-bold"
                  placeholder="AL-NOOR RETAIL POS"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Commercial Registration (CR) Number</label>
                <input
                  type="text"
                  value={formData.shop_cr_number || ''}
                  onChange={(e) => handleInputChange('shop_cr_number', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="1010123456"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Saudi VAT Registration Number (15 Digits) *</label>
                <input
                  type="text"
                  required
                  value={formData.shop_vat_number || ''}
                  onChange={(e) => handleInputChange('shop_vat_number', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="300123456700003"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Contact Telephone / Mobile</label>
                <input
                  type="text"
                  value={formData.shop_phone || ''}
                  onChange={(e) => handleInputChange('shop_phone', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="+966 11 456 7890"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Contact Email</label>
                <input
                  type="email"
                  value={formData.shop_email || ''}
                  onChange={(e) => handleInputChange('shop_email', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="info@alnoorshop.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Shop Physical Address</label>
                <input
                  type="text"
                  value={formData.shop_address || ''}
                  onChange={(e) => handleInputChange('shop_address', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="King Fahd Road, Al-Olaya, Riyadh, Saudi Arabia"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Receipt Top Header Greeting</label>
                <input
                  type="text"
                  value={formData.receipt_header || ''}
                  onChange={(e) => handleInputChange('receipt_header', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Welcome to Al-Noor Supermarket"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Receipt Bottom Return Policy & Footer Note</label>
                <textarea
                  rows={2}
                  value={formData.receipt_footer || ''}
                  onChange={(e) => handleInputChange('receipt_footer', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Thank you for shopping with us! Return within 7 days with invoice."
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DYNAMIC TAX RATES */}
        {activeTab === 'tax' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-500" />
                Dynamic VAT Rates & Calculation Mode
              </h2>
              <button
                type="button"
                onClick={() => {
                  setTaxForm({ id: null, name: '', rate: 15, is_active: true, is_default: false });
                  setIsTaxModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add New Tax Rate
              </button>
            </div>

            {/* Global Tax Calculation Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Default POS Pricing Mode</label>
                <select
                  value={formData.tax_calculation_mode || 'inclusive'}
                  onChange={(e) => handleInputChange('tax_calculation_mode', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="inclusive">Tax-Inclusive (Gross Retail Price includes 15% VAT)</option>
                  <option value="exclusive">Tax-Exclusive (VAT added on top of Base Price)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Tax Label on Receipts</label>
                <input
                  type="text"
                  value={formData.tax_label || 'VAT (15%)'}
                  onChange={(e) => handleInputChange('tax_label', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. VAT (15%) or Sales Tax (10%)"
                />
              </div>
            </div>

            {/* Tax Rates Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Tax Rate Name</th>
                    <th className="py-2.5 px-3">Rate %</th>
                    <th className="py-2.5 px-3">Default Rate</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {taxRates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{t.name}</td>
                      <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{Number(t.rate).toFixed(2)}%</td>
                      <td className="py-3 px-3">
                        {t.is_default ? (
                          <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                            Default
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${t.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                          {t.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setTaxForm(t);
                            setIsTaxModalOpen(true);
                          }}
                          className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CURRENCY & LOCALE */}
        {activeTab === 'currency' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Coins className="h-4 w-4 text-amber-500" />
              Currency, Number Formats & Regional Locale
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Currency ISO Code</label>
                <input
                  type="text"
                  value={formData.currency_code || 'SAR'}
                  onChange={(e) => handleInputChange('currency_code', e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="SAR, USD, BDT, EUR"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Currency Display Symbol</label>
                <input
                  type="text"
                  value={formData.currency_symbol || 'SAR'}
                  onChange={(e) => handleInputChange('currency_symbol', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-bold text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="SAR, $, EUR, BDT, AED, QAR"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Symbol Position</label>
                <select
                  value={formData.currency_symbol_position || 'after'}
                  onChange={(e) => handleInputChange('currency_symbol_position', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="after">After Amount (e.g. 100.00 SAR)</option>
                  <option value="before">Before Amount (e.g. SAR 100.00)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Customer Display Decimals</label>
                <select
                  value={formData.currency_decimals || '2'}
                  onChange={(e) => handleInputChange('currency_decimals', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="2">2 Decimals (0.00)</option>
                  <option value="3">3 Decimals (0.000)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Decimal Separator</label>
                <select
                  value={formData.decimal_separator || '.'}
                  onChange={(e) => handleInputChange('decimal_separator', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value=".">Dot (.)</option>
                  <option value=",">Comma (,)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Thousands Grouping Separator</label>
                <select
                  value={formData.thousands_separator || ','}
                  onChange={(e) => handleInputChange('thousands_separator', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value=",">Comma (,)</option>
                  <option value=".">Dot (.)</option>
                  <option value=" ">Space ( )</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">System Timezone</label>
                <input
                  type="text"
                  value={formData.timezone || 'Asia/Riyadh'}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Asia/Riyadh"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Display Date Format</label>
                <input
                  type="text"
                  value={formData.date_format || 'YYYY-MM-DD'}
                  onChange={(e) => handleInputChange('date_format', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="YYYY-MM-DD or DD/MM/YYYY"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: THEMES & APPEARANCE */}
        {activeTab === 'theme' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Palette className="h-4 w-4 text-purple-500" />
              Day / Night Theme & Brand Accent Colors
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block mb-2 font-bold text-slate-700 dark:text-slate-300">Day / Night Theme Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: '☀️ Light Mode' },
                    { id: 'dark', label: '🌙 Dark Mode' },
                    { id: 'system', label: '💻 Auto System Sync' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        handleInputChange('theme_mode_default', m.id);
                        if (m.id === 'light' || m.id === 'dark') setTheme(m.id as any);
                      }}
                      className={`p-3.5 rounded-xl border font-bold text-center transition ${
                        formData.theme_mode_default === m.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-2 font-bold text-slate-700 dark:text-slate-300">Brand Primary Accent Color</label>
                <div className="flex flex-wrap gap-3">
                  {colorPresets.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        handleInputChange('theme_accent_color', c.hex);
                        setAccentColor(c.hex);
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                        formData.theme_accent_color === c.hex
                          ? 'border-slate-900 dark:border-white shadow-md'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">
                  Global UI Text Size & Scale (Comfort Zoom)
                </label>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mb-2.5">
                  Dynamically scale the entire system font size and interface layout for comfortable long-shift operation (cashier & manager).
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {['90%', '100%', '110%', '120%', '130%'].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => {
                        handleInputChange('ui_font_scale', scale);
                        setFontSizeScale(scale);
                      }}
                      className={`py-3 px-2 rounded-xl border text-center font-bold transition ${
                        (formData.ui_font_scale || fontSizeScale) === scale
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-sm font-mono">{scale}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {scale === '90%' ? 'Compact' : scale === '100%' ? 'Standard' : scale === '110%' ? 'Comfort' : scale === '120%' ? 'Large' : 'Touch XL'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">POS Touch Target Density</label>
                <select
                  value={formData.pos_density_mode || 'comfortable'}
                  onChange={(e) => handleInputChange('pos_density_mode', e.target.value)}
                  className="w-full md:w-64 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="comfortable">Comfortable (Large Touch Screen Targets)</option>
                  <option value="compact">Compact (High Speed Mouse / Keyboard Grid)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: POS & HARDWARE */}
        {activeTab === 'hardware' && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Printer className="h-4 w-4 text-blue-500" />
              Scale Barcode, Thermal Printer & POS Hardware Controls
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Weighing Scale Barcode Prefixes</label>
                <input
                  type="text"
                  value={formData.scale_barcode_prefix || '20,21,28,29'}
                  onChange={(e) => handleInputChange('scale_barcode_prefix', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="20,21,28,29"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Quick Tender Cash Presets</label>
                <input
                  type="text"
                  value={formData.quick_tender_presets || '50,100,200,500'}
                  onChange={(e) => handleInputChange('quick_tender_presets', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none"
                  placeholder="50,100,200,500"
                />
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Auto Cash Drawer Kick Pulse</label>
                <select
                  value={formData.cash_drawer_auto_kick || 'true'}
                  onChange={(e) => handleInputChange('cash_drawer_auto_kick', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="true">Enabled (Kick RJ11 drawer on cash sale)</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Barcode Scan Sound Effect</label>
                <select
                  value={formData.barcode_audio_beep || 'true'}
                  onChange={(e) => handleInputChange('barcode_audio_beep', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="true">Enabled (Audio Beep on scan)</option>
                  <option value="false">Mute</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slate-700 dark:text-slate-300">Allow Negative Stock Selling</label>
                <select
                  value={formData.allow_negative_stock || 'false'}
                  onChange={(e) => handleInputChange('allow_negative_stock', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none font-semibold"
                >
                  <option value="false">Disallow (Block POS sale when stock is zero)</option>
                  <option value="true">Allow (Permit temporary negative stock)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Save Bar */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving Changes...' : 'Save System Settings'}
          </button>
        </div>
      </form>

      {/* Tax Rate Modal */}
      {isTaxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-white">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <Percent className="h-4 w-4 text-emerald-500" />
              {taxForm.id ? 'Edit Tax Rate' : 'New Tax Rate'}
            </h2>
            <form onSubmit={handleSaveTaxRate} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Tax Rate Name *</label>
                <input
                  type="text"
                  required
                  value={taxForm.name}
                  onChange={(e) => setTaxForm({ ...taxForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 focus:border-blue-500 focus:outline-none"
                  placeholder="e.g. Standard VAT 15%"
                />
              </div>
              <div>
                <label className="block mb-1 font-bold text-slate-700 dark:text-slate-300">Rate Percentage (%) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={taxForm.rate}
                  onChange={(e) => setTaxForm({ ...taxForm, rate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2.5 font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={taxForm.is_default}
                  onChange={(e) => setTaxForm({ ...taxForm, is_default: e.target.checked })}
                  className="h-4 w-4 rounded text-blue-600"
                />
                <label htmlFor="is_default" className="font-semibold text-slate-700 dark:text-slate-300">
                  Set as default tax rate for new products
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTaxModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-white"
                >
                  Save Tax Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
