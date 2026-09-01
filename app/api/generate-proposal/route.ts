import { NextResponse } from 'next/server';
import { promisify } from 'util';
// @ts-ignore
import libreConvert from 'libreoffice-convert';
// @ts-ignore
import TemplateDocxProposalGenerator from '@/lib/template-docx-generator';
// @ts-ignore
import {
  createProposalVersion,
  getClientDetails,
  getNextOfferNumber,
  save_proposal_detail,
  uploadProposalFiles,
  versionStoragePath,
} from '@/lib/utils';

const libreConvertAsync = promisify(libreConvert.convert);

export const runtime = 'nodejs'; // Required for fs

// A freshly generated proposal is always its own first version.
const INITIAL_VERSION_NO = 1;

export async function POST(request: Request) {
  try {
    console.log('📥 Received proposal request');
    
    // Check if request has a body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('❌ Invalid content-type:', contentType);
      return NextResponse.json({ 
        success: false, 
        error: 'Content-Type must be application/json' 
      }, { status: 400 });
    }
    
    // Get raw body text first for debugging
    const bodyText = await request.text();
    console.log('📦 Body length:', bodyText.length);
    
    if (!bodyText || bodyText.length === 0) {
      console.error('❌ Empty request body');
      return NextResponse.json({ 
        success: false, 
        error: 'Request body is empty' 
      }, { status: 400 });
    }
    
    // Parse JSON
    let data;
    try {
      data = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      console.error('Body preview:', bodyText.substring(0, 200));
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }, { status: 400 });
    }
    
    const { clientInfo, projectInfo, services, pricing, signature, images: imageMetadata, terms, offerMeta } = data;
    
    if (!clientInfo) {
      return NextResponse.json({ success: false, error: 'Missing client information' }, { status: 400 });
    }
    
    // Fetch client details
    let dbClientData = null;
    let clientFolderName = 'default_client';
    
    if (clientInfo.clientNumber) {
      const clientId = clientInfo.clientNumber;
      // Note: we can import getClientDetails directly
      const clientDetails = await getClientDetails(clientId);
      
      if (clientDetails && clientDetails.length > 0) {
        dbClientData = clientDetails[0];
        
        const sanitize = (str: string) => str ? String(str).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) : 'unknown';
        clientFolderName = `${sanitize(dbClientData.client_id || clientId)}_${sanitize(dbClientData.company_name)}`;
        clientInfo.companyName = clientInfo.companyName || dbClientData.company_name;
      } else {
        const sanitize = (str: string) => str ? String(str).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) : 'unknown';
        clientFolderName = `${sanitize(clientId)}_${sanitize(clientInfo.companyName)}`;
      }
    } else {
      const sanitize = (str: string) => str ? String(str).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) : 'unknown';
      clientFolderName = `${sanitize(clientInfo.companyName)}_${Date.now()}`;
    }
    
    // Process images
    const images: any[] = [];
    if (imageMetadata && imageMetadata.length > 0) {
        imageMetadata.forEach((imgData: any) => {
        if (imgData.imageData) {
          images.push({
            title: imgData.title || '',
            description: imgData.description || '',
            imageData: imgData.imageData,
            fileType: imgData.fileType || 'image/png'
          });
        }
      });
    }
    
    const yearForOffer = projectInfo.date ? projectInfo.date.split('.')[2] : new Date().getFullYear().toString();
    const mmForOffer = projectInfo.MM || String(new Date().getMonth() + 1).padStart(2, '0');
    const ddForOffer = projectInfo.DD || String(new Date().getDate()).padStart(2, '0');
    
    const generatedOfferNumber = await getNextOfferNumber(yearForOffer, mmForOffer, ddForOffer);
    
    // Prepare data for template generator
    const docxData = {
      offerNumber: generatedOfferNumber,
      clientInfo: {
        companyName: clientInfo.companyName,
        street: clientInfo.street,
        postalCode: clientInfo.postalCode,
        city: clientInfo.city,
        country: clientInfo.country || 'Deutschland'
      },
      projectInfo: {
        date: projectInfo.date,
        MM: projectInfo.MM,
        DD: projectInfo.DD,
        offerValidUntil: projectInfo.offerValidUntil,
        deliveryTime: projectInfo.deliveryTime || `${projectInfo.deliveryDays || 'XXX'} Werktage`,
        projectName: projectInfo.projectName || null,
        projectNumber: projectInfo.projectNumber || null,
        year: yearForOffer,
        projectType: projectInfo.projectType || null,
        customProjectType: projectInfo.customProjectType || null
      },
      pricing: {
        subtotalNet: pricing.subtotalNet,
        totalNetPrice: pricing.totalNetPrice,
        totalVat: pricing.totalVat,
        totalGrossPrice: pricing.totalGrossPrice,
        discount: pricing.discount || null
      },
      signature: {
        signatureName: signature?.signatureName || 'Christopher Helm'
      },
      services: services || [],
      images: images,
      terms: terms || {}
    };
    
    const YY = projectInfo.date ? projectInfo.date.split('.')[2].slice(-2) : '26';
    const MM = projectInfo.MM || '01';
    const DD = projectInfo.DD || '01';
    const safeCompanyName = clientInfo.companyName
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s&]/g, '')
      .substring(0, 50);
    const filename = `${YY}${MM}${DD}_Angebot_${safeCompanyName} ExposéProfi.docx`;
    const pdfFilename = filename.replace('.docx', '.pdf');

    const generator = new TemplateDocxProposalGenerator(docxData);
    const { buffer: docxBuffer } = await generator.generate();
    // PDF conversion needs LibreOffice (soffice) on the host. Treat it as
    // best-effort: without it the proposal is still generated and returned,
    // only the PDF copy in storage / webhook is skipped.
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await libreConvertAsync(docxBuffer, '.pdf', undefined);
    } catch (convertError: any) {
      console.error('⚠️  PDF conversion failed (DOCX still generated). Install LibreOffice to enable PDFs:', convertError.message);
    }
    console.log('✅ Files generated in memory');

    // Upload DOCX + PDF to Supabase Storage, under this version's own folder.
    // uploadProposalFiles writes with upsert:true, so a shared path would let a
    // later regeneration overwrite the document an earlier version points at.
    const storageFolderPath = versionStoragePath(
      clientFolderName,
      generatedOfferNumber,
      INITIAL_VERSION_NO
    );
    let fileUrls: { docxUrl: string; pdfUrl: string; storagePath: string } | null = null;
    try {
      fileUrls = await uploadProposalFiles(docxBuffer, pdfBuffer, storageFolderPath);
      console.log('✅ Files uploaded to Supabase Storage:', fileUrls.storagePath);
    } catch (uploadError: any) {
      console.error('⚠️  Storage upload failed (local file still exists):', uploadError.message);
    }

    // Save to DB
    const isReady = Boolean(offerMeta?.isReady);
    const proposalDbData = {
      client_id: dbClientData ? (parseInt(dbClientData.client_id) || null) : null,
      company_name: clientInfo.companyName,
      street_no: clientInfo.street,
      city: clientInfo.city,
      country: clientInfo.country || 'Deutschland',
      postal_code: clientInfo.postalCode,
      project_number: projectInfo.projectNumber || null,
      project_name: projectInfo.projectName || null,
      project_type: projectInfo.projectType || null,
      offer_number: generatedOfferNumber,
      delivery_time_min: projectInfo.deliveryDays ? parseInt(projectInfo.deliveryDays.split('-')[0]) : null,
      delivery_time_max: projectInfo.deliveryDays ? parseInt(projectInfo.deliveryDays.split('-')[1]) : null,
      services: services,
      pricing: {
        subtotalNet: pricing.subtotalNet,
        totalNetPrice: pricing.totalNetPrice,
        totalVat: pricing.totalVat,
        totalGrossPrice: pricing.totalGrossPrice,
        discount: pricing.discount
      },
      discount_type: pricing.discount?.type || null,
      discount_value: pricing.discount?.amount
        ? parseFloat(String(pricing.discount.amount).replace(/\./g, '').replace(',', '.')) || null
        : null,
      currency: 'EUR',
      total_price: parseFloat(pricing.totalGrossPrice?.replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.')) || null,
      image_urls: imageMetadata?.map((img: any) => ({ title: img.title, description: img.description })) || [],
      document_url: fileUrls ? { docx: fileUrls.docxUrl, pdf: fileUrls.pdfUrl, folder: fileUrls.storagePath } : null,

      // The column was never written here, so every generated proposal landed
      // with proposal_status NULL and the list rendered its "draft" fallback —
      // including proposals that had already been marked ready.
      //
      // A new proposal has no row for /api/projects to update, so if the project
      // was created during this session the readiness has to be recorded now.
      // project_id is what makes that durable: a proposal carrying one is a
      // proposal that has become a project.
      proposal_status: isReady ? 'ready' : 'draft',
      project_id: isReady ? (projectInfo.projectNumber || null) : null
    };

    let dbSaveError: string | null = null;
    let savedProposal: any = null;
    try {
      const saved = await save_proposal_detail(proposalDbData);
      savedProposal = (saved && saved[0]) || null;

      // v1 — the proposal as it was first generated. Recorded after the insert
      // so the snapshot is of committed state, and non-fatal: the document is
      // already in the user's hands, and losing the history entry must not read
      // to them as a failed generation.
      if (savedProposal) {
        try {
          await createProposalVersion(savedProposal, {
            changeType: 'create',
            actor: offerMeta?.salespersonName || null,
          });
        } catch (versionError: any) {
          console.error('⚠️  Proposal saved but v1 not recorded:', versionError.message);
        }
      }
    } catch (dbError: any) {
      dbSaveError = dbError.message;
      console.error('⚠️  DB save failed (proposal still returned to user):', dbError.message);
    }

    // Webhook (Fire and forget, or await)
    // For Serverless, better to await or it might be killed
    try {
        const webhookPayload = {
            offerNumber: generatedOfferNumber,
            clientInfo: {
                companyName: clientInfo.companyName,
                street: clientInfo.street,
                postalCode: clientInfo.postalCode,
                city: clientInfo.city,
                country: clientInfo.country || 'Deutschland'
            },
            projectInfo: {
                date: projectInfo.date,
                MM: projectInfo.MM,
                DD: projectInfo.DD,
                offerValidUntil: projectInfo.offerValidUntil,
                deliveryDays: projectInfo.deliveryDays
            },
            pricing: {
                totalNetPrice: pricing.totalNetPrice,
                totalVat: pricing.totalVat,
                totalGrossPrice: pricing.totalGrossPrice
            },
            signature: {
                signatureName: signature?.signatureName || 'Christopher Helm'
            },
            folderPath: clientFolderName,
            docxFilename: filename,
            pdfFilename: pdfFilename,
            imagesIncluded: images.length,
            docxUrl: fileUrls?.docxUrl || null,
            pdfUrl:  fileUrls?.pdfUrl  || null,
        };
        const webhookUrl = 'https://n8n.exposeprofi.de/webhook/556fd7ca-ef28-4d00-b98e-9271b07a7bad';
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });
        if (!webhookResponse.ok) {
            console.error('Webhook returned non-OK status:', webhookResponse.status);
        }
    } catch (e) {
        console.error('Webhook error', e);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Proposal generated successfully',
      filename,
      docxBase64: docxBuffer.toString('base64'),
      docxUrl: fileUrls?.docxUrl || null,
      pdfUrl: fileUrls?.pdfUrl || null,
      clientFolder: clientFolderName,
      offerNumber: generatedOfferNumber,
      clientName: clientInfo.companyName,
      totalAmount: pricing.totalGrossPrice,
      imagesIncluded: images.length,
      clientDataFromDb: dbClientData ? true : false,
      dbSaveError,
    });
    
  } catch (error: any) {
    console.error('❌ Error generating proposal:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
