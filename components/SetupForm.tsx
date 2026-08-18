'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useProposal } from '@/contexts/ProposalContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  CONSTRUCTION_TYPE_OPTIONS,
  PM_TYPE_OPTIONS,
  PROJECT_MANAGERS,
  PROJECT_TYPE_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '@/lib/project-enums';

/**
 * The "extra information" form, embedded at the top of the edit page (above the
 * document). Binds to ProposalContext, validates all required fields, and marks
 * the proposal ready — which is what enables document generation.
 */
export default function SetupForm() {
  const { showNotification } = useNotification();
  const {
    state,
    updateClientInfo,
    updateProjectInfo,
    updateOfferMeta,
    getSetupErrors,
    saveToStorage,
  } = useProposal();

  const { clientInfo, projectInfo, offerMeta } = state;
  const isReady = offerMeta?.isReady ?? false;

  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lookupState, setLookupState] = useState<'idle' | 'loading'>('idle');
  const [saving, setSaving] = useState(false);
  // Collapsed once the proposal is ready, to keep the document in focus.
  const [collapsed, setCollapsed] = useState(isReady);

  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const registerRef = (id: string) => (el: HTMLElement | null) => {
    fieldRefs.current[id] = el;
  };

  // Default the salesperson to the logged-in user — "Lidia" when she is signed
  // in — unless a value is already present.
  useEffect(() => {
    if (offerMeta.salespersonName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me');
        const json = await res.json();
        if (cancelled || !json?.success || !json.user?.name) return;
        updateOfferMeta({ salespersonName: json.user.name });
      } catch {
        /* leave blank; the field is required and user can type it */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearError = (id: string) =>
    setErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const revalidate = () => {
    if (submitted) setErrors(getSetupErrors());
  };

  const handleLookup = useCallback(async () => {
    const id = clientInfo.clientNumber?.trim();
    if (!id) {
      setErrors((p) => ({ ...p, clientNumber: 'Kunden-ID ist erforderlich' }));
      return;
    }
    setLookupState('loading');
    try {
      const res = await fetch(`/api/client-lookup/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (json?.success && json.data) {
        const c = json.data;
        updateClientInfo({
          companyName: c.company_name || clientInfo.companyName,
          street: c.street_no || c.street || clientInfo.street,
          postalCode: c.postal_code || clientInfo.postalCode,
          city: c.city || clientInfo.city,
          contactPersonName: c.contact_name || clientInfo.contactPersonName,
          contactPersonEmail: c.contact_email || clientInfo.contactPersonEmail,
        });
        showNotification(`✓ ${c.company_name || 'Kunde gefunden'}`, 'success');
      } else {
        showNotification('⚠ Kunde nicht gefunden — bitte Daten manuell ergänzen', 'info');
      }
    } catch {
      showNotification('⚠ Fehler bei der Kundensuche', 'error');
    } finally {
      setLookupState('idle');
    }
  }, [clientInfo, updateClientInfo, showNotification]);

  // Marking ready is what creates the project in the database, so the flag is
  // only set once that write succeeds — otherwise the user could carry on
  // believing the project exists when it does not.
  const handleMarkAsReady = async () => {
    setSubmitted(true);
    const found = getSetupErrors();
    setErrors(found);
    const ids = Object.keys(found);
    if (ids.length > 0) {
      const first = ids[0];
      const el = fieldRefs.current[first];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus?.();
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientInfo, projectInfo, offerMeta }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Projekt konnte nicht gespeichert werden');
      }

      updateOfferMeta({ isReady: true });
      saveToStorage();
      setCollapsed(true);
      showNotification(
        json.created
          ? `Angebot als bereit markiert — Projekt ${projectInfo.projectNumber} angelegt`
          : `Angebot als bereit markiert — Projekt ${projectInfo.projectNumber} aktualisiert`,
        'success'
      );
      if (!json.emailMatched) {
        showNotification(
          'Hinweis: Die E-Mail des Ansprechpartners ist keinem Kontakt zugeordnet — das Projekt wurde ohne Kontaktverknüpfung angelegt.',
          'info'
        );
      }
    } catch (e) {
      showNotification(
        `Projekt konnte nicht angelegt werden: ${e instanceof Error ? e.message : String(e)}`,
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const errorList = Object.entries(errors);

  return (
    <section
      id="extra-info-form"
      className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm [font-family:var(--font-manrope)] scroll-mt-24"
    >
      {/* Card header with ready status + collapse toggle */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              isReady
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {isReady ? 'Bereit' : 'Entwurf'}
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">Zusätzliche Informationen</h2>
            <p className="text-xs text-slate-500 truncate">
              {isReady
                ? 'Alle Pflichtangaben erfasst — das Dokument kann erstellt werden.'
                : 'Pflichtangaben, bevor das Angebot als bereit markiert werden kann.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          {collapsed ? 'Bearbeiten' : 'Einklappen'}
        </button>
      </div>

      {!collapsed && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleMarkAsReady();
          }}
          className="p-5"
        >
          {/* CLIENT */}
          <Group label="Kunde">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Kunden-ID" required error={errors.clientNumber}>
                <div className="flex gap-2">
                  <input
                    ref={registerRef('clientNumber') as any}
                    value={clientInfo.clientNumber}
                    onChange={(e) => {
                      updateClientInfo({ clientNumber: e.target.value });
                      clearError('clientNumber');
                    }}
                    onBlur={revalidate}
                    placeholder="z. B. 10432"
                    className={inputCls(errors.clientNumber)}
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupState === 'loading'}
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {lookupState === 'loading' ? '…' : 'Suchen'}
                  </button>
                </div>
                {clientInfo.companyName && (
                  <p className="mt-1 text-xs text-slate-500">↳ {clientInfo.companyName}</p>
                )}
              </Field>

              <Field label="Ansprechpartner" required error={errors.contactPersonName}>
                <input
                  ref={registerRef('contactPersonName') as any}
                  value={clientInfo.contactPersonName}
                  onChange={(e) => {
                    updateClientInfo({ contactPersonName: e.target.value });
                    clearError('contactPersonName');
                  }}
                  onBlur={revalidate}
                  placeholder="Vor- und Nachname"
                  className={inputCls(errors.contactPersonName)}
                />
              </Field>

              <Field label="E-Mail des Ansprechpartners" required error={errors.contactPersonEmail} wide>
                <input
                  ref={registerRef('contactPersonEmail') as any}
                  type="email"
                  value={clientInfo.contactPersonEmail}
                  onChange={(e) => {
                    updateClientInfo({ contactPersonEmail: e.target.value });
                    clearError('contactPersonEmail');
                  }}
                  onBlur={revalidate}
                  placeholder="name@firma.de"
                  className={inputCls(errors.contactPersonEmail)}
                />
              </Field>
            </div>
          </Group>

          {/* PROJECT */}
          <Group label="Projekt">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Projekt-ID" required error={errors.projectNumber}>
                <input
                  ref={registerRef('projectNumber') as any}
                  value={projectInfo.projectNumber}
                  onChange={(e) => {
                    updateProjectInfo({ projectNumber: e.target.value });
                    clearError('projectNumber');
                  }}
                  onBlur={revalidate}
                  placeholder="z. B. P-2026-118"
                  className={inputCls(errors.projectNumber)}
                />
              </Field>

              <Field label="Projektname" required error={errors.projectName}>
                <input
                  ref={registerRef('projectName') as any}
                  value={projectInfo.projectName}
                  onChange={(e) => {
                    updateProjectInfo({ projectName: e.target.value });
                    clearError('projectName');
                  }}
                  onBlur={revalidate}
                  placeholder="z. B. Wohnpark Seeblick"
                  className={inputCls(errors.projectName)}
                />
              </Field>

              <Field label="Property Type" required error={errors.propertyType}>
                <select
                  ref={registerRef('propertyType') as any}
                  value={projectInfo.propertyType}
                  onChange={(e) => {
                    updateProjectInfo({ propertyType: e.target.value });
                    clearError('propertyType');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.propertyType)}
                >
                  <option value="">Bitte wählen…</option>
                  {PROPERTY_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Projektleiter" required error={errors.projectManagerName}>
                <select
                  ref={registerRef('projectManagerName') as any}
                  value={projectInfo.projectManagerName}
                  onChange={(e) => {
                    updateProjectInfo({ projectManagerName: e.target.value });
                    clearError('projectManagerName');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.projectManagerName)}
                >
                  <option value="">Bitte wählen…</option>
                  {PROJECT_MANAGERS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {/* An older project may carry a manager who is no longer on the
                      list — keep it selectable so opening it does not blank it. */}
                  {projectInfo.projectManagerName &&
                    !PROJECT_MANAGERS.includes(projectInfo.projectManagerName as any) && (
                      <option value={projectInfo.projectManagerName}>
                        {projectInfo.projectManagerName}
                      </option>
                    )}
                </select>
              </Field>

              <Field label="Project Type" required error={errors.projectCategory}>
                <select
                  ref={registerRef('projectCategory') as any}
                  value={projectInfo.projectCategory}
                  onChange={(e) => {
                    updateProjectInfo({ projectCategory: e.target.value });
                    clearError('projectCategory');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.projectCategory)}
                >
                  <option value="">Bitte wählen…</option>
                  {PROJECT_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Construction Type" required error={errors.constructionType}>
                <select
                  ref={registerRef('constructionType') as any}
                  value={projectInfo.constructionType}
                  onChange={(e) => {
                    updateProjectInfo({ constructionType: e.target.value });
                    clearError('constructionType');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.constructionType)}
                >
                  <option value="">Bitte wählen…</option>
                  {CONSTRUCTION_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Auftragsbestätigungsdatum" required error={errors.orderConfirmationDate}>
                <input
                  ref={registerRef('orderConfirmationDate') as any}
                  type="date"
                  value={projectInfo.orderConfirmationDate}
                  onChange={(e) => {
                    updateProjectInfo({ orderConfirmationDate: e.target.value });
                    clearError('orderConfirmationDate');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.orderConfirmationDate)}
                />
              </Field>

              <Field label="Art des Projektleiters" required error={errors.projectManagerType}>
                <select
                  ref={registerRef('projectManagerType') as any}
                  value={projectInfo.projectManagerType}
                  onChange={(e) => {
                    updateProjectInfo({ projectManagerType: e.target.value });
                    clearError('projectManagerType');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.projectManagerType)}
                >
                  <option value="">Bitte wählen…</option>
                  {PM_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Group>

          {/* OFFER */}
          <Group label="Angebot">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Vertriebsmitarbeiter" required error={errors.salespersonName}>
                <input
                  ref={registerRef('salespersonName') as any}
                  value={offerMeta.salespersonName}
                  onChange={(e) => {
                    updateOfferMeta({ salespersonName: e.target.value });
                    clearError('salespersonName');
                  }}
                  onBlur={revalidate}
                  placeholder="Name"
                  className={inputCls(errors.salespersonName)}
                />
              </Field>

              <Field label="Datum" required error={errors.date}>
                <input
                  ref={registerRef('date') as any}
                  type="date"
                  value={projectInfo.date}
                  onChange={(e) => {
                    const iso = e.target.value;
                    const d = iso ? new Date(iso) : null;
                    updateProjectInfo({
                      date: iso,
                      MM: d ? String(d.getMonth() + 1).padStart(2, '0') : projectInfo.MM,
                      DD: d ? String(d.getDate()).padStart(2, '0') : projectInfo.DD,
                      year: d ? String(d.getFullYear()) : projectInfo.year,
                    });
                    clearError('date');
                  }}
                  onBlur={revalidate}
                  className={inputCls(errors.date)}
                />
              </Field>

              <Field label="Teilrechnung" required error={errors.partialInvoice} wide>
                <div ref={registerRef('partialInvoice') as any} tabIndex={-1} className="flex flex-wrap items-center gap-2">
                  <Toggle
                    active={offerMeta.partialInvoice.answered && offerMeta.partialInvoice.enabled}
                    onClick={() => {
                      updateOfferMeta({ partialInvoice: { answered: true, enabled: true } });
                      clearError('partialInvoice');
                    }}
                    label="Ja"
                  />
                  <Toggle
                    active={offerMeta.partialInvoice.answered && !offerMeta.partialInvoice.enabled}
                    onClick={() => {
                      updateOfferMeta({
                        partialInvoice: { answered: true, enabled: false, invoiceNumber: '', note: '' },
                      });
                      clearError('partialInvoice');
                    }}
                    label="Nein"
                  />
                </div>
                {offerMeta.partialInvoice.answered && offerMeta.partialInvoice.enabled && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={offerMeta.partialInvoice.invoiceNumber}
                      onChange={(e) => {
                        updateOfferMeta({ partialInvoice: { invoiceNumber: e.target.value } });
                        clearError('partialInvoice');
                      }}
                      onBlur={revalidate}
                      placeholder="Teilrechnungsnummer"
                      className={inputCls(errors.partialInvoice)}
                    />
                    <input
                      value={offerMeta.partialInvoice.note}
                      onChange={(e) => updateOfferMeta({ partialInvoice: { note: e.target.value } })}
                      placeholder="Notiz (optional)"
                      className={inputCls(undefined)}
                    />
                  </div>
                )}
              </Field>
            </div>
          </Group>

          {/* Validation summary */}
          {submitted && errorList.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                {errorList.length} {errorList.length === 1 ? 'Feld benötigt' : 'Felder benötigen'} noch Angaben,
                bevor das Angebot als bereit markiert werden kann.
              </p>
              <ul className="mt-2 space-y-1">
                {errorList.map(([id, msg]) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        const el = fieldRefs.current[id];
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el?.focus?.();
                      }}
                      className="text-sm text-red-700 underline underline-offset-2 hover:text-red-900"
                    >
                      {msg}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                isReady ? 'bg-[#00214D] hover:bg-[#01183a]' : 'bg-[#AF2C32] hover:bg-[#962228]'
              }`}
            >
              {saving
                ? 'Projekt wird gespeichert…'
                : isReady
                  ? 'Angaben aktualisieren'
                  : 'Als bereit markieren'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ---------- small presentational helpers ---------- */

const inputCls = (err?: string) =>
  `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 ${
    err
      ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
      : 'border-slate-300 focus:ring-slate-700 focus:border-slate-700'
  }`;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-[#AF2C32]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}
