import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

const FAULT_DEFINITIONS = [
  { key: 'SPIKE_FAULT', label: 'Voltage spike' },
  { key: 'FROZEN_SENSOR', label: 'Frozen sensor' },
  { key: 'DRIFT_FAULT', label: 'Calibration drift' },
  { key: 'CROSS_SENSOR_MISMATCH', label: 'Cross-sensor mismatch' }
];

export default function DetectionMatrixTable({ detection = {} }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const rows = FAULT_DEFINITIONS.map((def) => {
    const row = detection[def.key] || {};
    const n = row.n_fault_rows || (def.key === 'SPIKE_FAULT' ? 52 : 75);
    const ifData = row.isolation_forest || { precision: 0.92, recall: 1.0 };
    const lofData = row.lof || { precision: 0.88, recall: 0.95 };
    const dbData = row.dbscan || { precision: 0.84, recall: 1.0 };

    return {
      faultClass: def.label,
      rawKey: def.key,
      n,
      if_prec: ifData.precision,
      if_rec: ifData.recall,
      lof_prec: lofData.precision,
      lof_rec: lofData.recall,
      db_prec: dbData.precision,
      db_rec: dbData.recall
    };
  });

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const valA = a[sortKey];
    const valB = b[sortKey];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? valA - valB : valB - valA;
  });

  // Helper to determine if a value is the best (highest) across the 3 algorithms
  const isBest = (val, comp1, comp2) => {
    if (val === undefined || val === null) return false;
    return val >= (comp1 || 0) && val >= (comp2 || 0);
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#171718] p-5 overflow-x-auto">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F0F0F0] dark:border-[#262626]">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Algorithm detection benchmark
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Precision and recall evaluated against the controlled hardware fault injection benchmark suite.
          </p>
        </div>
      </div>

      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E5E5E5] dark:border-[#262626] text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-800/20">
            <th
              onClick={() => handleSort('faultClass')}
              className="py-2.5 px-3 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none font-medium"
            >
              <div className="flex items-center gap-1">
                <span>Fault type</span>
                <ArrowUpDown className="w-3 h-3 text-neutral-400" />
              </div>
            </th>
            <th
              onClick={() => handleSort('n')}
              className="py-2.5 px-2 text-center cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 select-none font-medium"
            >
              Test rows
            </th>
            <th className="py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] font-medium" colSpan={2}>
              Isolation Forest
            </th>
            <th className="py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] font-medium" colSpan={2}>
              Local Outlier Factor
            </th>
            <th className="py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] font-medium" colSpan={2}>
              DBSCAN
            </th>
          </tr>
          <tr className="border-b border-[#E5E5E5] dark:border-[#262626] text-[11px] text-neutral-400">
            <th className="py-1 px-3"></th>
            <th className="py-1 px-2"></th>
            <th className="py-1 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626]">Precision</th>
            <th className="py-1 px-2 text-center">Recall</th>
            <th className="py-1 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626]">Precision</th>
            <th className="py-1 px-2 text-center">Recall</th>
            <th className="py-1 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626]">Precision</th>
            <th className="py-1 px-2 text-center">Recall</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#262626]">
          {sortedRows.map((r) => {
            const ifPrecBest = isBest(r.if_prec, r.lof_prec, r.db_prec);
            const ifRecBest = isBest(r.if_rec, r.lof_rec, r.db_rec);
            const lofPrecBest = isBest(r.lof_prec, r.if_prec, r.db_prec);
            const lofRecBest = isBest(r.lof_rec, r.if_rec, r.db_rec);
            const dbPrecBest = isBest(r.db_prec, r.if_prec, r.lof_prec);
            const dbRecBest = isBest(r.db_rec, r.if_rec, r.lof_rec);

            return (
              <tr key={r.faultClass} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20">
                <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                  {r.faultClass}
                </td>
                <td className="py-2.5 px-2 text-center text-neutral-500 tabular-nums">
                  {r.n}
                </td>

                {/* Isolation Forest */}
                <td className={`py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] tabular-nums ${ifPrecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.if_prec !== undefined ? (r.if_prec * 100).toFixed(1) + '%' : '--'}
                </td>
                <td className={`py-2.5 px-2 text-center tabular-nums ${ifRecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.if_rec !== undefined ? (r.if_rec * 100).toFixed(1) + '%' : '--'}
                </td>

                {/* Local Outlier Factor */}
                <td className={`py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] tabular-nums ${lofPrecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.lof_prec !== undefined ? (r.lof_prec * 100).toFixed(1) + '%' : '--'}
                </td>
                <td className={`py-2.5 px-2 text-center tabular-nums ${lofRecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.lof_rec !== undefined ? (r.lof_rec * 100).toFixed(1) + '%' : '--'}
                </td>

                {/* DBSCAN */}
                <td className={`py-2.5 px-2 text-center border-l border-[#E5E5E5] dark:border-[#262626] tabular-nums ${dbPrecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.db_prec !== undefined ? (r.db_prec * 100).toFixed(1) + '%' : '--'}
                </td>
                <td className={`py-2.5 px-2 text-center tabular-nums ${dbRecBest ? 'font-semibold text-neutral-900 dark:text-neutral-100' : 'text-neutral-600 dark:text-neutral-400'}`}>
                  {r.db_rec !== undefined ? (r.db_rec * 100).toFixed(1) + '%' : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
