import React, { useState } from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  formula: string;
  deltaText?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  highlightColor?: 'navy' | 'gold' | 'red' | 'default';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  formula,
  deltaText,
  deltaType = 'neutral',
  highlightColor = 'default',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getBorderColor = () => {
    if (highlightColor === 'gold') return 'border-[#C9A227]/40';
    if (highlightColor === 'red') return 'border-[#7A0C1E]/40';
    if (highlightColor === 'navy') return 'border-[#1E3A8A]/40';
    return 'border-[#D9DCE6] dark:border-[#1E3A8A]';
  };

  return (
    <div
      className={`relative bg-white dark:bg-[#071433] rounded-xl border p-4 shadow-xs transition-all hover:shadow-sm ${getBorderColor()}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-[#6B7280] dark:text-[#D9DCE6]/70 leading-tight">
          {title}
        </span>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="text-[#6B7280] hover:text-[#0B1F4B] dark:hover:text-[#E8D48A] transition-colors p-0.5"
            aria-label={`Formula for ${title}`}
          >
            <Info size={13} />
          </button>

          {showTooltip && (
            <div className="absolute right-0 top-full mt-1.5 w-60 p-2.5 bg-[#0B1F4B] text-white text-[11px] rounded-lg shadow-xl z-50 pointer-events-none border border-[#C9A227]/40 leading-relaxed">
              <div className="font-semibold text-[#C9A227] mb-1">Calculation Formula</div>
              <div>{formula}</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-2xl font-bold tracking-tight text-[#111827] dark:text-white tabular-nums">
          {value}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-[#6B7280] dark:text-[#D9DCE6]/60">
        <span className="truncate">{subtitle || 'Portfolio metric'}</span>
        {deltaText && (
          <span
            className={`flex items-center gap-0.5 font-medium tabular-nums ${
              deltaType === 'positive'
                ? 'text-emerald-600 dark:text-emerald-400'
                : deltaType === 'negative'
                ? 'text-[#7A0C1E] dark:text-red-400 font-semibold'
                : 'text-[#6B7280]'
            }`}
          >
            {deltaType === 'positive' && <TrendingUp size={11} />}
            {deltaType === 'negative' && <TrendingDown size={11} />}
            {deltaType === 'neutral' && <Minus size={11} />}
            <span>{deltaText}</span>
          </span>
        )}
      </div>
    </div>
  );
};
