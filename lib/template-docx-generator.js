const fs = require('fs');
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const ImageModule = require('docxtemplater-image-module-free');

/**
 * Template-based DOCX Proposal Generator
 * Uses the Word template file with docxtemplater for simple, maintainable document generation
 */
class TemplateDocxProposalGenerator {
  constructor(data = {}) {
    this.data = data;
    this.templatePath = path.join(process.cwd(), 'templates', 'proposal-template.docx');
  }

  /**
   * Format price for German locale (1234.56 -> 1.234,56)
   */
  formatPrice(price) {
    if (!price) return '0,00';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return num.toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Format date for German locale
   */
  formatDate(dateStr) {
    if (!dateStr) return 'XX.XX.XXXX';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Prepare data for template
   */
  prepareTemplateData() {
    const clientInfo = this.data.clientInfo || {};
    const projectInfo = this.data.projectInfo || {};
    const pricing = this.data.pricing || {};
    const signature = this.data.signature || {};
    const services = this.data.services || [];
    const images = this.data.images || [];

    // Prepare services table data
    const servicesData = services.map(service => {
      // Get description as nested structure (not formatted text)
      const description = service.modifiedDefaults || [];
      
      // Prepare pricing tiers as array
      const pricing = (service.pricingTiers || []).map(tier => ({
        text: tier.label
      }));
      
      // Prepare reference link if available
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

      // Raw XML for a clickable HYPERLINK field using "Expanded" Field Codes
      // We wrap the entire sequence in <w:p> tags, and include paragraph properties to REMOVE spacing
      const linkXml = service.link ? 
        `<w:p>` +
          `<w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
          `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Referenzen: </w:t></w:r>` + 
          `<w:r><w:fldChar w:fldCharType="begin"/></w:r>` +
          `<w:r><w:instrText xml:space="preserve"> HYPERLINK "${escapeXml(service.link)}" </w:instrText></w:r>` +
          `<w:r><w:fldChar w:fldCharType="separate"/></w:r>` +
          `<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t>KLICK</w:t></w:r>` +
          `<w:r><w:fldChar w:fldCharType="end"/></w:r>` +
        `</w:p>`
        : '';
        
      const referenceLink = service.link ? {
        url: service.link,
        linkXml: linkXml
      } : null;
      
      return {
        quantity: service.quantity || 1,
        // Make linkXml available at top level so {@linkXml} works directly
        linkXml: linkXml,
        name: service.name || '',
        description: description,
        pricing: pricing,
        hasPricing: pricing.length > 0, // Flag to show/hide pricing section
        hasReferenceLink: !!service.link, // Flag to show/hide reference link
        referenceLink: referenceLink,
        unitPrice: this.formatPrice(service.unitPrice)
      };
    });

    // Prepare images data
    const imagesData = images.map(image => ({
      title: image.title || '',
      description: image.description || '',
      hasImage: !!image.imageData,
      src: image.imageData
    }));

    // Calculate discount info
    const hasDiscount = pricing.discount && (pricing.discount.value > 0 || pricing.discount.amount);
    const discountAmount = hasDiscount ? (pricing.discount.amount || '0,00') : '0,00';
    const discountType = hasDiscount ? pricing.discount.type : '';
    const discountDescription = hasDiscount ? (pricing.discount.description || 'Rabatt') : '';

    // Calculate down payment and delivery conditions
    // Threshold for requiring down payment (default: 5000 EUR)
    const downPaymentThreshold = this.data.downPaymentThreshold || 5000;
    const totalGrossPrice = parseFloat(pricing.totalGrossPrice) || 0;
    const requiresDownPayment = totalGrossPrice > downPaymentThreshold;
    
    // Calculate 50% down payment
    const downPaymentAmount = requiresDownPayment ? (totalGrossPrice * 0.5) : 0;
    const formattedDownPayment = this.formatPrice(downPaymentAmount);
    
    // Delivery time variables
    const deliveryDays = projectInfo.deliveryTime || projectInfo.DD || 'XXX';
    
    // Calculate detailed date components for offer validity
    const validUntilDateObj = projectInfo.offerValidUntil ? new Date(projectInfo.offerValidUntil) : new Date();
    const validDay = String(validUntilDateObj.getDate()).padStart(2, '0');
    const validMonth = String(validUntilDateObj.getMonth() + 1).padStart(2, '0');

    return {
      // Client Info
      companyName: clientInfo.companyName || 'Firma',
      street: clientInfo.street || 'Straße',
      postalCode: clientInfo.postalCode || 'PLZ',
      city: clientInfo.city || 'Ort',
      country: clientInfo.country || 'Deutschland',

      // Project Info
      offerNumber: this.data.offerNumber || `${projectInfo.MM || 'XX'}-${projectInfo.DD || 'XX'}-${projectInfo.year || '2026'}-8`,
      date: this.formatDate(projectInfo.date) || this.formatDate(new Date()),
      offerValidUntil: this.formatDate(projectInfo.offerValidUntil),
      offerValidDay: validDay,
      offerValidMonth: validMonth,
      deliveryTime: projectInfo.deliveryTime || 'XXX Werktage', // Keep for backward compatibility
      deliveryDays: deliveryDays,
      DD: deliveryDays, // Alias for template usage
      projectName: projectInfo.projectName || '',
      projectNumber: projectInfo.projectNumber || '',
      
      // Delivery Conditions
      requiresDownPayment: requiresDownPayment,
      downPaymentAmount: formattedDownPayment,
      downPaymentThreshold: this.formatPrice(downPaymentThreshold),

      // Services
      services: servicesData,
      hasServices: servicesData.length > 0,

      // Images
      images: imagesData,
      hasImages: imagesData.length > 0,

      // Pricing
      subtotalNet: this.formatPrice(pricing.subtotalNet),
      hasDiscount: hasDiscount,
      discountDescription: discountDescription,
      discountAmount: discountAmount,
      discountType: discountType === 'percentage' ? '%' : '€',
      totalNetPrice: this.formatPrice(pricing.totalNetPrice),
      totalVat: this.formatPrice(pricing.totalVat),
      totalGrossPrice: this.formatPrice(pricing.totalGrossPrice),

      // Signature
      signatureName: signature.signatureName || 'Christopher Helm',

      // Company Footer
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
      contactPhone: 'Tel: +49-7531-1227491'
    };
  }

  /**
   * Format service description from array to string with bullet points
   * Supports up to 3 levels of nested bullets
   */
  formatServiceDescription(service) {
    // Use modifiedDefaults if available (edited defaults), otherwise leave empty
    const descriptions = service.modifiedDefaults;
    
    if (!descriptions || descriptions.length === 0) {
      return 'Beschreibung nicht verfügbar';
    }

    const lines = [];
    
    const formatBullet = (item, level = 0) => {
      // Define bullet styles for each level
      const bullets = ['•', '○', '▪', '·'];
      const indent = '  '.repeat(level);
      const bullet = bullets[Math.min(level, bullets.length - 1)];
      
      if (typeof item === 'string') {
        lines.push(`${indent}${bullet} ${item}`);
      } else if (typeof item === 'object' && item.text) {
        lines.push(`${indent}${bullet} ${item.text}`);
        
        // Recursively format children (supports unlimited depth)
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            formatBullet(child, level + 1);
          });
        }
      }
    };
    
    // Format all top-level items
    descriptions.forEach(item => formatBullet(item, 0));

    return lines.join('\n');
  }

  /**
   * Format pricing tiers for display in service description
   */
  formatPricingTiers(service) {
    // Check if service has pricing tier information
    if (!service.pricingTiers || service.pricingTiers.length === 0) {
      return '';
    }

    const lines = ['Preisstaffelung:'];
    service.pricingTiers.forEach(tier => {
      lines.push(`  • ${tier.label}`);
    });

    return lines.join('\n');
  }

  /**
   * Generate the proposal document
   */
  async generate(outputPath) {
    try {
      // Check if template exists
      if (!fs.existsSync(this.templatePath)) {
        throw new Error(`Template file not found at: ${this.templatePath}`);
      }

      // Load the template
      const content = fs.readFileSync(this.templatePath, 'binary');
      const zip = new PizZip(content);
      
      // Configure image module
      const imageOptions = {
        centered: false, // Set to false to allow text wrapping if needed, default is false usually
        getImage: function (tagValue, tagName) {
          // tagValue is the Base64 image data
          // Remove the data URL prefix if present
          if (!tagValue) return Buffer.alloc(0);
          const base64Data = tagValue.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
          return Buffer.from(base64Data, "base64");
        },
        getSize: function (img, tagValue, tagName) {
          // Get image dimensions using image-size library
          const sizeOf = require('image-size');
          const dimensions = sizeOf(img);
          
          // Target width: 400px (at 96 DPI = ~302 EMUs per pixel for Word)
          const targetWidth = 400;
          const aspectRatio = dimensions.height / dimensions.width;
          const targetHeight = Math.round(targetWidth * aspectRatio);
          
          return [targetWidth, targetHeight]; 
        }
      };
      
      const imageModule = new ImageModule(imageOptions);

      // Create docxtemplater instance
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        modules: [imageModule],
        nullGetter: () => ''
      });

      // Prepare and set data
      const templateData = this.prepareTemplateData();
      
      // Log template data for debugging
      console.log('Template data services:', JSON.stringify(templateData.services, null, 2));
      
      doc.render(templateData);

      // Generate the document
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      });

      // Write to file
      fs.writeFileSync(outputPath, buffer);
      
      console.log('✅ Proposal document generated successfully:', outputPath);
      return {
        success: true,
        filePath: outputPath,
        offerNumber: templateData.offerNumber
      };

    } catch (error) {
      console.error('❌ Error generating proposal document:', error);
      
      // More detailed error logging
      if (error.properties && error.properties.errors) {
        console.error('=== TEMPLATE ERRORS ===');
        error.properties.errors.forEach((err, index) => {
           // Log message and full error object for clarity
          console.error(`Error ${index + 1}:`, err.message);
          console.error('Full details:', JSON.stringify(err, null, 2));
        });
        console.error('=======================');
      }
      
      throw error;
    }
  }
}

module.exports = TemplateDocxProposalGenerator;
