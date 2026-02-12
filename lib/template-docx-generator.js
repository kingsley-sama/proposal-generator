const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ImageRun, Footer,
  ShadingType, convertInchesToTwip, TableLayoutType, ExternalHyperlink
} = require('docx');

/**
 * Programmatic DOCX Proposal Generator
 * Uses the `docx` library to generate documents that match the preview exactly.
 * Consistent fonts, alignment, bullets, and pricing layout.
 */
class TemplateDocxProposalGenerator {
  constructor(data = {}) {
    this.data = data;
    this.fontName = 'Calibri';
    this.fontSize = 22;       // 11pt in half-points
    this.smallFontSize = 18;  // 9pt
    this.tinyFontSize = 16;   // 8pt
    this.brandColor = '022e64';
  }

  /** Format price for German locale (1234.56 -> 1.234,56) */
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

  /** Format date for German locale */
  formatDate(dateStr) {
    if (!dateStr) return 'XX.XX.XXXX';
    // Already formatted as DD.MM.YYYY?
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  tr(text, opts = {}) {
    return new TextRun({
      text, font: this.fontName, size: opts.size || this.fontSize,
      bold: opts.bold || false, italics: opts.italics || false,
      color: opts.color || '000000', underline: opts.underline || undefined,
      ...opts
    });
  }

  p(text, opts = {}) {
    const runs = typeof text === 'string' ? [this.tr(text, opts)] : text;
    return new Paragraph({
      children: runs,
      spacing: { after: opts.spacingAfter !== undefined ? opts.spacingAfter : 120, before: opts.spacingBefore || 0 },
      alignment: opts.alignment || AlignmentType.LEFT,
      indent: opts.indent || undefined,
    });
  }

  /** Build bullet paragraphs from nested description array */
  buildBullets(items, level = 0) {
    const out = [];
    if (!items || !items.length) return out;
    const bullet = '•';
    const indentLeft = 200 + level * 200;
    items.forEach(item => {
      const text = typeof item === 'string' ? item : (item.text || '');
      const children = typeof item === 'object' ? item.children : null;
      if (text) {
        out.push(new Paragraph({
          children: [this.tr(`${bullet} ${text}`, { size: this.smallFontSize })],
          spacing: { after: 30, before: 0 },
          indent: { left: indentLeft }
        }));
      }
      if (children && children.length) out.push(...this.buildBullets(children, level + 1));
    });
    return out;
  }

  noBorder() {
    return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  }

  cellBorders() {
    const b = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
    return { top: b, bottom: b, left: b, right: b };
  }

  cell(content, opts = {}) {
    const children = Array.isArray(content) ? content : [content];
    return new TableCell({
      width: opts.width, borders: opts.borders || this.cellBorders(),
      shading: opts.shading, verticalAlign: opts.verticalAlign || 'center',
      children,
    });
  }

  /** Build the services table */
  buildServicesTable(services) {
    const hdrShade = { type: ShadingType.SOLID, color: 'E8E8E8', fill: 'E8E8E8' };
    const tierShade = { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' };
    const hdr = (t) => this.p(t, { bold: true, size: this.smallFontSize, alignment: AlignmentType.CENTER, spacingAfter: 40, spacingBefore: 40 });

    const rows = [
      new TableRow({ children: [
        this.cell(hdr('Anz.'), { width: { size: 7, type: WidthType.PERCENTAGE }, shading: hdrShade }),
        this.cell(hdr('Bezeichnung'), { width: { size: 20, type: WidthType.PERCENTAGE }, shading: hdrShade }),
        this.cell(hdr('Beschreibung'), { width: { size: 55, type: WidthType.PERCENTAGE }, shading: hdrShade }),
        this.cell(hdr('Stückpreis netto'), { width: { size: 18, type: WidthType.PERCENTAGE }, shading: hdrShade }),
      ]})
    ];

    services.forEach(service => {
      const descParas = this.buildBullets(service.modifiedDefaults || []);

      // Reference link as last bullet item
      if (service.link) {
        const bullet = '•';
        descParas.push(new Paragraph({
          children: [
            this.tr(`${bullet} `, { size: this.smallFontSize }),
            this.tr('Referenzen: ', { size: this.smallFontSize, bold: true }),
            new ExternalHyperlink({
              children: [this.tr('KLICK', { size: this.smallFontSize, color: '0563C1', underline: {} })],
              link: service.link
            })
          ],
          spacing: { after: 30, before: 0 },
          indent: { left: 200 }
        }));
      }

      if (!descParas.length) descParas.push(this.p('', { size: this.smallFontSize, spacingAfter: 30 }));

      rows.push(new TableRow({ children: [
        this.cell(this.p(String(service.quantity || 1), { size: this.smallFontSize, alignment: AlignmentType.CENTER, spacingAfter: 40 })),
        this.cell(this.p(service.name || '', { size: this.smallFontSize, spacingAfter: 40 })),
        this.cell(descParas),
        this.cell(this.p(`${this.formatPrice(service.unitPrice)} €`, { size: this.smallFontSize, alignment: AlignmentType.CENTER, spacingAfter: 40 })),
      ]}));

      // Pricing tiers
      if (service.pricingTiers && service.pricingTiers.length) {
        rows.push(new TableRow({ children: [
          this.cell(this.p('', { spacingAfter: 20 }), { shading: tierShade }),
          this.cell(this.p('', { spacingAfter: 20 }), { shading: tierShade }),
          this.cell(this.p('Preisstaffelung:', { bold: true, size: this.smallFontSize, spacingAfter: 20 }), { shading: tierShade }),
          this.cell(this.p('', { spacingAfter: 20 }), { shading: tierShade }),
        ]}));
        service.pricingTiers.forEach(tier => {
          rows.push(new TableRow({ children: [
            this.cell(this.p('', { spacingAfter: 10 }), { shading: tierShade }),
            this.cell(this.p('', { spacingAfter: 10 }), { shading: tierShade }),
            this.cell(new Paragraph({
              children: [this.tr(tier.label, { size: this.tinyFontSize })],
              spacing: { after: 10 }, indent: { left: 200 }
            }), { shading: tierShade }),
            this.cell(this.p('', { spacingAfter: 10 }), { shading: tierShade }),
          ]}));
        });
      }
    });

    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, rows });
  }

  /** Build pricing summary table */
  buildPricingSummary(pricing, hasDiscount, discountInfo) {
    const b = this.cellBorders();
    const row = (label, value, opts = {}) => new TableRow({ children: [
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, borders: b, shading: opts.shading,
        children: [this.p(label, { bold: true, spacingAfter: 60, spacingBefore: 60 })] }),
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: b, shading: opts.shading,
        children: [this.p(value, { bold: true, alignment: AlignmentType.RIGHT, spacingAfter: 60, spacingBefore: 60 })] }),
    ]});
    const rows = [row('Zwischensumme (Netto)', `${this.formatPrice(pricing.subtotalNet)} €`)];
    if (hasDiscount && discountInfo) {
      const shade = { type: ShadingType.SOLID, color: 'FFF9E6', fill: 'FFF9E6' };
      rows.push(row(`Rabatt: ${discountInfo.description || 'Mengenrabatt'}`, `- ${this.formatPrice(discountInfo.amount)} €`, { shading: shade }));
    }
    rows.push(row('Summe (Netto)', `${this.formatPrice(pricing.totalNetPrice)} €`));
    rows.push(row('MwSt. (19%)', `${this.formatPrice(pricing.totalVat)} €`));
    rows.push(row('Gesamtbruttopreis', `${this.formatPrice(pricing.totalGrossPrice)} €`));
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
  }

  /** Create footer */
  createFooter() {
    const nb = this.noBorder();
    const noBorders = { top: nb, bottom: nb, left: nb, right: nb };
    const t = (s) => this.p(s, { size: this.tinyFontSize, spacingAfter: 15 });
    const tb = (s) => this.p(s, { size: this.tinyFontSize, bold: true, spacingAfter: 15 });
    return new Footer({ children: [
      new Paragraph({ children: [], spacing: { after: 0 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 4 } } }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ children: [
          new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, borders: noBorders, children: [
            tb('ExposeProfi.de'), t('EPCS GmbH'), t('GF: Christopher Helm'),
            t('Bruder-Klaus-Str. 3a'), t('78467 Konstanz'),
            t('HRB 725172, AG Freiburg'), t('St.-Nr: 0908011277'), t('USt-ID: DE347265281'),
          ]}),
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: noBorders, children: [
            tb('Bankverbindung'), t('Qonto (Banque de France)'), t('IBAN DE62100101239488471916'),
          ]}),
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, borders: noBorders, children: [
            tb('Kontakt'), t('christopher.helm@exposeprofi.de'), t('www.exposeprofi.de'), t('+49-7531-1227491'),
          ]}),
        ]}),
      ]})
    ]});
  }

  /** Main generation method */
  async generate(outputPath) {
    try {
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
      const hasVirtualTour = services.some(s => s.name && (s.name.includes('360°') || s.name.toLowerCase().includes('virtuelle tour')));
      const hasDiscount = pricing.discount && (pricing.discount.value > 0 || pricing.discount.amount);
      const discountInfo = hasDiscount ? pricing.discount : null;
      const deliveryDays = projectInfo.deliveryTime || '4-6';

      const footer = this.createFooter();
      const sectionProps = {
        page: { margin: { top: convertInchesToTwip(0.8), bottom: convertInchesToTwip(1.4), left: convertInchesToTwip(1), right: convertInchesToTwip(1) } }
      };

      // ===== PAGE 1: Cover =====
      const cover = [
        this.p([this.tr('ExposeProfi.de | EPCS GmbH | Bruder-Klaus-Straße 3a | 78467 Konstanz', { size: 18, color: this.brandColor })], { spacingAfter: 300 }),
        this.p(clientInfo.companyName || 'Firma', { bold: true, spacingAfter: 40 }),
        this.p(clientInfo.street || '', { spacingAfter: 40 }),
        this.p(`${clientInfo.postalCode || ''} ${clientInfo.city || ''}`, { spacingAfter: 40 }),
        this.p(clientInfo.country || 'Deutschland', { spacingAfter: 250 }),
        this.p(dateStr, { alignment: AlignmentType.RIGHT, spacingAfter: 350 }),
        this.p([this.tr(`Angebot Nr. ${offerNumber}`, { size: 32, bold: true })], { spacingAfter: 250 }),
        this.p('Vielen Dank für Ihre Anfrage und Ihr damit verbundenes Interesse an einer Zusammenarbeit.', { spacingAfter: 180 }),
        this.p([this.tr('Die Vorteile zusammengefasst, die Sie erwarten können:', { bold: true })], { spacingAfter: 200 }),
        // Benefits
        this.p([this.tr('1. Fotorealismus: ', { bold: true }), this.tr('Wir erstellen ausschließlich emotionale 3D-Visualisierungen der höchsten Qualitätsstufe.')], { spacingAfter: 100 }),
        this.p([this.tr('2. Persönliche & individuelle Betreuung: ', { bold: true }), this.tr('Sie erhalten bei jedem Projekt die Unterstützung von einem persönlichen Ansprechpartner, der die Visualisierungen individuell für Sie erstellt und immer per Telefon oder Email erreichbar ist.')], { spacingAfter: 100 }),
        this.p([this.tr('3. Effiziente Prozesse & schnelle Lieferzeit: ', { bold: true }), this.tr('Wie Sie sehen, melden wir uns innerhalb von 24h mit einem Angebot bei Ihnen. Ihr Projekt verläuft ab Start ebenso reibungslos und Sie erhalten die Visualisierungen schnellstmöglich.')], { spacingAfter: 100 }),
        this.p([this.tr('4. Korrekturschleifen: ', { bold: true }), this.tr('Falls Sie Änderungswünsche haben, bieten wir Ihnen ein eigenes Tool, mit dem Sie direkt in der Visualisierung Kommentare hinterlassen können. Das spart Zeit und Missverständnisse.')], { spacingAfter: 100 }),
        this.p([this.tr('5. Preiswert: ', { bold: true }), this.tr('Aufgrund effizienter Prozesse bieten wir günstigere Preise bei gleicher Qualität und besserer Betreuung.')], { spacingAfter: 100 }),
      ];

      // ===== PAGE 2: Services Table =====
      const servicesPage = [
        this.p([this.tr('Basierend auf den zugesandten Unterlagen unterbreiten wir Ihnen folgendes Angebot:', { bold: true, size: 20 })], { spacingAfter: 200 }),
        this.buildServicesTable(services),
      ];

      // ===== PAGE 3: Images (optional) =====
      const imagesPage = [];
      if (images && images.length > 0) {
        imagesPage.push(this.p([this.tr('Perspektivbilder', { bold: true, size: 28 })], { spacingAfter: 200 }));
        for (const image of images) {
          if (image.title) imagesPage.push(this.p(image.title, { bold: true, spacingAfter: 60 }));
          if (image.description) imagesPage.push(this.p(image.description, { spacingAfter: 100 }));
          if (image.imageData) {
            try {
              const base64Data = image.imageData.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, '');
              const imageBuffer = Buffer.from(base64Data, 'base64');
              let imgW = 500, imgH = 350;
              try {
                const sizeOf = require('image-size');
                const dims = sizeOf(imageBuffer);
                const ratio = dims.height / dims.width;
                imgW = 500; imgH = Math.round(500 * ratio);
              } catch (_) { /* use defaults */ }
              imagesPage.push(new Paragraph({
                children: [new ImageRun({ data: imageBuffer, transformation: { width: imgW, height: imgH } })],
                spacing: { after: 300 }, alignment: AlignmentType.CENTER
              }));
            } catch (e) { console.error('Image error:', e); }
          }
        }
      }

      // ===== PAGE 4: Summary & Terms =====
      const summaryPage = [
        this.p([this.tr('Zusammenfassung:', { bold: true, size: 26 })], { spacingAfter: 200 }),
        this.buildPricingSummary(pricing, hasDiscount, discountInfo),
        // Validity
        this.p([this.tr('Dieses Angebot ist gültig bis: ', { bold: true }), this.tr(validUntilStr, { bold: true })], { spacingAfter: 250, spacingBefore: 300 }),
        // Delivery method
        this.p([this.tr('Lieferweg: ', { bold: true }), this.tr('Digital via Email')], { spacingAfter: 100 }),
      ];

      // Delivery time – conditional on net > 2000 EUR
      if (requiresAdvancePayment) {
        summaryPage.push(this.p([
          this.tr('Voraussichtl. Leistungsdatum: ', { bold: true }),
          this.tr(`${deliveryDays} Arbeitstage nach Eingang der Anzahlung i.H.v. 50% des Bruttopreises (${this.formatPrice(advanceAmount)} EUR) und Erhalt aller Unterlagen und Informationen`)
        ], { spacingAfter: 100 }));
      } else {
        summaryPage.push(this.p([
          this.tr('Voraussichtl. Leistungsdatum: ', { bold: true }),
          this.tr(`${deliveryDays} Arbeitstage nach Auftragseingang und Erhalt aller Unterlagen und Informationen`)
        ], { spacingAfter: 100 }));
      }

      // Payment terms – conditional on net > 2000 EUR
      if (requiresAdvancePayment) {
        summaryPage.push(this.p([
          this.tr('Zahlungsbedingungen: ', { bold: true }),
          this.tr(`Anzahlung i.H.v. 50% (${this.formatPrice(advanceAmount)} €) bei Beauftragung, Restzahlung (${this.formatPrice(remainingAmount)} €) nach Lieferung – zahlbar innerhalb 14 Tagen netto`)
        ], { spacingAfter: 250 }));
      } else {
        summaryPage.push(this.p([
          this.tr('Zahlungsbedingungen: ', { bold: true }),
          this.tr('Zahlung nach Lieferung – zahlbar innerhalb 14 Tagen netto')
        ], { spacingAfter: 250 }));
      }

      // Closing signature
      summaryPage.push(
        this.p('Mit freundlichen Grüßen', { italics: true, spacingAfter: 60, spacingBefore: 200 }),
        this.p(signature.signatureName || 'Christopher Helm', { italics: true, spacingAfter: 350 }),
      );

      // Footnotes
      summaryPage.push(
        this.p([this.tr('Hinweise:', { size: this.tinyFontSize, bold: true })], { spacingAfter: 60, spacingBefore: 200 }),
        new Paragraph({
          children: [
            this.tr('⁽¹⁾ ', { size: this.tinyFontSize }),
            this.tr('Sollten Sie dadurch eine weitere Revision benötigen, die nicht durch uns verschuldet wurde, führen wir diese zum kostenlosen Grundpreis durch. Bei komplexeren Änderungswünschen, welche eine deutlich längere Bearbeitungszeit benötigen, behalten wir uns das Recht vor, 50% der ursprünglichen Leistung zu berechnen. Bei Hunderten von Projekten benötigen unsere Kunden im Schnitt unter 6% aller Fälle eine zweite Revision. 50% der ursprünglichen Leistung bedeutet bei einer Revision durchschnittlich 2-3 Arbeitstage.', { size: this.tinyFontSize }),
          ],
          spacing: { after: 60 }
        }),
        new Paragraph({
          children: [
            this.tr('⁽²⁾ ', { size: this.tinyFontSize }),
            this.tr(
              hasVirtualTour
                ? 'Die Lieferzeit beginnt nach Auftragsbestätigung und Zahlungseingang der Anzahlung. Bei Bestellung eines virtuellen Rundgangs kann die Bereitstellung zusätzliche 3-5 Werktage in Anspruch nehmen.'
                : 'Die Lieferzeit beginnt nach Auftragsbestätigung und Zahlungseingang der Anzahlung.',
              { size: this.tinyFontSize }
            ),
          ],
          spacing: { after: 60 }
        }),
      );

      // ===== Assemble Document =====
      const sections = [
        { properties: sectionProps, footers: { default: footer }, children: cover },
        { properties: sectionProps, footers: { default: footer }, children: servicesPage },
      ];
      if (imagesPage.length > 0) {
        sections.push({ properties: sectionProps, footers: { default: footer }, children: imagesPage });
      }
      sections.push({ properties: sectionProps, footers: { default: footer }, children: summaryPage });

      const doc = new Document({
        styles: { default: { document: { run: { font: this.fontName, size: this.fontSize } } } },
        sections,
      });

      const buffer = await Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      console.log('✅ Proposal document generated successfully:', outputPath);
      return { success: true, filePath: outputPath, offerNumber };
    } catch (error) {
      console.error('❌ Error generating proposal document:', error);
      throw error;
    }
  }
}

module.exports = TemplateDocxProposalGenerator;
