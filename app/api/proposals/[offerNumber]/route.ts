import { NextResponse } from 'next/server';
import { promisify } from 'util';
// @ts-ignore
import libreConvert from 'libreoffice-convert';
// @ts-ignore
import TemplateDocxProposalGenerator from '@/lib/template-docx-generator';
// @ts-ignore
import { getProposalByOfferNumber, updateProposal, uploadProposalFiles } from '@/lib/utils';
import { calculateDeliveryTime } from '@/utils/deliveryTime';

const libreConvertAsync = promisify(libreConvert.convert);

export const runtime = 'nodejs';

type RouteCtx = { params: Promise<{ offerNumber: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const { offerNumber } = await ctx.params;
    const row = await getProposalByOfferNumber(decodeURIComponent(offerNumber));
    if (!row) {
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, proposal: row });
  } catch (error: any) {
    console.error('❌ Error fetching proposal:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

const sanitize = (str: string) =>
  str ? String(str).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) : 'unknown';

const moneyToNumber = (input: unknown): number | null => {
  if (input == null) return null;
  if (typeof input === 'number') return input;
  const cleaned = String(input).replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const { offerNumber: rawOffer } = await ctx.params;
    const offerNumber = decodeURIComponent(rawOffer);

    const existing = await getProposalByOfferNumber(offerNumber);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 });
    }

    const body = await request.json();
    const { clientInfo, services, pricing, regenerate } = body || {};

    if (!clientInfo || !services || !pricing) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: clientInfo, services, pricing' },
        { status: 400 }
      );
    }

    const delivery = calculateDeliveryTime(services);

    const patch: Record<string, any> = {
      company_name: clientInfo.companyName ?? existing.company_name,
      street_no: clientInfo.street ?? existing.street_no,
      city: clientInfo.city ?? existing.city,
      postal_code: clientInfo.postalCode ?? existing.postal_code,
      country: clientInfo.country ?? existing.country,
      services,
      pricing: {
        subtotalNet: pricing.subtotalNet,
        totalNetPrice: pricing.totalNetPrice,
        totalVat: pricing.totalVat,
        totalGrossPrice: pricing.totalGrossPrice,
        discount: pricing.discount ?? null,
      },
      discount_type: pricing.discount?.type || null,
      discount_value: pricing.discount?.value != null ? Number(pricing.discount.value) || null : null,
      total_price: moneyToNumber(pricing.totalGrossPrice),
      delivery_time_min: delivery.deliveryDaysMin || null,
      delivery_time_max: delivery.deliveryDaysMax || null,
    };

    let regenerateNote: string | null = null;

    if (regenerate) {
      const folderFromDoc = existing.document_url?.folder as string | undefined;
      const clientFolderName =
        folderFromDoc?.split('/')[0] ||
        `${sanitize(String(existing.client_id ?? ''))}_${sanitize(existing.company_name)}`;
      const storageFolderPath = `${clientFolderName}/${offerNumber}`;

      const offerDate: string | undefined =
        existing.proposal_date || existing.created_at || undefined;
      let dateStr = '';
      let MM = '01';
      let DD = '01';
      let year = String(new Date().getFullYear());
      if (offerDate) {
        const d = new Date(offerDate);
        if (!Number.isNaN(d.getTime())) {
          year = String(d.getFullYear());
          MM = String(d.getMonth() + 1).padStart(2, '0');
          DD = String(d.getDate()).padStart(2, '0');
          dateStr = `${DD}.${MM}.${year}`;
        }
      }

      const docxData = {
        offerNumber,
        clientInfo: {
          companyName: patch.company_name,
          street: patch.street_no,
          postalCode: patch.postal_code,
          city: patch.city,
          country: patch.country || 'Deutschland',
        },
        projectInfo: {
          date: dateStr,
          MM,
          DD,
          offerValidUntil: existing.offer_valid_until || null,
          deliveryTime: delivery.deliveryTime,
          projectName: existing.project_name || null,
          projectNumber: existing.project_number || null,
          year,
          projectType: existing.project_type || null,
          customProjectType: existing.custom_project_type || null,
        },
        pricing: patch.pricing,
        signature: {
          signatureName: existing.signature_name || 'Christopher Helm',
        },
        services,
        images: [],
        terms: existing.terms || {},
      };

      const generator = new TemplateDocxProposalGenerator(docxData);
      const { buffer: docxBuffer } = await generator.generate();
      const pdfBuffer: Buffer = await libreConvertAsync(docxBuffer, '.pdf', undefined);

      const fileUrls = await uploadProposalFiles(docxBuffer, pdfBuffer, storageFolderPath);
      patch.document_url = {
        docx: fileUrls.docxUrl,
        pdf: fileUrls.pdfUrl,
        folder: fileUrls.storagePath,
      };
      regenerateNote =
        'Documents regenerated. Note: images from the original proposal are not re-included (image data is not persisted in the database).';
    }

    const updated = await updateProposal(offerNumber, patch);

    return NextResponse.json({
      success: true,
      proposal: updated,
      regenerated: Boolean(regenerate),
      regenerateNote,
    });
  } catch (error: any) {
    console.error('❌ Error updating proposal:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
