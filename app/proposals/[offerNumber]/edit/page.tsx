'use client';

// Loader for editing a saved proposal. The dedicated editor lives at /edit and
// reads from ProposalContext, so this route fetches the stored proposal, hydrates
// the context, and forwards to /edit. (The old standalone edit screen is retired.)

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProposal } from '@/contexts/ProposalContext';

const fmtGermanDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function EditProposalLoader() {
  const params = useParams<{ offerNumber: string }>();
  const offerNumber = decodeURIComponent(params.offerNumber);
  const router = useRouter();
  const { updateClientInfo, updateProjectInfo, updateOfferMeta, setRawProposalData } = useProposal();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/proposals/${encodeURIComponent(offerNumber)}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Angebot konnte nicht geladen werden');
        if (cancelled) return;

        const p = json.proposal;
        const ready = (p.proposal_status || 'draft').toLowerCase() !== 'draft';

        // Hydrate context so the Setup form shows the saved values too.
        updateClientInfo({
          clientNumber: p.client_id != null ? String(p.client_id) : '',
          companyName: p.company_name || '',
          street: p.street_no || '',
          postalCode: p.postal_code || '',
          city: p.city || '',
          country: p.country || 'Deutschland',
        });
        updateProjectInfo({
          projectNumber: p.project_number || '',
          projectName: p.project_name || '',
          projectType: p.project_type || '',
          offerValidUntil: p.offer_valid_until || '',
          deliveryTime:
            p.delivery_time_min && p.delivery_time_max
              ? `${p.delivery_time_min}-${p.delivery_time_max}`
              : '',
        });
        updateOfferMeta({ isReady: ready });

        // Build the raw payload the editor renders. `offerNumber` is carried
        // through so the editor shows the number of the proposal being edited
        // instead of allocating the next free one.
        setRawProposalData({
          offerNumber,
          clientInfo: {
            companyName: p.company_name || '',
            street: p.street_no || '',
            postalCode: p.postal_code || '',
            city: p.city || '',
            country: p.country || 'Deutschland',
          },
          projectInfo: {
            projectNumber: p.project_number || '',
            projectName: p.project_name || '',
            projectType: p.project_type || '',
            offerValidUntil: p.offer_valid_until || '',
            date: fmtGermanDate(p.proposal_date),
            deliveryTime:
              p.delivery_time_min && p.delivery_time_max
                ? `${p.delivery_time_min}-${p.delivery_time_max}`
                : '',
          },
          services: p.services || [],
          images: [],
          pricing: p.pricing || {
            subtotalNet: '0,00',
            totalNetPrice: '0,00',
            totalVat: '0,00',
            totalGrossPrice: '0,00',
          },
          signature: { signatureName: 'Christopher Helm' },
        });

        // The extra-information form is embedded at the top of the editor.
        router.replace('/edit');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerNumber]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 [font-family:var(--font-manrope)]">
      {error ? (
        <div className="text-center">
          <div className="text-red-600 font-semibold mb-2">{error}</div>
          <Link href="/proposals" className="text-sm text-slate-600 underline">
            ← Zurück zur Übersicht
          </Link>
        </div>
      ) : (
        <>
          <div className="w-[280px] h-[180px] rounded-sm bg-white border border-gray-200 shadow-sm animate-pulse mb-6" />
          <div className="text-gray-500 text-sm tracking-wide">Angebot {offerNumber} wird geladen …</div>
        </>
      )}
    </div>
  );
}
