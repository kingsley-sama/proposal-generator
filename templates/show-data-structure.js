#!/usr/bin/env node

/**
 * Template Placeholder Helper
 * 
 * This script helps you understand what data is available for your Word template.
 * Run: node templates/show-data-structure.js
 */

const sampleData = {
  // Client Information
  companyName: "Mustermann GmbH",
  street: "Musterstraße 123",
  postalCode: "12345",
  city: "München",
  country: "Deutschland",

  // Project Information
  offerNumber: "2026-01-29-8",
  date: "29.01.2026",
  offerValidUntil: "05.02.2026",
  deliveryTime: "14-21 Werktage",
  projectName: "Wohnkomplex Sonnenweg",
  projectNumber: "PRJ-2026-001",

  // Services (array - use loop in template)
  services: [
    {
      quantity: 2,
      name: "3D Außenvisualisierung Bodenperspektive",
      description: "• Fotorealistische 3D-Visualisierung aus Bodenperspektive\n• Hochauflösende Darstellung (min. 3000px)\n• Professionelle Lichtsetzung und Materialisierung",
      unitPrice: "399,00"
    },
    {
      quantity: 1,
      name: "3D Grundriss",
      description: "• Fotorealistischer 3D-Grundriss\n• Möblierte Darstellung\n• Hochauflösende Qualität",
      unitPrice: "69,00"
    }
  ],
  hasServices: true,

  // Images (array - use loop in template)
  images: [
    {
      title: "Perspektive 1 - Hauptansicht",
      description: "Ansicht der Immobilie von Süden",
      hasImage: true
    }
  ],
  hasImages: true,

  // Pricing
  subtotalNet: "867,00",
  hasDiscount: true,
  discountDescription: "Mengenrabatt",
  discountAmount: "50,00",
  discountType: "€",
  totalNetPrice: "817,00",
  totalVat: "155,23",
  totalGrossPrice: "972,23",

  // Signature
  signatureName: "Christopher Helm",

  // Company Footer
  companyName_footer: "ExposeProfi.de",
  companyLegal: "EPCS GmbH",
  companyManager: "GF: Christopher Helm",
  companyAddress: "Bruder-Klaus-Str. 3a, 78467 Konstanz",
  companyRegister: "HRB 725172, Amtsgericht Freiburg",
  companyTaxId: "St.-Nr: 0908011277",
  companyVatId: "USt-ID: DE347265281",
  bankName: "Qonto (Banque de France)",
  bankIban: "IBAN DE62100101239488471916",
  contactEmail: "christopher.helm@exposeprofi.de",
  contactWeb: "www.exposeprofi.de",
  contactPhone: "Tel: +49-7531-1227491"
};

console.log("=".repeat(70));
console.log("📄 WORD TEMPLATE DATA STRUCTURE");
console.log("=".repeat(70));
console.log("\n✅ This is the data structure that will be passed to your Word template.\n");
console.log("📝 Use placeholders like {companyName}, {offerNumber}, etc. in your template.\n");
console.log("🔁 For arrays (services, images), use loops:\n");
console.log("   {#services}");
console.log("     {quantity} {name} - {unitPrice}");
console.log("   {/services}\n");
console.log("=".repeat(70));
console.log("\nSAMPLE DATA:\n");
console.log(JSON.stringify(sampleData, null, 2));
console.log("\n" + "=".repeat(70));
console.log("\n📚 For more details, see: templates/TEMPLATE_GUIDE.md\n");
