import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { CustomerRecord } from '../types';

export const DrilldownPage: React.FC = () => {
  const { filteredRecords, setFilters } = useAppStore();

  const [activeDimension, setActiveDimension] = useState<
    'Plan Name' | 'City' | 'Acquisition Channel' | 'Age Band' | 'Payment Method'
  >('Plan Name');

  const baseChurnRate = useMemo(() => {
    const total = filteredRecords.length;
    if (total === 0) return 0;
    const churners = filteredRecords.filter((r) => Number(r['Churn Flag']) === 1).length;
    return Math.round((churners / total) * 1000) / 10;
  }, [filteredRecords]);

  // Dimension breakdown data
  const dimensionData = useMemo(() => {
    const map: Record<string, { total: number; churned: number; revenueLost: number }> = {};

    filteredRecords.forEach((r) => {
      const val = String(r[activeDimension] || 'Unrecorded');
      if (!map[val]) map[val] = { total: 0, churned: 0, revenueLost: 0 };
      map[val].total++;
      if (Number(r['Churn Flag']) === 1) {
        map[val].churned++;
        map[val].revenueLost += Number(r['Monthly Charge GBP']) || 0;
      }
    });

    return Object.entries(map)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        churned: stat.churned,
        churnRate: stat.total > 0 ? Math.round((stat.churned / stat.total) * 1000) / 10 : 0,
        revenueLostGbp: Math.round(stat.revenueLost),
        isSmallSample: stat.total < 30,
      }))
      .sort((a, b) => b.churnRate - a.churnRate)
      .slice(0, 15);
  }, [filteredRecords, activeDimension]);

  // Heat-map Matrix: Contract Type × Tenure Band Churn Rate
  const heatMapData = useMemo(() => {
    const contracts = ['30-Day Rolling', '12 Months', '18 Months', '24 Months'];
    const tenureBands = ['0–6 Months', '7–12 Months', '13–24 Months', '25–48 Months', '48+ Months'];

    const matrix: Record<string, Record<string, { total: number; churned: number; rate: number }>> = {};

    contracts.forEach((c) => {
      matrix[c] = {};
      tenureBands.forEach((t) => {
        matrix[c][t] = { total: 0, churned: 0, rate: 0 };
      });
    });

    filteredRecords.forEach((r) => {
      const contract = r['Contract Type'] || '30-Day Rolling';
      const tenure = Number(r['Tenure Months']) || 0;
      let band = '48+ Months';
      if (tenure <= 6) band = '0–6 Months';
      else if (tenure <= 12) band = '7–12 Months';
      else if (tenure <= 24) band = '13–24 Months';
      else if (tenure <= 48) band = '25–48 Months';

      if (matrix[contract] && matrix[contract][band]) {
        matrix[contract][band].total++;
        if (Number(r['Churn Flag']) === 1) {
          matrix[contract][band].churned++;
        }
      }
    });

    contracts.forEach((c) => {
      tenureBands.forEach((t) => {
        const item = matrix[c][t];
        item.rate = item.total > 0 ? Math.round((item.churned / item.total) * 1000) / 10 : 0;
      });
    });

    return { contracts, tenureBands, matrix };
  }, [filteredRecords]);

  // Behavioural Friction correlations: Tickets, Outages, Complaints
  const ticketsVsChurn = useMemo(() => {
    const bins = ['0 Tickets', '1–2 Tickets', '3–4 Tickets', '5+ Tickets'];
    const map: Record<string, { total: number; churned: number }> = {};
    bins.forEach((b) => (map[b] = { total: 0, churned: 0 }));

    filteredRecords.forEach((r) => {
      const t = Number(r['Support Tickets 12M']) || 0;
      let bin = '5+ Tickets';
      if (t === 0) bin = '0 Tickets';
      else if (t <= 2) bin = '1–2 Tickets';
      else if (t <= 4) bin = '3–4 Tickets';

      map[bin].total++;
      if (Number(r['Churn Flag']) === 1) map[bin].churned++;
    });

    return bins.map((bin) => ({
      bin,
      churnRate: map[bin].total > 0 ? Math.round((map[bin].churned / map[bin].total) * 1000) / 10 : 0,
      total: map[bin].total,
    }));
  }, [filteredRecords]);

  const outagesVsChurn = useMemo(() => {
    const bins = ['0 Outages', '1 Outage', '2 Outages', '3+ Outages'];
    const map: Record<string, { total: number; churned: number }> = {};
    bins.forEach((b) => (map[b] = { total: 0, churned: 0 }));

    filteredRecords.forEach((r) => {
      const o = Number(r['Network Outages 12M']) || 0;
      let bin = '3+ Outages';
      if (o === 0) bin = '0 Outages';
      else if (o === 1) bin = '1 Outage';
      else if (o === 2) bin = '2 Outages';

      map[bin].total++;
      if (Number(r['Churn Flag']) === 1) map[bin].churned++;
    });

    return bins.map((bin) => ({
      bin,
      churnRate: map[bin].total > 0 ? Math.round((map[bin].churned / map[bin].total) * 1000) / 10 : 0,
      total: map[bin].total,
    }));
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl font-bold text-[#0B1F4B] dark:text-white">
            Churn Factor Drill-Down Analysis
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mt-0.5">
            Empirical cross-tabulation of subscriber departure rates across commercial, operational, and behavioural dimensions.
          </p>
        </div>

        {/* Dimension Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#F5F6FA] dark:bg-[#0B1F4B] rounded-lg border border-[#D9DCE6] dark:border-[#1E3A8A] text-xs font-medium">
          {(['Plan Name', 'City', 'Acquisition Channel', 'Age Band', 'Payment Method'] as const).map((dim) => (
            <button
              key={dim}
              onClick={() => setActiveDimension(dim)}
              className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                activeDimension === dim
                  ? 'bg-white dark:bg-[#1E3A8A] text-[#0B1F4B] dark:text-white shadow-xs font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827] dark:hover:text-white'
              }`}
            >
              {dim}
            </button>
          ))}
        </div>
      </div>

      {/* Main Dimension Ranked Chart */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
              Churn Rate by {activeDimension}
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
              Ranked descending. Benchmark reference line is portfolio average ({baseChurnRate}%).
            </p>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={dimensionData}
              margin={{ top: 5, right: 35, left: 120, bottom: 5 }}
            >
              <XAxis type="number" stroke="#6B7280" fontSize={11} unit="%" />
              <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={10} width={115} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0B1F4B',
                  borderColor: '#C9A227',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                }}
                formatter={(val: any, _, item: any) => [
                  `${val}% (${item.payload.churned} / ${item.payload.total} accounts · £${item.payload.revenueLostGbp.toLocaleString()} lost)`,
                  'Churn Rate',
                ]}
              />
              <ReferenceLine x={baseChurnRate} stroke="#C9A227" strokeDasharray="3 3" />
              <Bar dataKey="churnRate" radius={[0, 4, 4, 0]}>
                {dimensionData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.churnRate > baseChurnRate ? '#7A0C1E' : '#0B1F4B'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cross-dimensional Matrix Heat-map: Contract Type × Tenure Band */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
        <div className="mb-4">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
            Contract Type × Tenure Band Churn Rate Matrix
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
            Heat intensity mapping realized churn percentage from Navy (low risk) to Dark Red (severe risk).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-3 font-semibold">Contract Arrangement</th>
                {heatMapData.tenureBands.map((t) => (
                  <th key={t} className="py-2 px-3 font-semibold">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
              {heatMapData.contracts.map((contract) => (
                <tr key={contract}>
                  <td className="text-left py-3 px-3 font-semibold text-[#0B1F4B] dark:text-white">
                    {contract}
                  </td>
                  {heatMapData.tenureBands.map((band) => {
                    const cell = heatMapData.matrix[contract]?.[band];
                    const rate = cell?.rate || 0;
                    const total = cell?.total || 0;

                    // Compute background color along navy -> gold -> dark red
                    let bgStyle = 'bg-[#0B1F4B]/10 text-[#0B1F4B] dark:text-white';
                    if (rate >= 35) bgStyle = 'bg-[#7A0C1E] text-white font-bold';
                    else if (rate >= 25) bgStyle = 'bg-[#B5483A] text-white font-bold';
                    else if (rate >= 15) bgStyle = 'bg-[#C9A227]/25 text-[#856404] dark:text-[#E8D48A]';

                    return (
                      <td key={band} className="py-3 px-3">
                        <div className={`py-1.5 px-2 rounded-lg font-mono tabular-nums ${bgStyle}`}>
                          {rate.toFixed(1)}%
                          <div className="text-[9px] opacity-80 font-normal">
                            n={total}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Operational Friction vs Churn (Tickets & Outages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Support Tickets vs Churn */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
            Support Ticket Escalations vs Churn
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
            Correlation between service ticket volume in preceding 12 months and churn probability.
          </p>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ticketsVsChurn} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="bin" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [`${val}% (${item.payload.total} accounts)`, 'Churn Rate']}
                />
                <Bar dataKey="churnRate" fill="#1E3A8A" radius={[4, 4, 0, 0]}>
                  {ticketsVsChurn.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.churnRate > baseChurnRate ? '#7A0C1E' : '#1E3A8A'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Outages vs Churn */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white mb-1">
            Network Outage Exposure vs Churn
          </h3>
          <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70 mb-4">
            Subscribers experiencing &ge; 2 outages exhibit a steep rise in cancellation risk.
          </p>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outagesVsChurn} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="bin" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [`${val}% (${item.payload.total} accounts)`, 'Churn Rate']}
                />
                <Bar dataKey="churnRate" fill="#0B1F4B" radius={[4, 4, 0, 0]}>
                  {outagesVsChurn.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.churnRate > baseChurnRate ? '#7A0C1E' : '#0B1F4B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
