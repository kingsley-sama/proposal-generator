// Configuration for proposal form
const CONFIG = {
  projectTypes: [
    'Einfamilienhaus',
    'Mehrfamilienhaus',
    'Wohnanlage',
    'Gewerbeimmobilie',
    'Bürogebäude',
    'Hotel',
    'Einzelhandel',
    'Industriegebäude',
    'Mixed-Use',
    'Custom' // Special option to allow custom input
  ],
  
  // Delivery time calculation based on service types and quantity
  deliveryTimeRules: {
    'exterior-ground': { baseTime: 7, additionalPerUnit: 2 },
    'exterior-bird': { baseTime: 3, additionalPerUnit: 1 },
    'interior': { baseTime: 5, additionalPerUnit: 2 },
    'terrace': { baseTime: 5, additionalPerUnit: 0 },
    '3d-floorplan': { baseTime: 3, additionalPerUnit: 1 },
    '3d-complete-floor': { baseTime: 5, additionalPerUnit: 2 },
    '3d-siteplan': { baseTime: 5, additionalPerUnit: 0 },
    '2d-floorplan': { baseTime: 2, additionalPerUnit: 1 },
    'homestaging': { baseTime: 3, additionalPerUnit: 1 },
    'virtual-renovation': { baseTime: 3, additionalPerUnit: 1 },
    'furniture-removal': { baseTime: 2, additionalPerUnit: 1 },
    'virtual-tour': { baseTime: 10, additionalPerUnit: 0 },
    'video-tour': { baseTime: 14, additionalPerUnit: 0 },
    'expose-design': { baseTime: 3, additionalPerUnit: 0 }
  },
  
  // Offer number starting counter
  offerNumberStart: 8,
  
  // Offer validity in days
  offerValidityDays: 7, // Changed from 14 to 7
  
  // Delivery conditions templates
  deliveryConditions: {
    standardOnly: `Die Lieferung erfolgt digital via E-Mail oder Link nach vollständiger Zahlung und Erhalt aller notwendigen Unterlagen.`,
    withVirtualTour: `Die Lieferung erfolgt digital via E-Mail oder Link nach vollständiger Zahlung und Erhalt aller notwendigen Unterlagen. Bei Bestellung eines virtuellen Rundgangs erfolgt die Bereitstellung über einen Link zur Online-Plattform.`
  },
  
  // Footer notes
  footerNotes: {
    note1: `Sollten Sie dadurch eine weitere Revision benötigen, die nicht durch uns verschuldet wurde, führen wir diese zum Kostenlosen Grundpreis durch. Bei komplexeren Änderungswünschen, welche eine deutlich längere Bearbeitungszeit benötigen, behalten wir uns das Recht vor, 50% der ursprünglichen Leistung zu berechnen. Bei Hunderten von Projekten benötigen unsere Kunden im Schnitt unter 6% aller Fälle eine zweite Revision. 50% der ursprünglichen Leistung bedeutet bei einer Revision durchschnittlich 2-3 Arbeitstage.`,
    note2: {
      withoutVirtualTour: `Die Lieferzeit beginnt nach Auftragsbestätigung und Zahlungseingang der Anzahlung.`,
      withVirtualTour: `Die Lieferzeit beginnt nach Auftragsbestätigung und Zahlungseingang der Anzahlung. Bei Bestellung eines virtuellen Rundgangs kann die Bereitstellung zusätzliche 3-5 Werktage in Anspruch nehmen.`
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
