'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface ProposalRow {
  id: number;
  offer_number: string;
  company_name: string;
  project_name: string | null;
  project_number: string | null;
  total_price: number | null;
  currency: string | null;
  proposal_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  viewed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const formatMoney = (n: number | null, currency: string | null) => {
  if (n == null) return '—';
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency || 'EUR'}`;
  }
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ProposalsListPage() {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      params.set('limit', '100');
      const res = await fetch(`/api/proposals?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load proposals');
      setRows(json.rows);
      setTotal(json.total);
    } catch (e: any) {
      setError(e.message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-10 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-white text-3xl font-semibold tracking-tight">Proposals</h1>
            <p className="text-white/80 mt-1 text-sm">
              Retrieve, edit, and mark proposals as ready
            </p>
          </div>
          <Link
            href="/"
            className="text-white/90 hover:text-white text-sm border border-white/30 rounded-md px-4 py-2 transition-colors"
          >
            + New proposal
          </Link>
        </div>

        <div className="px-10 py-8">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, offer number, project…"
              className="flex-1 border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              disabled={loading}
              className="bg-slate-800 text-white text-sm px-5 py-2 rounded-md hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <div className="text-xs text-gray-500 mb-2">
            {loading ? 'Loading…' : `${total} proposal${total === 1 ? '' : 's'}`}
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Offer #</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Company</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Project</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No proposals found.
                    </td>
                  </tr>
                )}
                {rows.map((p) => {
                  const statusKey = (p.proposal_status || 'draft').toLowerCase();
                  const statusStyle =
                    STATUS_STYLES[statusKey] || 'bg-gray-100 text-gray-700 border-gray-200';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {p.offer_number}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{p.company_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.project_name || p.project_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                        {formatMoney(p.total_price, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium capitalize ${statusStyle}`}
                        >
                          {p.proposal_status || 'draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(p.updated_at || p.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/proposals/${encodeURIComponent(p.offer_number)}/edit`}
                          className="text-slate-800 hover:text-slate-600 text-sm font-medium"
                        >
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
