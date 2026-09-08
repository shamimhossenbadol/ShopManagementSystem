'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export interface ModernDateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatSingleDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthName = MONTH_NAMES[m - 1] || '';
  return `${monthName} ${getOrdinal(d)}, ${y}`;
}

function formatTriggerDisplay(startStr: string, endStr: string): string {
  if (!startStr) return 'Select date';
  if (!endStr || startStr === endStr) {
    return formatSingleDate(startStr);
  }
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);

  const month1 = MONTH_NAMES[m1 - 1] || '';
  const month2 = MONTH_NAMES[m2 - 1] || '';

  if (y1 === y2) {
    if (m1 === m2) {
      return `${month1} ${getOrdinal(d1)} - ${getOrdinal(d2)}, ${y1}`;
    }
    return `${month1} ${getOrdinal(d1)} - ${month2} ${getOrdinal(d2)}, ${y1}`;
  }
  return `${month1} ${getOrdinal(d1)}, ${y1} - ${month2} ${getOrdinal(d2)}, ${y2}`;
}

function toISOString(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface CalendarDay {
  year: number;
  month: number;
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  colIndex: number; // 0 (Su) to 6 (Sa)
  isFirstDayOfMonth: boolean;
  isLastDayOfMonth: boolean;
}

function buildCalendarMonth(year: number, month: number): CalendarDay[] {
  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInCurrentMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const days: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const colIndex = (firstDayOfWeek - 1 - i) % 7;
    days.push({
      year: prevYear,
      month: prevMonth,
      day: d,
      dateStr: toISOString(prevYear, prevMonth, d),
      isCurrentMonth: false,
      colIndex,
      isFirstDayOfMonth: false,
      isLastDayOfMonth: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const colIndex = (firstDayOfWeek + d - 1) % 7;
    days.push({
      year,
      month,
      day: d,
      dateStr: toISOString(year, month, d),
      isCurrentMonth: true,
      colIndex,
      isFirstDayOfMonth: d === 1,
      isLastDayOfMonth: d === daysInCurrentMonth,
    });
  }

  // Next month leading days to complete 6 full rows (42 cells)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const colIndex = (days.length) % 7;
    days.push({
      year: nextYear,
      month: nextMonth,
      day: d,
      dateStr: toISOString(nextYear, nextMonth, d),
      isCurrentMonth: false,
      colIndex,
      isFirstDayOfMonth: false,
      isLastDayOfMonth: false,
    });
  }

  return days;
}

export const ModernDateRangePicker: React.FC<ModernDateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Staged selection state
  const [selectingStart, setSelectingStart] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Month navigation: Year and Month of Left Calendar
  const initialYearMonth = useMemo(() => {
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [startDate]);

  const [viewYear, setViewYear] = useState<number>(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYearMonth.month);

  // Sync view when startDate changes from outside (if picker is closed)
  useEffect(() => {
    if (!isOpen && startDate) {
      const [y, m] = startDate.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [startDate, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectingStart(null);
        setHoverDate(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Month 2 is always next month
  const month2Year = viewMonth === 11 ? viewYear + 1 : viewYear;
  const month2Month = viewMonth === 11 ? 0 : viewMonth + 1;

  const month1Days = useMemo(() => buildCalendarMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const month2Days = useMemo(() => buildCalendarMonth(month2Year, month2Month), [month2Year, month2Month]);

  // Click date handler
  const handleDayClick = (dateStr: string) => {
    if (!selectingStart) {
      // Step 1: Click start of range
      setSelectingStart(dateStr);
      setHoverDate(dateStr);
      onChange(dateStr, dateStr);
    } else {
      // Step 2: Click end of range
      if (dateStr < selectingStart) {
        onChange(dateStr, selectingStart);
      } else {
        onChange(selectingStart, dateStr);
      }
      setSelectingStart(null);
      setHoverDate(null);
    }
  };

  // Range bounds currently active (preview while selecting, or committed range)
  const activeStart = selectingStart || startDate;
  const activeEnd = selectingStart ? (hoverDate || selectingStart) : endDate;

  const minRange = activeStart <= activeEnd ? activeStart : activeEnd;
  const maxRange = activeStart <= activeEnd ? activeEnd : activeStart;
  const hasRange = minRange !== maxRange;

  const renderMonthDays = (days: CalendarDay[]) => {
    return (
      <div className="w-[260px] sm:w-[270px]">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-xs font-normal text-slate-400 dark:text-neutral-400 mb-2">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="h-6 flex items-center justify-center">
              {d}
            </div>
          ))}
        </div>

        {/* 42 Calendar Cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((cell, idx) => {
            const isStart = cell.dateStr === minRange && cell.isCurrentMonth;
            const isEnd = cell.dateStr === maxRange && cell.isCurrentMonth;
            const inRange = cell.isCurrentMonth && cell.dateStr > minRange && cell.dateStr < maxRange;

            // Rounded borders for range strips
            const isLeftEdge = cell.colIndex === 0 || cell.isFirstDayOfMonth;
            const isRightEdge = cell.colIndex === 6 || cell.isLastDayOfMonth;

            let stripClasses = '';
            if (inRange) {
              stripClasses = 'bg-slate-100 text-slate-900 dark:bg-[#22272E] dark:text-white';
              if (isLeftEdge) stripClasses += ' rounded-l-md';
              if (isRightEdge) stripClasses += ' rounded-r-md';
            } else if (isStart && hasRange) {
              stripClasses = 'relative after:absolute after:inset-y-0 after:right-0 after:w-1/2 after:bg-slate-100 dark:after:bg-[#22272E] after:z-0';
              if (isRightEdge) stripClasses = ''; // no continuation if end of row
            } else if (isEnd && hasRange) {
              stripClasses = 'relative before:absolute before:inset-y-0 before:left-0 before:w-1/2 before:bg-slate-100 dark:before:bg-[#22272E] before:z-0';
              if (isLeftEdge) stripClasses = ''; // no continuation if start of row
            }

            const textMuted = !cell.isCurrentMonth
              ? 'text-slate-300 dark:text-neutral-600 cursor-pointer'
              : 'text-slate-800 dark:text-white cursor-pointer';

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(cell.dateStr)}
                onMouseEnter={() => selectingStart && setHoverDate(cell.dateStr)}
                className={`h-9 flex items-center justify-center relative select-none ${stripClasses}`}
              >
                {isStart || isEnd ? (
                  <div className="relative z-10 h-8 w-8 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-black font-bold text-xs flex items-center justify-center shadow-md">
                    {cell.day}
                  </div>
                ) : (
                  <div
                    className={`relative z-10 h-8 w-8 flex items-center justify-center text-xs font-medium ${
                      cell.isCurrentMonth && !inRange ? 'hover:bg-slate-100 dark:hover:bg-neutral-800/80 rounded-lg' : ''
                    } ${textMuted}`}
                  >
                    {cell.day}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* 1. Trigger Button (Exact layout & text format respecting light/dark theme) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-10 inline-flex items-center gap-2.5 rounded-lg border border-slate-300 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] px-3.5 shadow-sm hover:bg-slate-50 dark:hover:bg-[#121620] hover:border-slate-400 dark:hover:border-neutral-700 transition-all text-xs sm:text-sm font-medium text-slate-800 dark:text-white select-none cursor-pointer shrink-0"
      >
        <Calendar className="h-4 w-4 text-slate-500 dark:text-neutral-400 shrink-0" />
        <span className="tracking-tight">{formatTriggerDisplay(startDate, endDate)}</span>
      </button>

      {/* 2. Modern Dual-Month Calendar Popover Dropdown (Exact Pixel-Perfect Match) */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 ${
            align === 'right' ? 'right-0' : 'left-0'
          } rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0F17] p-5 shadow-2xl text-slate-900 dark:text-white w-[300px] sm:w-[600px] transition-all`}
        >
          {/* Top Header Row: Prev button, Left Month Title, Right Month Title, Next button */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-neutral-800 bg-transparent hover:bg-slate-100 dark:hover:bg-neutral-800/80 text-slate-700 dark:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 text-center px-4">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <span className="hidden sm:block text-sm font-semibold text-slate-900 dark:text-white">
                {MONTH_NAMES[month2Month]} {month2Year}
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="h-8 w-8 rounded-lg border border-slate-200 dark:border-neutral-800 bg-transparent hover:bg-slate-100 dark:hover:bg-neutral-800/80 text-slate-700 dark:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Dual Calendar Columns */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-6">
            {renderMonthDays(month1Days)}
            <div className="hidden sm:block">
              {renderMonthDays(month2Days)}
            </div>
          </div>

          {/* Bottom Action Footer (Done Button only, exactly like reference image) */}
          <div className="flex items-center justify-end mt-4 pt-3.5 border-t border-slate-100 dark:border-neutral-800/80">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSelectingStart(null);
                setHoverDate(null);
              }}
              className="h-8 px-4 rounded-lg border border-slate-300 dark:border-neutral-700/80 bg-slate-100 hover:bg-slate-200 text-slate-900 dark:bg-[#121620] dark:text-white dark:hover:bg-neutral-800 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
