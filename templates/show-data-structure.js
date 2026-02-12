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
  offerValidMonth: "02",
  deliveryTime: "14-21 Werktage",

  // Services (array - use loop {#services}...{/services})
  services: [
    {
      quantity: "2",
      name: "3D Außenvisualisierung Bodenperspektive",
      // Nested description for {#description}...{/description} loop
      description: [
        {
          text: "Fotorealistische 3D-Visualisierung aus Bodenperspektive",
          children: [
            { text: "Hochauflösende Darstellung (min. 3000px)", children: [] },
            { text: "Professionelle Lichtsetzung und Materialisierung", children: [] }
          ]
        }
      ],
      // Flat description string (fallback for {description_text})
      description_text: "• Fotorealistische 3D-Visualisierung aus Bodenperspektive\n  ○ Hochauflösende Darstellung (min. 3000px)\n  ○ Professionelle Lichtsetzung und Materialisierung",
      unitPrice: "399,00",
      link: "https://www.exposeprofi.de/referenzen",
      hasLink: true,
      pricingTiers: [{ text: "Ab 3 Stück: 349,00 €" }],
      hasPricingTiers: true
    },
    {
      quantity: "1",
      name: "3D Grundriss",
      description: [
        { text: "Fotorealistischer 3D-Grundriss", children: [] },
        { text: "Möblierte Darstellung", children: [] }
      ],
      description_text: "• Fotorealistischer 3D-Grundriss\n• Möblierte Darstellung",
      unitPrice: "69,00",
      link: "",
      hasLink: false,
      pricingTiers: [],
      hasPricingTiers: false
    }
  ],
  hasServices: true,

  // Pricing tiers (flat list across all services, for {#pricing}...{/pricing})
  pricing: [{ text: "Ab 3 Stück: 349,00 €" }],
  hasPricing: true,

  // Images (array - use loop {#images}...{/images})
  // Use {%src} for inline image insertion
  images: [
    {
      title: "Perspektive 1 - Hauptansicht",
      description: "Ansicht der Immobilie von Süden",
      hasImage: true,
      src: "data:image/png;base64,..." // base64 data URI
    }
  ],
  hasImages: true,

  // Pricing summary
  subtotalNet: "867,00",
  sutotaNet: "867,00",            // alias (template typo compat)
  totalNetPrice: "817,00",
  totalVat: "155,23",
  totalGrossPrice: "972,23",
  totalCrossPrice: "972,23",      // alias (template typo compat)

  // Discount
  hasDiscount: true,
  discountDescription: "Mengenrabatt",
  discountAmount: "50,00",
  discountType: "€",

  // Conditional: small order (≤ 2000€ net) vs large order (> 2000€ net)
  hasSmallValue: true,            // net ≤ 2000
  hasSmallalue: true,             // alias (template typo compat)
  hasLargeValue: false,           // net > 2000

  // Delivery / payment details
  estimatedDeliveryDay: "14-21",
  estimatedDeliverDay: "14-21",   // alias (template typo compat)
  halfAmount: "0,00",             // 50% gross (for advance payment)
  remainingAmount: "972,23",      // remaining after advance

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
