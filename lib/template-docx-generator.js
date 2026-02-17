const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');

/**
 * Template-based DOCX Proposal Generator
 * 
 * Loads `templates/proposal-template.docx` and populates it with data
 * using docxtemplater + pizzip. Images are inserted via docxtemplater-image-module-free.
 * 
 * Template placeholders (see templates/TEMPLATE_GUIDE.md):
 *   Simple:  {companyName}, {offerNumber}, {date}, {totalGrossPrice}, etc.
 *   Loops:   {#services}...{/services}, {#images}...{/images}
 *   Conds:   {#hasDiscount}...{/hasDiscount}, {#hasSmallValue}...{/hasSmallValue}
 */
class TemplateDocxProposalGenerator {
  constructor(data = {}) {
    this.data = data;
  }

  // ── Link XML Generation ────────────────────────────────────────

  generateLinkXml(url) {
    const escapeXml = (unsafe) => {
      return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
        }
      });
    };

    // MUST be a complete paragraph for raw XML insertion
    const linkXml = url ? 
      `<w:p>` +
        `<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Referenzen: </w:t></w:r>` + 
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${escapeXml(url)}" </w:instrText></w:r>` +
        `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>KLICK</w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
      `</w:p>`
      : '';
      
    return linkXml;
  }

  // ── Price helpers ──────────────────────────────────────────────

  /** German-locale price string: 1234.56 → "1.234,56" */
  formatPrice(price) {
    if (!price && price !== 0) return '0,00';
    const num = typeof price === 'string'
      ? parseFloat(price.replace(/\./g, '').replace(',', '.'))
      : price;
    if (isNaN(num)) return '0,00';
    return num.toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  parsePriceToNumber(priceStr) {
    if (!priceStr) return 0;
    if (typeof priceStr === 'number') return priceStr;
    return parseFloat(
      String(priceStr).replace(/[^\d,.\-]/g, '').replace(/\./g, '').replace(',', '.')
    ) || 0;
  }

  /** DD.MM.YYYY */
  formatDate(dateStr) {
    if (!dateStr) return 'XX.XX.XXXX';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }

  // ── Description tree → flat text with bullets ──────────────────

  /**
   * Convert the nested modifiedDefaults array into a flat structure
   * that the template loop {#description}...{/description} can render.
   *
   * Each node: { text, children: [ { text, children: [...] } ] }
   */
  flattenDescriptionForTemplate(items) {
    if (!items || !items.length) return [];
    return items.map(item => {
      const text = typeof item === 'string' ? item : (item.text || '');
      const children = (typeof item === 'object' && item.children)
        ? this.flattenDescriptionForTemplate(item.children)
        : [];
      return { text, children };
    });
  }

  /** Flatten description into a single bullet-point string (fallback) */
  descriptionToString(items, level = 0) {
    if (!items || !items.length) return '';
    const bullets = { 0: '●', 1: 'o', 2: '▪' };
    const bullet = bullets[level] || '•';
    const indent = '  '.repeat(level);
    let result = '';
    items.forEach(item => {
      const text = typeof item === 'string' ? item : (item.text || '');
      if (text) result += `${indent}${bullet} ${text}\n`;
      const children = typeof item === 'object' ? item.children : null;
      if (children && children.length) result += this.descriptionToString(children, level + 1);
    });
    return result;
  }

  // ── Build the template data object ─────────────────────────────

  buildTemplateData() {
    const clientInfo = this.data.clientInfo || {};
    const projectInfo = this.data.projectInfo || {};
    const pricing = this.data.pricing || {};
    const signature = this.data.signature || {};
    const services = this.data.services || [];
    const images = this.data.images || [];

    const offerNumber = this.data.offerNumber || 'XXXX-XX-XX-X';
    const dateStr = this.formatDate(projectInfo.date);
    const validUntilStr = this.formatDate(projectInfo.offerValidUntil);

    const totalNetNum = this.parsePriceToNumber(pricing.totalNetPrice);
    const totalGrossNum = this.parsePriceToNumber(pricing.totalGrossPrice);
    const requiresAdvancePayment = totalNetNum > 2000;
    const advanceAmount = requiresAdvancePayment ? totalGrossNum * 0.5 : 0;
    const remainingAmount = requiresAdvancePayment ? totalGrossNum - advanceAmount : totalGrossNum;

    const hasDiscount = !!(pricing.discount && (pricing.discount.value > 0 || pricing.discount.amount));
    const discountInfo = hasDiscount ? pricing.discount : null;
    const deliveryDays = projectInfo.deliveryTime || '4-6';

    // Prepare services for template loop
    const templateServices = services.map(s => {
      let description = this.flattenDescriptionForTemplate(s.modifiedDefaults || []);
      
      // Generate link XML at SERVICE level (NOT inside description array)
      const linkXml = s.link ? this.generateLinkXml(s.link) : '';
      
      return {
        quantity: String(s.quantity || 1),
        name: s.name || '',
        description,
        // Flat string fallback for simple {description_text} placeholder
        description_text: this.descriptionToString(s.modifiedDefaults || []).trim(),
        unitPrice: this.formatPrice(s.unitPrice),
        
        // Link at SERVICE level - accessible via {@linkXml} in template
        linkXml: linkXml,
        hasLink: !!s.link,
        
        // Pricing tiers for {#pricingTiers} sub-loop
        pricingTiers: (s.pricingTiers || []).map(t => ({ text: t.label || t.text || '' })),
        hasPricingTiers: !!(s.pricingTiers && s.pricingTiers.length),
      };
    });

    // Prepare images for template loop — base64 buffers for {%src}
    const templateImages = [];
    if (images && images.length) {
      images.forEach(img => {
        const entry = {
          title: img.title || '',
          description: img.description || '',
          hasImage: false,
          src: '',
        };
        if (img.imageData) {
          entry.hasImage = true;
          // Keep the full data URI – the image module opts.getImage handles decoding
          entry.src = img.imageData;
        }
        templateImages.push(entry);
      });
    }

    // Pricing tiers across all services (flat list for a separate {#pricing} section)
    const allPricingTiers = [];
    services.forEach(s => {
      if (s.pricingTiers && s.pricingTiers.length) {
        s.pricingTiers.forEach(t => allPricingTiers.push({ text: t.label || t.text || '' }));
      }
    });

    // Offer valid month for the "{offerValidMonth}" placeholder
    const offerValidMonth = validUntilStr !== 'XX.XX.XXXX' ? validUntilStr.split('.')[1] : 'XX';

    return {
      // Client
      companyName: clientInfo.companyName || '',
      street: clientInfo.street || '',
      postalCode: clientInfo.postalCode || '',
      city: clientInfo.city || '',
      country: clientInfo.country || 'Deutschland',

      // Offer
      offerNumber,
      date: dateStr,
      offerValidUntil: validUntilStr,
      offerValidMonth,
      deliveryTime: deliveryDays,

      // Services loop
      services: templateServices,
      hasServices: templateServices.length > 0,

      // All pricing tiers (flat)
      pricing: allPricingTiers,
      hasPricing: allPricingTiers.length > 0,

      // Images loop
      images: templateImages,
      hasImages: templateImages.length > 0,

      // Pricing summary
      subtotalNet: this.formatPrice(pricing.subtotalNet),
      // Aliases for template typos / variations
      sutotaNet: this.formatPrice(pricing.subtotalNet),
      totalNetPrice: this.formatPrice(pricing.totalNetPrice),
      totalVat: this.formatPrice(pricing.totalVat),
      totalGrossPrice: this.formatPrice(pricing.totalGrossPrice),
      totalCrossPrice: this.formatPrice(pricing.totalGrossPrice), // template typo alias

      // Discount
      hasDiscount,
      discountDescription: discountInfo ? (discountInfo.description || 'Mengenrabatt') : '',
      discountAmount: discountInfo ? this.formatPrice(discountInfo.amount) : '',
      discountType: discountInfo ? (discountInfo.type || '€') : '',

      // Conditional: small value (≤ 2000 net) vs large value (> 2000 net)
      hasSmallValue: !requiresAdvancePayment,
      hasSmallalue: !requiresAdvancePayment, // template typo alias
      hasLargeValue: requiresAdvancePayment,

      // Delivery / payment details
      estimatedDeliveryDay: deliveryDays,
      estimatedDeliverDay: deliveryDays, // template typo alias
      halfAmount: this.formatPrice(advanceAmount),
      remainingAmount: this.formatPrice(remainingAmount),

      // Signature
      signatureName: signature.signatureName || 'Christopher Helm',

      // Footer (if the template has footer placeholders)
      companyName_footer: 'ExposeProfi.de',
      companyLegal: 'EPCS GmbH',
      companyManager: 'GF: Christopher Helm',
      companyAddress: 'Bruder-Klaus-Str. 3a, 78467 Konstanz',
      companyRegister: 'HRB 725172, Amtsgericht Freiburg',
      companyTaxId: 'St.-Nr: 0908011277',
      companyVatId: 'USt-ID: DE347265281',
      bankName: 'Qonto (Banque de France)',
      bankIban: 'IBAN DE62100101239488471916',
      contactEmail: 'christopher.helm@exposeprofi.de',
      contactWeb: 'www.exposeprofi.de',
      contactPhone: 'Tel: +49-7531-1227491',
    };
  }

  // ── Main generation ────────────────────────────────────────────

  async generate(outputPath) {
    try {
      // 1. Locate template
      const templatePath = path.join(process.cwd(), 'templates', 'proposal-template.docx');
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found at ${templatePath}`);
      }

      // 2. Read & parse template
      const templateContent = fs.readFileSync(templatePath);
      const zip = new PizZip(templateContent);

      // 3. Configure image module for {%src} tags
      const imageOpts = {
        centered: false,
        getImage(tagValue) {
          // tagValue is the full data-URI or base64 string
          const base64 = tagValue.replace(/^data:image\/[^;]+;base64,/, '');
          return Buffer.from(base64, 'base64');
        },
        getSize(imgBuffer) {
          // Try to read real dimensions, fall back to 500×350
          try {
            const sizeOf = require('image-size');
            const dims = sizeOf(imgBuffer);
            const maxW = 500;
            const ratio = dims.height / dims.width;
            return [maxW, Math.round(maxW * ratio)];
          } catch (_) {
            return [500, 350];
          }
        },
      };

      const imageModule = new ImageModule(imageOpts);

      // 4. Create docxtemplater instance
      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{', end: '}' },
      });

      // 5. Build & set data
      const templateData = this.buildTemplateData();
      doc.setData(templateData);

      // 6. Render
      doc.render();

      // 7. Write output
      const buf = doc.getZip().generate({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, buf);

      const offerNumber = this.data.offerNumber || 'XXXX-XX-XX-X';
      console.log('✅ Proposal document generated successfully:', outputPath);
      return { success: true, filePath: outputPath, offerNumber };
    } catch (error) {
      console.error('❌ Error generating proposal document:', error);
      throw error;
    }
  }
}

module.exports = TemplateDocxProposalGenerator;