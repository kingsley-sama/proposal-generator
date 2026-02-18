const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');

class TemplateDocxProposalGenerator {
  constructor(data = {}) {
    this.data = data;
  }

  // ── XML Helper: Generates a single Bullet Paragraph ──────────
  // Styling: Calibri 12pt, Word numbering bullets, 0.25" indent per level, single line spacing

  createBulletXml(text, level = 0, isLink = false, url = '') {
    const escapeXml = (unsafe) => {
      return String(unsafe).replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
      }[c]));
    };

    // 0.25 inches per level (1 inch = 1440 twips → 0.25" = 360 twips)
    const indentPerLevel = 360;
    const indent = indentPerLevel * (level + 1);
    const hanging = indentPerLevel;

    // Font: Calibri 12pt (w:sz uses half-points → 12pt = 24)
    const fontName = 'Calibri';
    const fontSize = 24;

    const rPr =
      `<w:rPr>` +
        `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>` +
        `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>` +
        `<w:b w:val="0"/>` +
      `</w:rPr>`;

    const linkRPr =
      `<w:rPr>` +
        `<w:rStyle w:val="Hyperlink"/>` +
        `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:cs="${fontName}"/>` +
        `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>` +
        `<w:b w:val="0"/>` +
      `</w:rPr>`;

    let contentXml = '';
    if (isLink) {
      contentXml =
        `<w:r>${rPr}<w:t xml:space="preserve">Referenzen: </w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
        `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${escapeXml(url)}" </w:instrText></w:r>` +
        `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
        `<w:r>${linkRPr}<w:t>KLICK</w:t></w:r>` +
        `<w:r><w:fldChar w:fldCharType="end"/></w:r>`;
    } else {
      contentXml = `<w:r>${rPr}<w:t>${escapeXml(text)}</w:t></w:r>`;
    }

    return `
      <w:p>
        <w:pPr>
          <w:pStyle w:val="ListParagraph"/>
          <w:numPr>
            <w:ilvl w:val="${level}"/>
            <w:numId w:val="1"/>
          </w:numPr>
          <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
          <w:ind w:left="${indent}" w:hanging="${hanging}"/>
        </w:pPr>
        ${contentXml}
      </w:p>`;
  }

  // ── Recursive function to build the entire XML block ────────

  generateFullDescriptionXml(items, url = '') {
    let xml = '';

    const traverse = (nodes, level = 0) => {
      nodes.forEach(node => {
        const text = typeof node === 'string' ? node : (node.text || '');
        if (text) xml += this.createBulletXml(text, level);

        if (node.children && node.children.length > 0) {
          traverse(node.children, level + 1);
        }
      });
    };

    if (items && items.length > 0) traverse(items, 0);
    if (url) xml += this.createBulletXml('', 0, true, url);

    return xml;
  }

  // ── Price helpers ──────────────────────────────────────────────

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

  formatDate(dateStr) {
    if (!dateStr) return 'XX.XX.XXXX';
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
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

    const templateServices = services.map(s => {
      return {
        quantity: String(s.quantity || 1),
        name: s.name || '',
        sub_name: s.sub_name || '',
        hasSubName: !!s.sub_name,
        // INJECT EVERYTHING AS ONE XML BLOCK
        fullDescriptionXml: this.generateFullDescriptionXml(s.modifiedDefaults || [], s.link),
        unitPrice: this.formatPrice(s.unitPrice),
        pricingTiers: (s.pricingTiers || []).map(t => ({ text: t.label || t.text || '' })),
        hasPricingTiers: !!(s.pricingTiers && s.pricingTiers.length),
      };
    });

    const templateImages = images.map(img => ({
      title: img.title || '',
      description: img.description || '',
      hasImage: !!img.imageData,
      src: img.imageData || '',
    }));

    const allPricingTiers = [];
    services.forEach(s => {
      if (s.pricingTiers) {
        s.pricingTiers.forEach(t => allPricingTiers.push({ text: t.label || t.text || '' }));
      }
    });

    return {
      companyName: clientInfo.companyName || '',
      street: clientInfo.street || '',
      postalCode: clientInfo.postalCode || '',
      city: clientInfo.city || '',
      country: clientInfo.country || 'Deutschland',
      offerNumber,
      date: dateStr,
      offerValidUntil: validUntilStr,
      deliveryTime: deliveryDays,
      services: templateServices,
      hasServices: templateServices.length > 0,
      pricing: allPricingTiers,
      hasPricing: allPricingTiers.length > 0,
      images: templateImages,
      hasImages: templateImages.length > 0,
      subtotalNet: this.formatPrice(pricing.subtotalNet),
      totalNetPrice: this.formatPrice(pricing.totalNetPrice),
      totalVat: this.formatPrice(pricing.totalVat),
      totalGrossPrice: this.formatPrice(pricing.totalGrossPrice),
      hasDiscount,
      discountDescription: discountInfo ? (discountInfo.description || 'Mengenrabatt') : '',
      discountAmount: discountInfo ? this.formatPrice(discountInfo.amount) : '',
      hasSmallValue: !requiresAdvancePayment,
      hasLargeValue: requiresAdvancePayment,
      halfAmount: this.formatPrice(advanceAmount),
      remainingAmount: this.formatPrice(remainingAmount),
      signatureName: signature.signatureName || 'Christopher Helm',
      // Standard Footer Data
      companyName_footer: 'ExposeProfi.de',
      contactEmail: 'christopher.helm@exposeprofi.de',
      contactWeb: 'www.exposeprofi.de',
    };
  }

  async generate(outputPath) {
    try {
      const templatePath = path.join(process.cwd(), 'templates', 'proposal-template.docx');
      const templateContent = fs.readFileSync(templatePath);
      const zip = new PizZip(templateContent);

      const imageOpts = {
        centered: false,
        getImage(tagValue) {
          const base64 = tagValue.replace(/^data:image\/[^;]+;base64,/, '');
          return Buffer.from(base64, 'base64');
        },
        getSize() { return [500, 350]; }
      };

      const doc = new Docxtemplater(zip, {
        modules: [new ImageModule(imageOpts)],
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render(this.buildTemplateData());
      fs.writeFileSync(outputPath, doc.getZip().generate({ type: 'nodebuffer' }));
      return { success: true, filePath: outputPath };
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}

module.exports = TemplateDocxProposalGenerator;