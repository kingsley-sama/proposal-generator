'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ContactInfo {
  companyName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
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
  [k: string]: any;
}

interface DiscountInfo {
  type: 'percentage' | 'fixed' | '';
  value: number;
  amount?: number;
  description: string;
}

interface PricingData {
  subtotalNet: number;
  discountAmount: number;
  totalNetPrice: number;
  totalVat: number;
  totalGrossPrice: number;
  discount?: DiscountInfo;
}

interface ProposalRow {
  id: number;
  offer_number: string;
  client_id: number | null;
  company_name: string;
  street_no: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  project_number: string | null;
  project_name: string | null;
  project_type: string | null;
  proposal_date: string | null;
  offer_valid_until: string | null;
  delivery_time_min: number | null;
  delivery_time_max: number | null;
  services: ServiceData[] | null;
  pricing: PricingData | null;
  total_price: number | null;
  currency: string | null;
  proposal_status: string | null;
  document_url: { docx?: string; pdf?: string; folder?: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

const VAT_RATE = 0.19;

const formatMoney = (n: number) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export default function EditProposalPage() {
  const params = useParams<{ offerNumber: string }>();
  const offerNumber = decodeURIComponent(params.offerNumber);

  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [contact, setContact] = useState<ContactInfo>({
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
  });
  const [services, setServices] = useState<ServiceData[]>([]);
  const [discount, setDiscount] = useState<DiscountInfo>({
    type: '',
    value: 0,
    description: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'idle' | 'db' | 'regen' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proposals/${encodeURIComponent(offerNumber)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load proposal');
        if (cancelled) return;
        const p: ProposalRow = json.proposal;
        setProposal(p);
        setContact({
          companyName: p.company_name || '',
          street: p.street_no || '',
          postalCode: p.postal_code || '',
          city: p.city || '',
          country: p.country || 'Deutschland',
        });
        setServices(Array.isArray(p.services) ? p.services : []);
        const d = p.pricing?.discount;
        setDiscount({
          type: (d?.type as any) || '',
          value: Number(d?.value) || 0,
          description: d?.description || '',
        });
        setDirty(false);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerNumber]);

  const pricing: PricingData = useMemo(() => {
    const subtotalNet = services.reduce((sum, s) => sum + (Number(s.totalPrice) || 0), 0);
    let discountAmount = 0;
    if (discount.type === 'percentage' && discount.value > 0) {
      discountAmount = subtotalNet * (discount.value / 100);
    } else if (discount.type === 'fixed' && discount.value > 0) {
      discountAmount = discount.value;
    }
    const totalNetPrice = Math.max(0, subtotalNet - discountAmount);
    const totalVat = totalNetPrice * VAT_RATE;
    const totalGrossPrice = totalNetPrice + totalVat;
    return {
      subtotalNet,
      discountAmount,
      totalNetPrice,
      totalVat,
      totalGrossPrice,
      discount: discount.type ? { ...discount, amount: discountAmount } : undefined,
    };
  }, [services, discount]);

  const markDirty = () => setDirty(true);

  const updateContact = (patch: Partial<ContactInfo>) => {
    setContact((prev) => ({ ...prev, ...patch }));
    markDirty();
  };

  const updateServiceQuantity = (idx: number, qty: number) => {
    setServices((prev) => {
      const next = [...prev];
      const s = { ...next[idx] };
      s.quantity = Math.max(0, qty);
      if (s.customPrice && s.customPrice > 0) {
        s.totalPrice = s.customPrice * s.quantity;
      } else {
        s.totalPrice = (Number(s.unitPrice) || 0) * s.quantity;
      }
      next[idx] = s;
      return next;
    });
    markDirty();
  };

  const updateServiceCustomPrice = (idx: number, customPrice: number) => {
    setServices((prev) => {
      const next = [...prev];
      const s = { ...next[idx] };
      if (customPrice > 0) {
        s.customPrice = customPrice;
        s.unitPrice = customPrice;
        s.totalPrice = customPrice * (s.quantity || 0);
      } else {
        delete s.customPrice;
      }
      next[idx] = s;
      return next;
    });
    markDirty();
  };

  const removeService = (idx: number) => {
    if (!confirm('Remove this service from the proposal?')) return;
    setServices((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const persist = useCallback(
    async (opts: { regenerate: boolean }) => {
      setError(null);
      setInfo(null);
      setSaving(opts.regenerate ? 'regen' : 'db');
      try {
        const res = await fetch(`/api/proposals/${encodeURIComponent(offerNumber)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientInfo: contact,
            services,
            pricing,
            regenerate: opts.regenerate,
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Save failed');
        setProposal(json.proposal);
        setDirty(false);
        setInfo(
          opts.regenerate
            ? json.regenerateNote || 'Saved and regenerated documents.'
            : 'Changes saved.'
        );
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving('idle');
      }
    },
    [offerNumber, contact, services, pricing]
  );

  const markReady = useCallback(async () => {
    if (dirty) {
      if (!confirm('You have unsaved changes. Mark as ready anyway? (Unsaved changes will be lost in the regen.)'))
        return;
    }
    setError(null);
    setInfo(null);
    setSaving('ready');
    try {
      const res = await fetch(`/api/proposals/${encodeURIComponent(offerNumber)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to update status');
      setProposal(json.proposal);
      setInfo('Marked as ready. Downstream automation can now pick this up.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving('idle');
    }
  }, [offerNumber, dirty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center [font-family:var(--font-manrope)]">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-slate-700 rounded-full animate-spin mb-4" />
        <div className="text-gray-600 text-sm">Loading proposal…</div>
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4 [font-family:var(--font-manrope)]">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <div className="text-red-700">{error}</div>
          <Link href="/proposals" className="mt-4 inline-block text-slate-800 hover:underline">
            ← Back to proposals
          </Link>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const status = proposal.proposal_status || 'draft';
  const isReady = status === 'ready';

  return (
    <div className="min-h-screen bg-gray-100 [font-family:var(--font-manrope)]">
      {/* Header band */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg">
        <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-6 flex items-start justify-between gap-4">
          <div>
            <Link href="/proposals" className="text-white/60 hover:text-white text-xs font-medium">
              ← All proposals
            </Link>
            <h1 className="text-white text-2xl font-bold mt-1 flex items-center gap-3 flex-wrap">
              Edit proposal{' '}
              <span className="font-mono text-lg font-normal text-white/80">{proposal.offer_number}</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-white text-xs font-semibold capitalize">
                <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-300'}`} aria-hidden />
                {status}
              </span>
            </h1>
          </div>
          {proposal.document_url?.pdf && (
            <a
              href={proposal.document_url.pdf}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-white/90 hover:text-white hover:border-white/60 text-sm border border-white/30 rounded-md px-4 py-2 transition-colors"
            >
              Open current PDF ↗
            </a>
          )}
        </div>
      </div>

      <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-8">
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
            {info}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
        {/* Main column */}
        <div className="space-y-6 min-w-0">
          {/* Locked metadata */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Locked fields (not editable here)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <Field label="Client ID" value={proposal.client_id?.toString() || '—'} />
              <Field label="Project number" value={proposal.project_number || '—'} />
              <Field label="Project name" value={proposal.project_name || '—'} />
              <Field label="Project type" value={proposal.project_type || '—'} />
              <Field label="Proposal date" value={formatDate(proposal.proposal_date)} />
              <Field label="Valid until" value={formatDate(proposal.offer_valid_until)} />
              <Field
                label="Delivery"
                value={
                  proposal.delivery_time_min && proposal.delivery_time_max
                    ? `${proposal.delivery_time_min}–${proposal.delivery_time_max} Werktage`
                    : '—'
                }
              />
              <Field label="Created" value={formatDate(proposal.created_at)} />
              <Field label="Updated" value={formatDate(proposal.updated_at)} />
            </div>
          </section>

          {/* Contact info */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Contact info
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LabeledInput
                label="Company name"
                value={contact.companyName}
                onChange={(v) => updateContact({ companyName: v })}
              />
              <LabeledInput
                label="Street"
                value={contact.street}
                onChange={(v) => updateContact({ street: v })}
              />
              <LabeledInput
                label="Postal code"
                value={contact.postalCode}
                onChange={(v) => updateContact({ postalCode: v })}
              />
              <LabeledInput
                label="City"
                value={contact.city}
                onChange={(v) => updateContact({ city: v })}
              />
              <LabeledInput
                label="Country"
                value={contact.country}
                onChange={(v) => updateContact({ country: v })}
              />
            </div>
          </section>

          {/* Services */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Services ({services.length})
            </h2>
            {services.length === 0 ? (
              <div className="text-sm text-gray-500 italic">No services on this proposal.</div>
            ) : (
              <div className="space-y-3">
                {services.map((s, idx) => (
                  <div
                    key={`${s.id}-${idx}`}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50/60 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-700 mt-0.5 font-mono">{s.id}</div>
                        {(s.buildingType || s.apartmentSize || s.projectType || s.areaSize) && (
                          <div className="text-xs text-gray-700 mt-1 flex flex-wrap gap-x-3">
                            {s.buildingType && <span>Building: {s.buildingType}</span>}
                            {s.apartmentSize && <span>Apartment: {s.apartmentSize}</span>}
                            {s.projectType && <span>Project: {s.projectType}</span>}
                            {s.areaSize && <span>Area: {s.areaSize}</span>}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeService(idx)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={s.quantity}
                          onChange={(e) =>
                            updateServiceQuantity(idx, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">
                          Custom unit price (€)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={s.customPrice ?? ''}
                          placeholder={String(s.unitPrice || 0)}
                          onChange={(e) =>
                            updateServiceCustomPrice(idx, parseFloat(e.target.value) || 0)
                          }
                          className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Line total</label>
                        <div className="px-3 py-2 bg-gray-100 border border-gray-400 rounded-md text-sm font-semibold text-gray-900 tabular-nums">
                          {formatMoney(Number(s.totalPrice) || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-700 mt-3 italic">
              To add a new service, use the new-proposal form. This page only edits existing
              services on a previously generated proposal.
            </p>
          </section>

        </div>

        {/* Sidebar: pricing + actions */}
        <aside className="space-y-6 lg:sticky lg:top-8">
          {/* Pricing */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Pricing
            </h2>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-700 mb-1">Discount type</label>
                <select
                  value={discount.type}
                  onChange={(e) => {
                    setDiscount((prev) => ({ ...prev, type: e.target.value as any }));
                    markDirty();
                  }}
                  className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                >
                  <option value="">No discount</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Value</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount.value || ''}
                  disabled={!discount.type}
                  onChange={(e) => {
                    setDiscount((prev) => ({ ...prev, value: parseFloat(e.target.value) || 0 }));
                    markDirty();
                  }}
                  className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={discount.description}
                  disabled={!discount.type}
                  onChange={(e) => {
                    setDiscount((prev) => ({ ...prev, description: e.target.value }));
                    markDirty();
                  }}
                  className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1.5 text-sm">
              <Row label="Subtotal (net)" value={formatMoney(pricing.subtotalNet)} />
              {pricing.discountAmount > 0 && (
                <Row
                  label={`Discount${discount.description ? ` — ${discount.description}` : ''}`}
                  value={`− ${formatMoney(pricing.discountAmount)}`}
                />
              )}
              <Row label="Total (net)" value={formatMoney(pricing.totalNetPrice)} />
              <Row label="VAT (19%)" value={formatMoney(pricing.totalVat)} />
              <div className="border-t border-gray-300 my-2" />
              <Row
                label="Total (gross)"
                value={formatMoney(pricing.totalGrossPrice)}
                bold
              />
            </div>
          </section>

          {/* Actions */}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Actions
            </h2>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => persist({ regenerate: false })}
                disabled={saving !== 'idle' || !dirty}
                className="w-full bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {saving === 'db' ? 'Saving…' : dirty ? 'Save changes' : 'No unsaved changes'}
              </button>
              <button
                onClick={() => persist({ regenerate: true })}
                disabled={saving !== 'idle'}
                className="w-full bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                title="Save changes and regenerate the .docx + PDF in storage"
              >
                {saving === 'regen' ? 'Regenerating…' : 'Save & regenerate documents'}
              </button>
              {isReady ? (
                <div className="w-full text-center text-emerald-700 bg-emerald-50 border border-emerald-200 text-sm font-medium px-5 py-2.5 rounded-lg">
                  ✓ Marked as ready
                </div>
              ) : (
                <button
                  onClick={markReady}
                  disabled={saving !== 'idle'}
                  className="w-full bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {saving === 'ready' ? 'Marking…' : 'Mark as ready'}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-4 leading-relaxed">
              <strong className="text-gray-700">Save changes</strong> updates the DB row only.{' '}
              <strong className="text-gray-700">Save & regenerate</strong> also rebuilds the .docx + PDF in storage (the n8n
              webhook is <em>not</em> re-fired). Images from the original proposal are not
              re-included on regenerate. <strong className="text-gray-700">Mark as ready</strong> sets{' '}
              <code className="bg-gray-100 px-1 rounded">proposal_status = &apos;ready&apos;</code>{' '}
              so downstream automation can pick it up.
            </p>
          </section>
        </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-700">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5 break-words">{value}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-400 rounded-md px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-700 focus:border-slate-700"
      />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
