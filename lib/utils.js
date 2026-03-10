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
            console.log('Looking up by client_id:', clientNumberOrId);
            queryClient = true;
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
    // Check if Supabase is configured
    if (!db || !db.from) {
        console.warn('⚠️  Supabase not configured. Skipping proposal save.');
        return proposalData; // Return the data as if it was saved
    }
    
    try {
        const { data, error } = await db
            .from('proposals')
            .insert([proposalData])
            .select();

        if (error) {
            console.error('Error saving proposal details:', error);
            return null;
        }
        console.log('Proposal details saved:', data);
        return data;
    } catch (err) {
        console.error('Exception in save_proposal_detail:', err);
        return null;
    }
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

module.exports = { getClientDetails, save_proposal_detail, getNextOfferNumber };
