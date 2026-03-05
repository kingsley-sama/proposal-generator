const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { imageSize } = require('image-size');
const italicData = require('../italics_data');

class TemplateDocxProposalGenerator {
  constructor(data = {}) {
    this.data = data;
  }

  // ── XML Helper: Generates a single Bullet Paragraph ──────────
  // Uses Word's native bullet numbering (numId=3, injected at generation time)
  // with three levels: • (level 0), o (level 1), ■ (level 2)

  createBulletXml(text, level = 0, isLink = false, url = '') {
    const escapeXml = (unsafe) => {
      return String(unsafe).replace(/[<>&'"]/g, c => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
      }[c]));
    };

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

    // All levels use Word's native numbering via numId=3 (injected into
    // numbering.xml at generation time with proper bullet definitions).
    // Clamp to max level 2 (3 bullet tiers).
    const ilvl = Math.min(level, 2);

    return `
      <w:p>
        <w:pPr>
          <w:pStyle w:val="ListParagraph"/>
          <w:numPr>
            <w:ilvl w:val="${ilvl}"/>
            <w:numId w:val="3"/>
          </w:numPr>
          <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
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

    return xml.trim();
  }

  // ── Image XML with black border + thin padding ───────────────────
  // Uses <a:ln> on the shape edge with a white solid fill underneath.
  // The shape extent is slightly larger than the image; <a:fillRect>
  // insets shrink the image within the shape, leaving a thin white
  // gap between the image content and the black border.

  generateImageXml(rId, widthPx, heightPx, imageIndex) {
    // Convert pixels → EMUs (1 px at 96 dpi = 9525 EMU)
    const pxToEmu = 9525;
    const imgCx = widthPx * pxToEmu;
    const imgCy = heightPx * pxToEmu;

    // Padding ~1mm each side = 36 000 EMU
    const pad = 36000;
    const cx = imgCx + pad * 2;
    const cy = imgCy + pad * 2;

    // fillRect insets in 1/100 000ths of the shape extent
    const insetL = Math.round((pad / cx) * 100000);
    const insetT = Math.round((pad / cy) * 100000);

    const docPrId = 100 + imageIndex;

    // Border width in EMUs (12700 = 1pt; 6350 = 0.5pt)
    const borderW = 6350;

    return (
      `<w:p>` +
        `<w:pPr><w:jc w:val="center"/></w:pPr>` +
        `<w:r>` +
          `<w:drawing>` +
            `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
              `<wp:extent cx="${cx}" cy="${cy}"/>` +
              `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
              `<wp:docPr id="${docPrId}" name="Proposal Image ${imageIndex + 1}"/>` +
              `<wp:cNvGraphicFramePr>` +
                `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
              `</wp:cNvGraphicFramePr>` +
              `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
                `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                  `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                    `<pic:nvPicPr>` +
                      `<pic:cNvPr id="${docPrId}" name="Proposal Image ${imageIndex + 1}"/>` +
                      `<pic:cNvPicPr>` +
                        `<a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>` +
                      `</pic:cNvPicPr>` +
                    `</pic:nvPicPr>` +
                    `<pic:blipFill>` +
                      `<a:blip r:embed="${rId}"/>` +
                      `<a:stretch><a:fillRect l="${insetL}" t="${insetT}" r="${insetL}" b="${insetT}"/></a:stretch>` +
                    `</pic:blipFill>` +
                    `<pic:spPr bwMode="auto">` +
                      `<a:xfrm>` +
                        `<a:off x="0" y="0"/>` +
                        `<a:ext cx="${cx}" cy="${cy}"/>` +
                      `</a:xfrm>` +
                      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
                      `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>` +
                      `<a:ln w="${borderW}" cap="flat" cmpd="sng">` +
                        `<a:solidFill><a:srgbClr val="000000"/></a:solidFill>` +
                        `<a:prstDash val="solid"/>` +
                      `</a:ln>` +
                    `</pic:spPr>` +
                  `</pic:pic>` +
                `</a:graphicData>` +
              `</a:graphic>` +
            `</wp:inline>` +
          `</w:drawing>` +
        `</w:r>` +
      `</w:p>` +
      // Spacer paragraph for gap between images
      `<w:p><w:pPr><w:spacing w:before="240" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:p>`
    );
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
    const terms = this.data.terms || {};

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
      const tierPrefix = ['', 'Preisstaffelung:'].map(t => ({ text: t }));
      const tiers = (s.pricingTiers && s.pricingTiers.length)
        ? [...tierPrefix, ...s.pricingTiers.map(t => ({ text: t.label || t.text || '' })), { text: '' }]
        : [];
      return {
        quantity: String(s.quantity || 1),
        name: s.name || '',
        sub_name: s.sub_name || '',
        hasSubName: !!s.sub_name,
        // INJECT EVERYTHING AS ONE XML BLOCK
        fullDescriptionXml: this.generateFullDescriptionXml(s.modifiedDefaults || [], s.link),
        unitPrice: this.formatPrice(s.unitPrice),
        pricingTiers: tiers,
        hasPricingTiers: tiers.length > 0,
        // Per-service pricing array used by {#pricing}{text}{/pricing} in template
        pricing: tiers,
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
      // Italic footnote paragraphs (editable in preview, defaults from italics_data.js)
      p_one: terms.p_one || italicData.p_one,
      p_two: terms.p_two || italicData.p_two,
      p_three: terms.p_three || italicData.p_three,
      p_four: terms.p_four || italicData.p_four,
      p_five: terms.p_five || italicData.p_five,
      p_six: terms.p_six || italicData.p_six,
      p_seven: terms.p_seven || italicData.p_seven,
      p_eight: terms.p_eight || italicData.p_eight,
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

      // ── Replace {%src} with {@imageXml} so we can inject raw XML ──
      let docXml = zip.file('word/document.xml').asText();
      docXml = docXml.replace(/\{%src\}/g, '{@imageXml}');
      zip.file('word/document.xml', docXml);

      // ── Inject bullet numbering definition (numId=3) into numbering.xml ──
      // This adds a proper 3-level bullet list so createBulletXml can reference it.
      // Level 0: • (Symbol), Level 1: o (Courier New), Level 2: ■ (Wingdings)
      let numberingXml = zip.file('word/numbering.xml').asText();
      if (!numberingXml.includes('w:abstractNumId="3"')) {
        const bulletAbstractNum =
          `<w:abstractNum w:abstractNumId="3">` +
            `<w:lvl w:ilvl="0">` +
              `<w:start w:val="1"/>` +
              `<w:numFmt w:val="bullet"/>` +
              `<w:lvlText w:val="\uF0B7"/>` +
              `<w:lvlJc w:val="left"/>` +
              `<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>` +
              `<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>` +
            `</w:lvl>` +
            `<w:lvl w:ilvl="1">` +
              `<w:start w:val="1"/>` +
              `<w:numFmt w:val="bullet"/>` +
              `<w:lvlText w:val="o"/>` +
              `<w:lvlJc w:val="left"/>` +
              `<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>` +
              `<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:hint="default"/></w:rPr>` +
            `</w:lvl>` +
            `<w:lvl w:ilvl="2">` +
              `<w:start w:val="1"/>` +
              `<w:numFmt w:val="bullet"/>` +
              `<w:lvlText w:val="\uF0A7"/>` +
              `<w:lvlJc w:val="left"/>` +
              `<w:pPr><w:ind w:left="1080" w:hanging="360"/></w:pPr>` +
              `<w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:hint="default"/></w:rPr>` +
            `</w:lvl>` +
          `</w:abstractNum>`;
        const bulletNum = `<w:num w:numId="3"><w:abstractNumId w:val="3"/></w:num>`;
        // Insert abstractNum before the first <w:num> and num before </w:numbering>
        numberingXml = numberingXml.replace(
          /<w:num /,
          `${bulletAbstractNum}<w:num `
        );
        numberingXml = numberingXml.replace(
          '</w:numbering>',
          `${bulletNum}</w:numbering>`
        );
        zip.file('word/numbering.xml', numberingXml);
      }

      // ── Inject images into the zip & build relationship entries ──
      const images = this.data.images || [];
      let relsContent = zip.file('word/_rels/document.xml.rels').asText();
      const imageRIds = [];
      const nextRId = 100; // High number to avoid collisions with existing rIds

      images.forEach((img, index) => {
        if (!img.imageData) {
          imageRIds.push(null);
          return;
        }

        const rId = `rId${nextRId + index}`;
        const base64 = img.imageData.replace(/^data:image\/[^;]+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');

        // Determine file extension from the data URI
        let ext = 'png';
        if (img.imageData.startsWith('data:image/jpeg')) ext = 'jpeg';
        if (img.imageData.startsWith('data:image/jpg')) ext = 'jpeg';
        const mediaName = `image_proposal_${index + 1}.${ext}`;

        // Add image binary to the zip
        zip.file(`word/media/${mediaName}`, buffer);

        // Add relationship entry
        const relEntry =
          `<Relationship Id="${rId}" ` +
          `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
          `Target="media/${mediaName}"/>`;
        relsContent = relsContent.replace('</Relationships>', `${relEntry}</Relationships>`);

        // Calculate dimensions
        let widthPx = 500, heightPx = 350;
        try {
          const dims = imageSize(buffer);
          if (dims && dims.width && dims.height) {
            widthPx  = dims.width;
            heightPx = dims.height;
          }
        } catch (e) {
          console.warn('⚠️ image-size failed, using fallback 500×350');
        }

        // Scale to fit within maxW × maxH (maxW 400px ≈ 4.17" leaves room for margins)
        const maxW = 400, maxH = 700;
        if (widthPx > maxW) {
          heightPx = Math.round(heightPx * (maxW / widthPx));
          widthPx  = maxW;
        }
        if (heightPx > maxH) {
          widthPx  = Math.round(widthPx * (maxH / heightPx));
          heightPx = maxH;
        }

        imageRIds.push({ rId, widthPx, heightPx });
      });

      // Write updated relationships back
      zip.file('word/_rels/document.xml.rels', relsContent);

      // ── Build template data & generate imageXml for each image ──
      const templateData = this.buildTemplateData();

      templateData.images = templateData.images.map((img, index) => {
        const info = imageRIds[index];
        if (!info) {
          return { ...img, imageXml: '' };
        }
        return {
          ...img,
          imageXml: this.generateImageXml(info.rId, info.widthPx, info.heightPx, index),
        };
      });

      // ── Render (no ImageModule needed) ──
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render(templateData);
      fs.writeFileSync(outputPath, doc.getZip().generate({ type: 'nodebuffer' }));
      return { success: true, filePath: outputPath };
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}

module.exports = TemplateDocxProposalGenerator;