import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  PieChart,
  Pie,
} from 'recharts';
import { Download, Table as TableIcon, Info, AlertCircle } from 'lucide-react';
import { CustomerRecord, ScoredCustomer, GlobalFilters } from '../../types';

interface DashboardChartsProps {
  records: CustomerRecord[];
  scoredCustomers: ScoredCustomer[];
  portfolioChurnRate: number;
  onApplyFilter: (filters: Partial<GlobalFilters>) => void;
  onSelectCustomer: (customerId: string) => void;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  records,
  scoredCustomers,
  portfolioChurnRate,
  onApplyFilter,
  onSelectCustomer,
}) => {
  const [modalData, setModalData] = useState<{ title: string; rows: any[] } | null>(null);

  // 1. Churn Rate Trend by Month
  const trendData = useMemo(() => {
    const monthlyMap: Record<string, { total: number; churned: number }> = {};
    records.forEach((r) => {
      const dateStr = r['Churn Date'] || r['Join Date'];
      if (dateStr) {
        const monthKey = dateStr.slice(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { total: 0, churned: 0 };
        monthlyMap[monthKey].total++;
        if (Number(r['Churn Flag']) === 1) {
          monthlyMap[monthKey].churned++;
        }
      }
    });

    const sortedMonths = Object.keys(monthlyMap).sort().slice(-12);
    const result: Array<{ month: string; churnRate: number; movingAvg: number; count: number }> = [];

    sortedMonths.forEach((m, idx) => {
      const item = monthlyMap[m];
      const rate = item.total > 0 ? (item.churned / item.total) * 100 : 0;

      // 3-month moving average
      let maSum = rate;
      let maCount = 1;
      if (idx > 0 && sortedMonths[idx - 1]) {
        const prev = monthlyMap[sortedMonths[idx - 1]];
        maSum += (prev.churned / prev.total) * 100;
        maCount++;
      }
      if (idx > 1 && sortedMonths[idx - 2]) {
        const prev2 = monthlyMap[sortedMonths[idx - 2]];
        maSum += (prev2.churned / prev2.total) * 100;
        maCount++;
      }

      result.push({
        month: m,
        churnRate: Math.round(rate * 10) / 10,
        movingAvg: Math.round((maSum / maCount) * 10) / 10,
        count: item.total,
      });
    });

    return result;
  }, [records]);

  // 2. Churn Rate by Dimension (Service Type, Contract Type, Segment, UK Nation, Tenure Band)
  const getDimensionData = (key: keyof CustomerRecord | string) => {
    const groupMap: Record<string, { total: number; churned: number; revenueLost: number }> = {};

    records.forEach((r) => {
      let val = String(r[key] || 'Other');
      if (key === 'TenureBand') {
        const tenure = Number(r['Tenure Months']) || 0;
        if (tenure <= 6) val = '0–6 Months';
        else if (tenure <= 12) val = '7–12 Months';
        else if (tenure <= 24) val = '13–24 Months';
        else if (tenure <= 48) val = '25–48 Months';
        else val = '48+ Months';
      }

      if (!groupMap[val]) groupMap[val] = { total: 0, churned: 0, revenueLost: 0 };
      groupMap[val].total++;
      if (Number(r['Churn Flag']) === 1) {
        groupMap[val].churned++;
        groupMap[val].revenueLost += Number(r['Monthly Charge GBP']) || 0;
      }
    });

    return Object.entries(groupMap)
      .map(([name, stat]) => ({
        name,
        total: stat.total,
        churned: stat.churned,
        churnRate: stat.total > 0 ? Math.round((stat.churned / stat.total) * 1000) / 10 : 0,
        revenueLost: Math.round(stat.revenueLost),
        isSmallSample: stat.total < 30,
      }))
      .sort((a, b) => b.churnRate - a.churnRate);
  };

  const serviceData = useMemo(() => getDimensionData('Service Type'), [records]);
  const contractData = useMemo(() => getDimensionData('Contract Type'), [records]);
  const segmentData = useMemo(() => getDimensionData('Customer Segment'), [records]);
  const nationData = useMemo(() => getDimensionData('UK Nation'), [records]);
  const tenureData = useMemo(() => getDimensionData('TenureBand'), [records]);

  // 3. Churn Reasons & Revenue Lost by Reason
  const reasonsData = useMemo(() => {
    const map: Record<string, { count: number; revenueLost: number }> = {};
    const churnedRecords = records.filter((r) => Number(r['Churn Flag']) === 1);

    churnedRecords.forEach((r) => {
      const reason = r['Churn Reason'] || 'Unspecified';
      if (!map[reason]) map[reason] = { count: 0, revenueLost: 0 };
      map[reason].count++;
      map[reason].revenueLost += Number(r['Monthly Charge GBP']) || 0;
    });

    return Object.entries(map)
      .map(([reason, stat]) => ({
        reason,
        count: stat.count,
        percentage: churnedRecords.length > 0 ? Math.round((stat.count / churnedRecords.length) * 1000) / 10 : 0,
        revenueLostGbp: Math.round(stat.revenueLost),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [records]);

  // 4. Risk Tier Distribution (Active Customers)
  const riskTierData = useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const revAtRisk = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    scoredCustomers.forEach((s) => {
      counts[s.riskTier] = (counts[s.riskTier] || 0) + 1;
      revAtRisk[s.riskTier] = (revAtRisk[s.riskTier] || 0) + s.monthlyRevenueAtRisk;
    });

    return [
      { name: 'Critical (≥70%)', count: counts.Critical, revenueAtRisk: Math.round(revAtRisk.Critical), color: '#7A0C1E' },
      { name: 'High (50–69%)', count: counts.High, revenueAtRisk: Math.round(revAtRisk.High), color: '#B5483A' },
      { name: 'Medium (30–49%)', count: counts.Medium, revenueAtRisk: Math.round(revAtRisk.Medium), color: '#C9A227' },
      { name: 'Low (<30%)', count: counts.Low, revenueAtRisk: Math.round(revAtRisk.Low), color: '#0B1F4B' },
    ];
  }, [scoredCustomers]);

  // 5. Contract Expiry Pipeline
  const expiryPipelineData = useMemo(() => {
    const bins = {
      'Expired (Out-of-Contract)': { customers: 0, revenue: 0, highRisk: 0 },
      'Expiring in ≤ 30 Days': { customers: 0, revenue: 0, highRisk: 0 },
      'Expiring in 31–60 Days': { customers: 0, revenue: 0, highRisk: 0 },
      'Expiring in 61–90 Days': { customers: 0, revenue: 0, highRisk: 0 },
      'Contract > 90 Days': { customers: 0, revenue: 0, highRisk: 0 },
    };

    const scoredMap = new Map<string, ScoredCustomer>();
    scoredCustomers.forEach((s) => scoredMap.set(s.customerId, s));

    records.forEach((r) => {
      if (Number(r['Churn Flag']) === 0) {
        const endStr = r['Contract End Date'];
        const charge = Number(r['Monthly Charge GBP']) || 0;
        const scored = scoredMap.get(String(r['Customer ID']));
        const isHighRisk = scored ? scored.churnProbability >= 50 : false;

        if (!endStr) {
          bins['Expired (Out-of-Contract)'].customers++;
          bins['Expired (Out-of-Contract)'].revenue += charge;
          if (isHighRisk) bins['Expired (Out-of-Contract)'].highRisk++;
        } else {
          const days = Math.round((new Date(endStr).getTime() - new Date('2026-10-31').getTime()) / (1000 * 60 * 60 * 24));
          if (days < 0) {
            bins['Expired (Out-of-Contract)'].customers++;
            bins['Expired (Out-of-Contract)'].revenue += charge;
            if (isHighRisk) bins['Expired (Out-of-Contract)'].highRisk++;
          } else if (days <= 30) {
            bins['Expiring in ≤ 30 Days'].customers++;
            bins['Expiring in ≤ 30 Days'].revenue += charge;
            if (isHighRisk) bins['Expiring in ≤ 30 Days'].highRisk++;
          } else if (days <= 60) {
            bins['Expiring in 31–60 Days'].customers++;
            bins['Expiring in 31–60 Days'].revenue += charge;
            if (isHighRisk) bins['Expiring in 31–60 Days'].highRisk++;
          } else if (days <= 90) {
            bins['Expiring in 61–90 Days'].customers++;
            bins['Expiring in 61–90 Days'].revenue += charge;
            if (isHighRisk) bins['Expiring in 61–90 Days'].highRisk++;
          } else {
            bins['Contract > 90 Days'].customers++;
            bins['Contract > 90 Days'].revenue += charge;
            if (isHighRisk) bins['Contract > 90 Days'].highRisk++;
          }
        }
      }
    });

    return Object.entries(bins).map(([stage, d]) => ({
      stage,
      customers: d.customers,
      revenueGbp: Math.round(d.revenue),
      highRiskCount: d.highRisk,
      highRiskPct: d.customers > 0 ? Math.round((d.highRisk / d.customers) * 100) : 0,
    }));
  }, [records, scoredCustomers]);

  // 6. Top 10 High-Risk Active Customers
  const top10RiskCustomers = useMemo(() => {
    return [...scoredCustomers]
      .sort((a, b) => b.churnProbability - a.churnProbability)
      .slice(0, 10);
  }, [scoredCustomers]);

  return (
    <div className="space-y-6">
      {/* Row 1: Churn Trend Line + Risk Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Line (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Monthly Churn Rate Trend
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                12-month historical churn rate (%) with 3-month smoothing moving average
              </p>
            </div>
            <button
              onClick={() => setModalData({ title: 'Monthly Churn Trend Data', rows: trendData })}
              className="p-1 rounded text-[#6B7280] hover:text-[#0B1F4B] transition-colors"
              title="View underlying data table"
            >
              <TableIcon size={14} />
            </button>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={11} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any) => [`${val}%`, '']}
                />
                <Line
                  type="monotone"
                  dataKey="churnRate"
                  name="Monthly Churn Rate"
                  stroke="#7A0C1E"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7A0C1E' }}
                />
                <Line
                  type="monotone"
                  dataKey="movingAvg"
                  name="3M Moving Average"
                  stroke="#C9A227"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-end gap-4 mt-2 text-[11px] text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#7A0C1E]" /> Realized Churn %</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#C9A227]" /> 3M Moving Average</span>
          </div>
        </div>

        {/* Risk Tier Donut (1 col) */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Active Customer Risk Tiers
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Segmented by predicted ML churn probability
              </p>
            </div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskTierData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {riskTierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, name: any, item: any) => [
                    `${val.toLocaleString()} accounts (£${item.payload.revenueAtRisk.toLocaleString()} at risk)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#D9DCE6]/60 dark:border-[#1E3A8A]/50 text-xs">
            {riskTierData.map((tier) => (
              <div key={tier.name} className="flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#111827] dark:text-white">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                  <span className="truncate">{tier.name.split(' ')[0]}</span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#6B7280] pl-3.5">
                  {tier.count.toLocaleString()} ({"£" + tier.revenueAtRisk.toLocaleString()})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Churn by Service Type & Churn by Contract Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Service Type Bars */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Churn Rate by Telecommunications Service
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Sorted by churn rate. Gold line marks portfolio average ({portfolioChurnRate}%).
              </p>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={serviceData}
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <XAxis type="number" stroke="#6B7280" fontSize={11} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={10} width={75} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.churned} / ${item.payload.total} accounts)`,
                    'Churn Rate',
                  ]}
                />
                <ReferenceLine x={portfolioChurnRate} stroke="#C9A227" strokeDasharray="3 3" />
                <Bar
                  dataKey="churnRate"
                  fill="#0B1F4B"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry) => onApplyFilter({ serviceType: entry.name })}
                  className="cursor-pointer"
                >
                  {serviceData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.churnRate > portfolioChurnRate ? '#7A0C1E' : '#0B1F4B'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contract Type Bars */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Churn Rate by Contract Agreement
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Click any bar to filter entire platform to that contract arrangement.
              </p>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={contractData}
                margin={{ top: 5, right: 30, left: 55, bottom: 5 }}
              >
                <XAxis type="number" stroke="#6B7280" fontSize={11} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={10} width={70} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.churned} / ${item.payload.total} accounts)`,
                    'Churn Rate',
                  ]}
                />
                <ReferenceLine x={portfolioChurnRate} stroke="#C9A227" strokeDasharray="3 3" />
                <Bar
                  dataKey="churnRate"
                  fill="#0B1F4B"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry) => onApplyFilter({ contractType: entry.name })}
                  className="cursor-pointer"
                >
                  {contractData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.churnRate > portfolioChurnRate ? '#7A0C1E' : '#1E3A8A'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2B: Churn by Segment, UK Nation, and Customer Tenure Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Segment */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Churn by Customer Segment
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Consumer vs Small Business portfolio
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.churned} / ${item.payload.total} accounts)`,
                    'Churn Rate',
                  ]}
                />
                <Bar
                  dataKey="churnRate"
                  fill="#0B1F4B"
                  radius={[4, 4, 0, 0]}
                  onClick={(entry) => onApplyFilter({ customerSegment: entry.name })}
                  className="cursor-pointer"
                >
                  {segmentData.map((entry, index) => (
                    <Cell key={`seg-${index}`} fill={entry.churnRate > portfolioChurnRate ? '#7A0C1E' : '#1E3A8A'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* UK Nation */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Churn by UK Nation
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Geographic regional departure variance
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.churned} / ${item.payload.total} accounts)`,
                    'Churn Rate',
                  ]}
                />
                <Bar
                  dataKey="churnRate"
                  fill="#0B1F4B"
                  radius={[4, 4, 0, 0]}
                  onClick={(entry) => onApplyFilter({ ukNation: entry.name })}
                  className="cursor-pointer"
                >
                  {nationData.map((entry, index) => (
                    <Cell key={`nat-${index}`} fill={entry.churnRate > portfolioChurnRate ? '#7A0C1E' : '#0B1F4B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Tenure Analysis */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Customer Tenure Analysis
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Churn hazard curve across lifecycle cohorts
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenureData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#6B7280" fontSize={9} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={11} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.churned} / ${item.payload.total} accounts)`,
                    'Churn Rate',
                  ]}
                />
                <Bar dataKey="churnRate" fill="#C9A227" radius={[4, 4, 0, 0]}>
                  {tenureData.map((entry, index) => (
                    <Cell key={`ten-${index}`} fill={entry.churnRate > portfolioChurnRate ? '#7A0C1E' : '#C9A227'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Top Churn Reasons & Contract Expiry Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reasons */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Primary Cancellation Reasons
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Ranked by volume of departures and total recurring revenue lost (£/mo)
              </p>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={reasonsData}
                margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
              >
                <XAxis type="number" stroke="#6B7280" fontSize={11} unit="%" />
                <YAxis dataKey="reason" type="category" stroke="#6B7280" fontSize={10} width={105} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val}% (${item.payload.count} customers · £${item.payload.revenueLostGbp.toLocaleString()}/mo lost)`,
                    'Share of Churned',
                  ]}
                />
                <Bar dataKey="percentage" fill="#7A0C1E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contract Expiry Pipeline */}
        <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
                Contract Expiry & Renewal Pipeline
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
                Active customer volume by proximity to contract end
              </p>
            </div>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={expiryPipelineData}
                margin={{ top: 10, right: 10, left: 10, bottom: 25 }}
              >
                <XAxis dataKey="stage" stroke="#6B7280" fontSize={9} angle={-15} textAnchor="end" />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B1F4B',
                    borderColor: '#C9A227',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                  formatter={(val: any, _, item: any) => [
                    `${val} subscribers (£${item.payload.revenueGbp.toLocaleString()}/mo billing · ${item.payload.highRiskCount} high risk)`,
                    'Accounts',
                  ]}
                />
                <Bar dataKey="customers" fill="#1E3A8A" radius={[4, 4, 0, 0]}>
                  {expiryPipelineData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.stage.includes('Expired') || entry.stage.includes('≤ 30') ? '#7A0C1E' : '#1E3A8A'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Top 10 Customers at Risk Table */}
      <div className="bg-white dark:bg-[#071433] rounded-xl border border-[#D9DCE6] dark:border-[#1E3A8A] p-5 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-[#0B1F4B] dark:text-white">
              Immediate Priority Active Customer Watchlist
            </h3>
            <p className="text-xs text-[#6B7280] dark:text-[#D9DCE6]/70">
              Active accounts with highest predicted departure probabilities and key churn drivers
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#D9DCE6] dark:border-[#1E3A8A] text-[#6B7280] dark:text-[#D9DCE6]/70 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Customer ID</th>
                <th className="py-2.5 px-3">Service & Plan</th>
                <th className="py-2.5 px-3">Monthly Bill</th>
                <th className="py-2.5 px-3">Contract Status</th>
                <th className="py-2.5 px-3">Churn Probability</th>
                <th className="py-2.5 px-3">Revenue at Risk</th>
                <th className="py-2.5 px-3">Primary Driver</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DCE6]/60 dark:divide-[#1E3A8A]/50">
              {top10RiskCustomers.map((cust) => (
                <tr
                  key={cust.customerId}
                  className="hover:bg-[#F5F6FA] dark:hover:bg-[#1E3A8A]/30 transition-colors"
                >
                  <td className="py-2.5 px-3 font-semibold text-[#0B1F4B] dark:text-[#E8D48A]">
                    {cust.customerId}
                  </td>
                  <td className="py-2.5 px-3 text-[#111827] dark:text-white">
                    <div>{cust.record['Plan Name']}</div>
                    <div className="text-[10px] text-[#6B7280]">{cust.record['Service Type']}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums">
                    £{Number(cust.record['Monthly Charge GBP']).toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[#111827] dark:text-white">
                      {cust.record['Contract Type']}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 rounded-full bg-[#D9DCE6] dark:bg-[#1E3A8A] overflow-hidden">
                        <div
                          className="h-full bg-[#7A0C1E] rounded-full"
                          style={{ width: `${cust.churnProbability}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[#7A0C1E] dark:text-red-400 tabular-nums">
                        {cust.churnProbability.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold tabular-nums text-[#0B1F4B] dark:text-white">
                    £{cust.monthlyRevenueAtRisk.toFixed(2)}/mo
                  </td>
                  <td className="py-2.5 px-3 text-[#6B7280] dark:text-[#D9DCE6]/70 truncate max-w-[140px]">
                    {cust.topDrivers[0]?.label || 'Contract expiry'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => onSelectCustomer(cust.customerId)}
                      className="px-2.5 py-1 rounded bg-[#0B1F4B] text-white hover:bg-[#1E3A8A] transition-colors text-[11px] font-medium"
                    >
                      Score & Playbook
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Underlying Data Modal */}
      {modalData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#071433] rounded-xl max-w-xl w-full p-5 shadow-2xl border border-[#D9DCE6] dark:border-[#1E3A8A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D9DCE6] dark:border-[#1E3A8A]">
              <h3 className="font-serif text-base font-bold text-[#0B1F4B] dark:text-white">
                {modalData.title}
              </h3>
              <button
                onClick={() => setModalData(null)}
                className="text-[#6B7280] hover:text-[#111827] text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto mt-3">
              <pre className="text-xs font-mono p-3 bg-[#F5F6FA] dark:bg-[#0B1F4B] text-[#111827] dark:text-[#D9DCE6] rounded-lg">
                {JSON.stringify(modalData.rows, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
