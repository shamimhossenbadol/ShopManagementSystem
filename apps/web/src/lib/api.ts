export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  [key: string]: any;
}

const API_BASE = '/api/v1';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || `HTTP Error ${res.status}` };
      }
    }

    if (!res.ok) {
      return {
        success: false,
        message: data.message || `Request failed with status ${res.status}`,
        errors: data.errors,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network connection error.',
    };
  }
}

export interface MoneyFormatSettings {
  currency_symbol?: string;
  currency_symbol_position?: 'before' | 'after';
  currency_decimals?: number | string;
  decimal_separator?: string;
  thousands_separator?: string;
}

/**
 * Universal Currency & Financial Formatter respecting dynamic Shop Settings
 */
export function formatMoney(
  num: number | string | undefined | null,
  settings?: MoneyFormatSettings
): string {
  const val = typeof num === 'string' ? parseFloat(num) : Number(num || 0);
  if (isNaN(val)) return 'SAR 0.00';

  const symbol = settings?.currency_symbol || 'SAR';
  const position = settings?.currency_symbol_position || 'after';
  const decimals = parseInt(String(settings?.currency_decimals || 2), 10);
  const decSep = settings?.decimal_separator || '.';
  const thouSep = settings?.thousands_separator || ',';

  // Format base number
  const parts = val.toFixed(decimals).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thouSep);
  const decPart = parts.length > 1 ? `${decSep}${parts[1]}` : '';
  const formattedNumber = `${intPart}${decPart}`;

  if (position === 'before') {
    return `${symbol} ${formattedNumber}`;
  }
  return `${formattedNumber} ${symbol}`;
}

export function formatSAR(num: number | string): string {
  return formatMoney(num, { currency_symbol: 'SAR', currency_symbol_position: 'after' });
}
