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

interface ServiceData {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customPrice?: number;
  buildingType?: string;
  apartmentSize?: string;
  projectType?: string;
  areaSize?: string;
  [k: string]: unknown;
}

interface ProposalDetail extends ProposalRow {
  client_id: number | null;
  street_no: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  project_type: string | null;
  proposal_date: string | null;
  offer_valid_until: string | null;
  delivery_time_min: number | null;
  delivery_time_max: number | null;
  services: ServiceData[] | null;
  pricing: {
    subtotalNet?: number;
    discountAmount?: number;
    totalNetPrice?: number;
    totalVat?: number;
    totalGrossPrice?: number;
    discount?: { type?: string; value?: number; amount?: number; description?: string };
  } | null;
  document_url: { docx?: string; pdf?: string; folder?: string } | null;
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
  draft: 'bg-gray-100 text-gray-800 border-gray-300',
  ready: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  sent: 'bg-blue-100 text-blue-900 border-blue-300',
  viewed: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  accepted: 'bg-green-100 text-green-900 border-green-300',
  rejected: 'bg-red-100 text-red-900 border-red-300',
};

const formatMoney = (n: number | null | undefined, currency?: string | null) => {
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

const formatDay = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export default function ProposalsListPage() {
  const [rows, setRows] = useState<ProposalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [viewOffer, setViewOffer] = useState<string | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 md:px-10 py-8 flex items-center justify-between">
          <div>
            <h1 className="text-white text-3xl font-semibold tracking-tight">Proposals</h1>
            <p className="text-white/80 mt-1 text-sm">
              Retrieve, edit, and mark proposals as ready
            </p>
          </div>
          <Link
            href="/generator"
            className="bg-white text-slate-900 text-sm font-semibold border border-white rounded-md px-4 py-2 hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            + New proposal
          </Link>
        </div>

        <div className="px-8 md:px-10 py-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, offer number, project…"
              className="flex-1 bg-white border border-gray-400 rounded-md px-4 py-2.5 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-white border border-gray-400 rounded-md px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={loading}
              className="bg-slate-800 text-white text-sm font-semibold px-6 py-2.5 rounded-md hover:bg-slate-900 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </form>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          <div className="text-xs font-medium text-gray-600 mb-2">
            {loading ? 'Loading…' : `${total} proposal${total === 1 ? '' : 's'}`}
          </div>

          <div className="w-full overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
            <table className="min-w-[1000px] w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Offer #</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Company</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Project</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Updated</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                      No proposals found.
                    </td>
                  </tr>
                )}
                {rows.map((p) => {
                  const statusKey = (p.proposal_status || 'draft').toLowerCase();
                  const statusStyle =
                    STATUS_STYLES[statusKey] || 'bg-gray-100 text-gray-800 border-gray-300';
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                        {p.offer_number}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-xs truncate" title={p.company_name || ''}>
                        {p.company_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={p.project_name || p.project_number || ''}>
                        {p.project_name || p.project_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-semibold tabular-nums whitespace-nowrap">
                        {formatMoney(p.total_price, p.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-semibold capitalize ${statusStyle}`}
                        >
                          {p.proposal_status || 'draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {formatDate(p.updated_at || p.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setViewOffer(p.offer_number)}
                            className="text-slate-700 hover:text-white hover:bg-slate-700 border border-slate-300 rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                          >
                            View
                          </button>
                          <Link
                            href={`/proposals/${encodeURIComponent(p.offer_number)}/edit`}
                            className="bg-slate-800 text-white hover:bg-slate-900 rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewOffer && (
        <ProposalModal offerNumber={viewOffer} onClose={() => setViewOffer(null)} />
      )}
    </div>
  );
}

function ProposalModal({
  offerNumber,
  onClose,
}: {
  offerNumber: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proposals/${encodeURIComponent(offerNumber)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load proposal');
        if (!cancelled) setData(json.proposal);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerNumber]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const statusKey = (data?.proposal_status || 'draft').toLowerCase();
  const statusStyle =
    STATUS_STYLES[statusKey] || 'bg-gray-100 text-gray-800 border-gray-300';

  const address = data
    ? [data.street_no, [data.postal_code, data.city].filter(Boolean).join(' '), data.country]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-start justify-between rounded-t-xl">
          <div>
            <div className="text-white/70 text-xs uppercase tracking-wider">Proposal</div>
            <div className="text-white text-xl font-semibold font-mono mt-0.5">{offerNumber}</div>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold capitalize ${statusStyle}`}
              >
                {data.proposal_status || 'draft'}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-white/80 hover:text-white text-2xl leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
          {loading && <div className="text-gray-500 py-8 text-center">Loading…</div>}
          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-sm rounded">
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6">
              {/* Client */}
              <Section title="Client">
                <DetailGrid>
                  <Detail label="Company" value={data.company_name || '—'} />
                  <Detail label="Client ID" value={data.client_id?.toString() || '—'} />
                  <Detail label="Address" value={address || '—'} wide />
                </DetailGrid>
              </Section>

              {/* Project */}
              <Section title="Project">
                <DetailGrid>
                  <Detail label="Project name" value={data.project_name || '—'} />
                  <Detail label="Project number" value={data.project_number || '—'} />
                  <Detail label="Project type" value={data.project_type || '—'} />
                  <Detail label="Proposal date" value={formatDay(data.proposal_date)} />
                  <Detail label="Valid until" value={formatDay(data.offer_valid_until)} />
                  <Detail
                    label="Delivery"
                    value={
                      data.delivery_time_min && data.delivery_time_max
                        ? `${data.delivery_time_min}–${data.delivery_time_max} Werktage`
                        : '—'
                    }
                  />
                </DetailGrid>
              </Section>

              {/* Services */}
              <Section title={`Services (${data.services?.length ?? 0})`}>
                {data.services && data.services.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Service</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Qty</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Unit</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.services.map((s, i) => (
                          <tr key={`${s.id}-${i}`}>
                            <td className="px-3 py-2 text-gray-900">{s.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                              {s.quantity}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                              {formatMoney(Number(s.unitPrice) || 0)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">
                              {formatMoney(Number(s.totalPrice) || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No services on this proposal.</div>
                )}
              </Section>

              {/* Pricing */}
              <Section title="Pricing">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
                  <Row label="Subtotal (net)" value={formatMoney(data.pricing?.subtotalNet)} />
                  {data.pricing?.discount?.amount ? (
                    <Row
                      label={`Discount${
                        data.pricing.discount.description
                          ? ` — ${data.pricing.discount.description}`
                          : ''
                      }`}
                      value={`− ${formatMoney(data.pricing.discount.amount)}`}
                    />
                  ) : null}
                  <Row label="Total (net)" value={formatMoney(data.pricing?.totalNetPrice)} />
                  <Row label="VAT (19%)" value={formatMoney(data.pricing?.totalVat)} />
                  <div className="border-t border-gray-300 my-2" />
                  <Row
                    label="Total (gross)"
                    value={formatMoney(data.pricing?.totalGrossPrice ?? data.total_price, data.currency)}
                    bold
                  />
                </div>
              </Section>

              {/* Documents */}
              <Section title="Documents">
                {data.document_url?.pdf || data.document_url?.docx ? (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                    {data.document_url?.pdf && (
                      <a
                        href={data.document_url.pdf}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 font-medium underline underline-offset-2 hover:text-blue-900"
                      >
                        View PDF in new tab ↗
                      </a>
                    )}
                    {data.document_url?.docx && (
                      <a
                        href={data.document_url.docx}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 font-medium underline underline-offset-2 hover:text-blue-900"
                      >
                        Download DOCX ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No generated documents linked.
                  </div>
                )}
              </Section>

              <div className="text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1 pt-2 border-t border-gray-100">
                <span>Created: {formatDate(data.created_at)}</span>
                <span>Updated: {formatDate(data.updated_at)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3 rounded-b-xl bg-gray-50">
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 text-sm font-medium px-4 py-2"
          >
            Close
          </button>
          <Link
            href={`/proposals/${encodeURIComponent(offerNumber)}/edit`}
            className="bg-slate-800 text-white text-sm font-semibold px-5 py-2 rounded-md hover:bg-slate-900 transition-colors"
          >
            Edit proposal →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5 break-words">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between items-center ${
        bold ? 'font-semibold text-gray-900' : 'text-gray-700'
      }`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
