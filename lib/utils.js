const db = require('./supabase.js');
const fs = require('fs');
const path = require('path');

async function getClientDetails(clientNumberOrId) {
    console.log('Fetching client details for:', clientNumberOrId);
    
    // Check if Supabase is configured
    if (!db || !db.from) {
        console.warn('⚠️  Supabase not configured. Returning mock client data.');
        return [{
            company_id: 'mock-company-id',
            client_id: clientNumberOrId,
            company_name: 'Mock Company Name (Configure Supabase for real data)',
            company_primary_domain: 'example.com'
        }];
    }
    
    try {
        let companyId = null;
        let queryClient = false;
        const isEmail = clientNumberOrId.toString().includes('@');

        // Check if input is email
        if (isEmail) {
            const emailLower = clientNumberOrId.toLowerCase().trim();
            console.log('Looking up by email:', emailLower);
            
            // Strategy 1: Try the emails table with company_email column
            try {
                const { data: emailData, error: emailError } = await db
                    .from('emails')
                    .select('company_id')
                    .eq('company_email', emailLower)
                    .limit(1);

                if (!emailError && emailData && emailData.length > 0) {
                    companyId = emailData[0].company_id;
                    console.log('Found company_id from emails table:', companyId);
                }
            } catch (e) {
                console.log('emails table lookup failed, trying alternatives...');
            }
            
            // Strategy 2: Try the contacts table
            if (!companyId) {
                try {
                    const { data: contactData, error: contactError } = await db
                        .from('contacts')
                        .select('company_id')
                        .eq('email', emailLower)
                        .limit(1);

                    if (!contactError && contactData && contactData.length > 0) {
                        companyId = contactData[0].company_id;
                        console.log('Found company_id from contacts table:', companyId);
                    }
                } catch (e) {
                    console.log('contacts table lookup failed, trying domain match...');
                }
            }
            
            // Strategy 3: Try matching company by email domain
            if (!companyId) {
                const domain = emailLower.split('@')[1];
                if (domain) {
                    try {
                        const { data: domainData, error: domainError } = await db
                            .from('companies')
                            .select('company_id, client_id, company_name, company_primary_domain')
                            .ilike('company_primary_domain', `%${domain}%`)
                            .limit(1);

                        if (!domainError && domainData && domainData.length > 0) {
                            console.log('Found company by domain match:', domainData[0]);
                            return [{
                                company_id: domainData[0].company_id,
                                client_id: domainData[0].client_id,
                                company_name: domainData[0].company_name,
                                company_primary_domain: domainData[0].company_primary_domain
                            }];
                        }
                    } catch (e) {
                        console.log('Domain lookup failed');
                    }
                }
            }
            
            if (!companyId) {
                console.log('Email not found in any table:', emailLower);
                return null;
            }
        } else {
            const isNumeric = /^\d+$/.test(clientNumberOrId.toString().trim());
            if (isNumeric) {
                console.log('Looking up by client_id:', clientNumberOrId);
                queryClient = true;
            } else {
                console.log('Non-numeric identifier, looking up by company_name:', clientNumberOrId);
                // Fall through with neither flag set — will query by company_name below
            }
        }

        // Query companies table
        let query = db.from('companies').select(`
            company_id,
            client_id,
            company_name,
            company_primary_domain
        `);

        if (companyId) {
            query = query.eq('company_id', companyId);
        } else if (queryClient) {
            query = query.eq('client_id', clientNumberOrId);
        } else {
            query = query.ilike('company_name', clientNumberOrId.toString().trim());
        }

        const { data: companyData, error: companyError } = await query.limit(1);
        
        if (companyError) {
            console.error('Error fetching company details:', companyError);
            return null;
        }
        
        if (companyData && companyData.length > 0) {
            const company = companyData[0];
            
            const result = [{
                company_id: company.company_id,
                client_id: company.client_id,
                company_name: company.company_name,
                company_primary_domain: company.company_primary_domain
            }];
            
            console.log('Company details retrieved:', result);
            return result;
        }
        
        console.log('No company found for identifier:', clientNumberOrId);
        return null;
    } catch (err) {
        console.error('Exception in getClientDetails:', err);
        return null;
    }
}

async function save_proposal_detail(proposalData) {
    if (!db || !db.from) {
        throw new Error('Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_KEY (or their NEXT_PUBLIC_ equivalents) must be set.');
    }

    const { data, error } = await db
        .from('proposals')
        .insert([proposalData])
        .select();

    if (error) {
        throw new Error(`Supabase insert failed: ${error.message}`);
    }

    console.log('Proposal details saved:', data);
    return data;
}

async function getNextOfferNumber(year, month, day) {
    const prefix = `${year}-${month}-${day}-`;
    const dateKey = `${year}-${month}-${day}`;

    // ── Local counter file (primary source of truth) ─────────────
    // Stored at <project_root>/output/offer_counter.json
    // Format: { "date": "YYYY-MM-DD", "counter": N }
    const counterFilePath = path.join(process.cwd(), 'output', 'offer_counter.json');

    let localMax = 7; // Start at 7 so the first increment gives 8

    try {
        if (fs.existsSync(counterFilePath)) {
            const raw = fs.readFileSync(counterFilePath, 'utf8');
            const stored = JSON.parse(raw);
            if (stored.date === dateKey && typeof stored.counter === 'number') {
                localMax = stored.counter; // last used suffix for today
            }
            // If date differs, localMax stays at 7 (new day, start fresh)
        }
    } catch (e) {
        console.warn('Could not read offer_counter.json, starting from 7:', e.message);
    }

    // ── DB check (secondary – picks up offers from other machines) ─
    let dbMax = 7;
    if (db && db.from) {
        try {
            const { data, error } = await db
                .from('proposals')
                .select('offer_number')
                .ilike('offer_number', `${prefix}%`);

            if (!error && data && data.length > 0) {
                data.forEach(p => {
                    if (p.offer_number) {
                        const parts = p.offer_number.split('-');
                        const lastPart = parts[parts.length - 1];
                        const suffix = parseInt(lastPart, 10);
                        if (!isNaN(suffix) && suffix > dbMax) {
                            dbMax = suffix;
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('getNextOfferNumber DB check failed (non-fatal):', err.message);
        }
    }

    // Use whichever is higher, then increment
    const nextSuffix = Math.max(localMax, dbMax) + 1;

    // ── Persist new counter to local file ─────────────────────────
    try {
        const outputDir = path.join(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.writeFileSync(counterFilePath, JSON.stringify({ date: dateKey, counter: nextSuffix }), 'utf8');
    } catch (e) {
        console.warn('Could not write offer_counter.json:', e.message);
    }

    return `${prefix}${nextSuffix}`;
}

async function uploadProposalFiles(docxBuffer, pdfBuffer, storagePath) {
    if (!db || !db.storage) {
        throw new Error('Supabase not configured — cannot upload files to storage.');
    }

    const bucket = 'proposals';
    const docxPath = `${storagePath}/proposal.docx`;
    const pdfPath  = `${storagePath}/proposal.pdf`;

    const docxUpload = await db.storage.from(bucket).upload(docxPath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
    });
    if (docxUpload.error) throw new Error(`DOCX upload failed: ${docxUpload.error.message}`);

    // pdfBuffer is null when LibreOffice is unavailable on the host
    if (pdfBuffer) {
        const pdfUpload = await db.storage.from(bucket).upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
        });
        if (pdfUpload.error) throw new Error(`PDF upload failed: ${pdfUpload.error.message}`);
    }

    // Signed URLs valid for 7 days so n8n can download and push to SharePoint
    const docxSigned = await db.storage.from(bucket).createSignedUrl(docxPath, 60 * 60 * 24 * 7);
    if (docxSigned.error) throw new Error(`DOCX signed URL failed: ${docxSigned.error.message}`);

    let pdfUrl = null;
    if (pdfBuffer) {
        const pdfSigned = await db.storage.from(bucket).createSignedUrl(pdfPath, 60 * 60 * 24 * 7);
        if (pdfSigned.error) throw new Error(`PDF signed URL failed: ${pdfSigned.error.message}`);
        pdfUrl = pdfSigned.data.signedUrl;
    }

    return {
        docxUrl: docxSigned.data.signedUrl,
        pdfUrl,
        storagePath,
    };
}

/**
 * @param {{ search?: string, status?: string, limit?: number, offset?: number }} [opts]
 */
async function listProposals({ search, status, limit = 50, offset = 0 } = {}) {
    if (!db || !db.from) {
        throw new Error('Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_KEY (or their NEXT_PUBLIC_ equivalents) must be set.');
    }

    let query = db
        .from('proposals')
        .select('id, offer_number, company_name, project_name, project_number, total_price, currency, proposal_status, created_at, updated_at', { count: 'exact' })
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('proposal_status', status);
    }

    if (search && search.trim()) {
        const term = search.trim();
        const safe = term.replace(/[%,()]/g, '\\$&');
        query = query.or(`company_name.ilike.%${safe}%,offer_number.ilike.%${safe}%,project_name.ilike.%${safe}%,project_number.ilike.%${safe}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) {
        throw new Error(`Supabase list failed: ${error.message}`);
    }

    return { rows: data || [], total: count ?? 0 };
}

async function getProposalByOfferNumber(offerNumber) {
    if (!db || !db.from) {
        throw new Error('Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_KEY (or their NEXT_PUBLIC_ equivalents) must be set.');
    }

    const { data, error } = await db
        .from('proposals')
        .select('*')
        .eq('offer_number', offerNumber)
        .limit(1);

    if (error) {
        throw new Error(`Supabase select failed: ${error.message}`);
    }

    return (data && data[0]) || null;
}

async function updateProposal(offerNumber, patch) {
    if (!db || !db.from) {
        throw new Error('Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_KEY (or their NEXT_PUBLIC_ equivalents) must be set.');
    }

    const { data, error } = await db
        .from('proposals')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('offer_number', offerNumber)
        .select();

    if (error) {
        throw new Error(`Supabase update failed: ${error.message}`);
    }

    return (data && data[0]) || null;
}

async function setProposalStatus(offerNumber, status) {
    return updateProposal(offerNumber, { proposal_status: status });
}

module.exports = {
    getClientDetails,
    save_proposal_detail,
    getNextOfferNumber,
    uploadProposalFiles,
    listProposals,
    getProposalByOfferNumber,
    updateProposal,
    setProposalStatus,
};
