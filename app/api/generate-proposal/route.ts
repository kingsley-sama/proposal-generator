import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import https from 'https';
// @ts-ignore
import TemplateDocxProposalGenerator from '@/lib/template-docx-generator';
// @ts-ignore
import { getClientDetails, getNextOfferNumber, save_proposal_detail } from '@/lib/utils';

export const runtime = 'nodejs'; // Required for fs

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
    
    const { clientInfo, projectInfo, services, pricing, signature, images: imageMetadata } = data;
    
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
        clientInfo.companyName = dbClientData.company_name || clientInfo.companyName;
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
        year: yearForOffer
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
      images: images
    };
    
    const clientOutputDir = path.join(process.cwd(), 'output', clientFolderName);
    if (!fs.existsSync(clientOutputDir)) {
      fs.mkdirSync(clientOutputDir, { recursive: true });
    }
    
    const YY = projectInfo.date ? projectInfo.date.split('.')[2].slice(-2) : '26';
    const MM = projectInfo.MM || '01';
    const DD = projectInfo.DD || '01';
    const safeCompanyName = clientInfo.companyName
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s&]/g, '')
      .substring(0, 50);
    const filename = `${YY}${MM}${DD}_Angebot_${safeCompanyName} ExposéProfi.docx`;
    
    const generator = new TemplateDocxProposalGenerator(docxData);
    const outputPath = path.join(clientOutputDir, filename);
    
    await generator.generate(outputPath);
    
    // Save to DB
    const proposalDbData = {
      client_id: dbClientData ? dbClientData.client_id : null,
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
      discount_value: pricing.discount?.amount || null,
      currency: 'EUR',
      total_price: parseFloat(pricing.totalGrossPrice?.replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.')) || null,
      image_urls: imageMetadata?.map((img: any) => ({ title: img.title, description: img.description })) || [],
      document_url: null
    };

    await save_proposal_detail(proposalDbData);

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
            filename: `${clientFolderName}/${filename}`,
            imagesIncluded: images.length
        };
        const webhookUrl = 'https://n8n.exposeprofi.de/webhook/556fd7ca-ef28-4d00-b98e-9271b07a7bad';
        const webhookData = JSON.stringify(webhookPayload);
        
        await new Promise<void>((resolve, reject) => {
             const urlObj = new URL(webhookUrl);
             const options = {
                 hostname: urlObj.hostname,
                 port: 443,
                 path: urlObj.pathname,
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Content-Length': Buffer.byteLength(webhookData)
                 }
             };
             const req = https.request(options, (res) => {
                 res.on('data', () => {});
                 res.on('end', () => resolve());
             });
             req.on('error', reject);
             req.write(webhookData);
             req.end();
        });
    } catch (e) {
        console.error('Webhook error', e);
    }
    
    const encodedFileUrl = `/output/${encodeURIComponent(clientFolderName)}/${encodeURIComponent(filename)}`;

    return NextResponse.json({
      success: true,
      message: 'Proposal generated successfully',
      filename: `${clientFolderName}/${filename}`,
      fileUrl: encodedFileUrl,
      filePath: outputPath,
      clientFolder: clientFolderName,
      offerNumber: generatedOfferNumber,
      clientName: clientInfo.companyName,
      totalAmount: pricing.totalGrossPrice,
      imagesIncluded: images.length,
      clientDataFromDb: dbClientData ? true : false
    });
    
  } catch (error: any) {
    console.error('❌ Error generating proposal:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
