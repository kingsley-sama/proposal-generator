import { NextResponse } from 'next/server';
import { promisify } from 'util';
// @ts-ignore
import libreConvert from 'libreoffice-convert';
// @ts-ignore
import TemplateDocxProposalGenerator from '@/lib/template-docx-generator';
// @ts-ignore
import {
  createProposalVersion,
  getProposalByOfferNumber,
  nextVersionNo,
  updateProposal,
  uploadProposalFiles,
  versionStoragePath,
} from '@/lib/utils';
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
    const { clientInfo, services, pricing, regenerate, projectInfo, offerMeta, images } = body || {};

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

    // The Setup form's fields live in ProposalContext, not in the rendered
    // document, so they only reach the database if the editor sends them. They
    // were dropped here before, which meant a change made in that form was
    // silently lost on save. Blank values are ignored rather than written, so an
    // untouched field cannot blank out what is already stored.
    const setupPatch: Record<string, any> = {
      project_number: projectInfo?.projectNumber,
      project_name: projectInfo?.projectName,
      project_type: projectInfo?.projectType,
      offer_valid_until: projectInfo?.offerValidUntil,
      sales_person: offerMeta?.salespersonName,
    };
    Object.entries(setupPatch).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') patch[key] = value;
    });

    // Values the regenerated document must be built from: what was just sent,
    // falling back to what is stored.
    const effective = { ...existing, ...patch };

    let regenerateNote: string | null = null;
    let docxBase64: string | null = null;
    let docxFilename: string | null = null;
    let versionNo: number | null = null;

    if (regenerate) {
      // Version folders are {client}/{offer}/v{n}, and the pre-versioning flat
      // path was {client}/{offer} — the first segment is the client folder in
      // both, so this keeps working for proposals generated before versioning.
      const folderFromDoc = existing.document_url?.folder as string | undefined;
      const clientFolderName =
        folderFromDoc?.split('/')[0] ||
        `${sanitize(String(existing.client_id ?? ''))}_${sanitize(existing.company_name)}`;

      versionNo = nextVersionNo(existing);
      const storageFolderPath = versionStoragePath(clientFolderName, offerNumber, versionNo);

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

      // Images are not persisted on the proposal row, so they can only come
      // from the editor's own state. When it sends them the regenerated
      // document keeps them; when it does not, the note below says so.
      const regenImages = Array.isArray(images)
        ? images.filter((img: any) => img?.imageData).map((img: any) => ({
            title: img.title || '',
            description: img.description || '',
            imageData: img.imageData,
            fileType: img.fileType || 'image/png',
          }))
        : [];

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
          offerValidUntil: effective.offer_valid_until || null,
          deliveryTime: delivery.deliveryTime,
          projectName: effective.project_name || null,
          projectNumber: effective.project_number || null,
          year,
          projectType: effective.project_type || null,
          customProjectType: effective.custom_project_type || null,
        },
        pricing: patch.pricing,
        signature: {
          signatureName: existing.signature_name || 'Christopher Helm',
        },
        services,
        images: regenImages,
        terms: existing.terms || {},
      };

      const generator = new TemplateDocxProposalGenerator(docxData);
      const { buffer: docxBuffer } = await generator.generate();

      // Best-effort, as in /api/generate-proposal: without LibreOffice on the
      // host the DOCX is still produced and only the PDF copy is skipped.
      let pdfBuffer: Buffer | null = null;
      try {
        pdfBuffer = await libreConvertAsync(docxBuffer, '.pdf', undefined);
      } catch (convertError: any) {
        console.error('⚠️  PDF conversion failed (DOCX still generated):', convertError.message);
      }

      const fileUrls = await uploadProposalFiles(docxBuffer, pdfBuffer, storageFolderPath);
      patch.document_url = {
        docx: fileUrls.docxUrl,
        pdf: fileUrls.pdfUrl,
        folder: fileUrls.storagePath,
      };

      // Returned so the editor can hand the user the file it just produced,
      // exactly as generating a new proposal does — including the same filename
      // shape, so a regenerated document is not distinguishable in Downloads.
      docxBase64 = docxBuffer.toString('base64');
      const safeCompanyName = String(patch.company_name || '')
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s&]/g, '')
        .substring(0, 50);
      docxFilename = `${year.slice(-2)}${MM}${DD}_Angebot_${safeCompanyName} ExposéProfi.docx`;

      if (regenImages.length === 0) {
        regenerateNote =
          'Dokument neu erstellt. Hinweis: Bilder werden nicht in der Datenbank gespeichert — ohne im Editor geladene Bilder enthält das neue Dokument keine.';
      }
    }

    const updated = await updateProposal(offerNumber, patch);

    // A version is cut only when a document was produced: a version is meant to
    // be something that could have gone to the client, not every keystroke that
    // was saved along the way. Non-fatal — the edit itself is already committed.
    let version: any = null;
    if (regenerate && updated) {
      try {
        version = await createProposalVersion(updated, {
          changeType: 'regenerate',
          actor: offerMeta?.salespersonName || updated.sales_person || null,
        });
      } catch (versionError: any) {
        console.error('⚠️  Proposal updated but version not recorded:', versionError.message);
      }
    }

    return NextResponse.json({
      success: true,
      proposal: updated,
      regenerated: Boolean(regenerate),
      regenerateNote,
      docxBase64,
      filename: docxFilename,
      version,
      versionNo,
    });
  } catch (error: any) {
    console.error('❌ Error updating proposal:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
