const port = process.env.PORT || 3000;

refferences = [
    'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen',
    'https://www.exposeprofi.de/3d-visualisierungen/innenvisualisierungen',
    'https://www.exposeprofi.de/3d-visualisierungen/3d-grundrisse',
    'https://www.exposeprofi.de/workflow/2d-grundriss-designs',
    'https://www.exposeprofi.de/digitales-home-staging',
    'https://www.exposeprofi.de/digitales-home-staging#referenzen-virtuelle-renovierung',
    'https://www.exposeprofi.de/3d-visualisierungen/virtuelle-rundgaenge',
    'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen#referenzen-virtueller-videorundgang',
    'https://drive.google.com/file/d/1AW2T7wzx9-HxSOBx214YoM5MnXA3c8kp/view?usp=sharing',
    'https://www.exposeprofi.de/workflow/exposedesigns',

]

const serviceDescriptions = {
  'exterior-ground': {
    name: '3D-Außenvisualisierung Bodenperspektive',
    sub_name: '(Projekt mit XX Wohneinheiten)',
    link: 'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen',
    description: [
      {
        text: 'Geliefert werden {{QUANTITY}} gerenderte Außenansichten des Objektes „{{PROJECT_NAME}}" aus den folgenden Bodenperspektiven (siehe rote Pfeile):',
        children: [
        ]
      },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Auf Wunsch eingefügt in von Ihnen zu liefernde Drohnenfotos oder schematische Modellierung der Umgebung', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: 'Format: 2.500 x 1.500 px (300 DPI)', children: [] },
    ],
    // Pricing tiers are dynamically generated based on building type in preview
    pricingTiers: []
  },
  'exterior-bird': {
    name: '3D-Außenvisualisierung Vogelperspektive',
    sub_name: '(Projekt mit XX Wohneinheiten)',
    link: 'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen',
    description: [
      {
        text: 'Geliefert wird {{QUANTITY}}x gerenderte Außenansicht des Objektes „{{PROJECT_NAME}}" aus der folgenden Vogelperspektive (siehe blauen Pfeil):',
        children: [
        ]
      },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Auf Wunsch eingefügt in von Ihnen zu liefernde Drohnenfotos oder schematische Modellierung der Umgebung', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: 'Format: 2.500 x 1.500 px (300 DPI)', children: [] },
      { text: 'Nur in Kombination mit allen im Angebot aufgeführten Bodenperspektiven verfügbar', children: [] }
    ],
    pricingTiers: [
      { quantity: 1, price: 199, label: '1 Ansicht Netto: 199,00 €' },
      { quantity: 2, price: 149, label: '2 Ansichten: Netto pro Ansicht: 149,00 €' },
      { quantity: 3, price: 99, label: '≥3 Ansichten: Netto pro Ansicht: 99,00 €' }
    ]
  },
  'interior': {
    name: '3D-Innenvisualisierung',
    link: 'https://www.exposeprofi.de/3d-visualisierungen/innenvisualisierungen',
    description: [
      {
        text: 'Geliefert werden {{QUANTITY}} gerenderte Innenansichten der Räume:',
        children: [
        ]
      },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Eingerichtet individuell nach Ihren Wünschen (allerdings keine individuelle Modellierung konkreter Möbelstücke inkludiert)', children: [] },
      { text: 'Falls Türen zwischen einzelnen Räumen zu sehen sind, werden diese als geschlossen dargestellt', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: 'Format: 2.500 x 1.500 px (300 DPI)', children: [] }
    ],
    pricingTiers: [
      { quantity: 1, price: 399, label: '1 Ansicht Netto: 399,00 €' },
      { quantity: 2, price: 299, label: '2 Ansichten: Netto pro Ansicht: 299,00 €' },
      { quantity: 3, price: 289, label: '3 Ansichten: Netto pro Ansicht: 289,00 €' },
      { quantity: 4, price: 269, label: '4 Ansichten: Netto pro Ansicht: 269,00 €' },
      { quantity: 5, price: 259, label: '5 Ansichten: Netto pro Ansicht: 259,00 €' },
      { quantity: 6, price: 249, label: '6 Ansichten: Netto pro Ansicht: 249,00 €' },
      { quantity: 7, price: 239, label: '7 Ansichten: Netto pro Ansicht: 239,00 €' },
      { quantity: 8, price: 229, label: '8 Ansichten: Netto pro Ansicht: 229,00 €' },
      { quantity: 9, price: 219, label: '9 Ansichten: Netto pro Ansicht: 219,00 €' },
      { quantity: 10, price: 199, label: '≥10 Ansichten: Netto pro Ansicht: 199,00 €' }
    ]
  },
  'terrace': {
    name: '3D-Visualisierung Terrasse',
    description: [
      {
        text: 'Geliefert wird {{QUANTITY}}x gerenderte Ansicht folgender Einheit:',
        children: [
          { text: '{{QUANTITY}}x Terrasse (Whg. XX)', children: [] }
        ]
      },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Eingerichtet individuell nach Ihren Wünschen (allerdings keine individuelle Modellierung konkreter Möbelstücke inkludiert)', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: 'Format: 2.500 x 1.500 px (300 DPI)', children: [] }
    ]
  },
  '3d-floorplan': {
    name: '3D-Grundriss',
    defaultPrice: 69.00,
    link: 'https://www.exposeprofi.de/3d-visualisierungen/3d-grundrisse',
    description: [
      { text: 'Geliefert werden {{QUANTITY}} 3D-Grundrisse', children: [] },
      { text: 'Hochwertig standardmöbliert', children: [] },
      { text: 'Exklusive Qualität', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: '2.500px x 1.500 px bei 300 DPI', children: [] }
    ]
  },
  '3d-complete-floor': {
    name: '3D-Geschossansicht',
    defaultPrice: 199.00,
    description: [
      {
        text: 'Geliefert werden {{QUANTITY}} 3D-Geschossansichten folgender Einheiten',
        children: [
        ]
      },
      { text: 'Hochwertig standardmöbliert', children: [] },
      { text: 'Exklusive Qualität', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: '2.500px x 1.500 px bei 300 DPI', children: [] }
    ]
  },
  '2d-floorplan': {
    name: '2D-Grundriss',
    defaultPrice: 49.00,
    link: 'https://www.exposeprofi.de/workflow/2d-grundriss-designs',
    description: [
      { text: 'Geliefert werden {{QUANTITY}} 2D-Grundrisse', children: [] },
      { text: 'Hochwertig standardmöbliert', children: [] },
      { text: 'Exklusive Qualität', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: '2.500px x 1.500 px bei 300 DPI', children: [] }
    ]
  },
  'home-staging': {
    name: 'Digital Home Staging',
    defaultPrice: 99.00,
    link: 'https://www.exposeprofi.de/digitales-home-staging',
    description: [
      {
        text: 'Geliefert werden {{QUANTITY}} Digital Home Staging Fotos der Räume:',
        children: [
        ]
      },
      { text: 'Basiert auf vom Kunden bereitgestellten Fotos', children: [] },
      { text: 'Individuell eingerichtet', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Exakt identische Perspektive wie zugrundeliegende Fotos', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },
  'renovation': {
    name: 'Digitale Renovierung',
    defaultPrice: 139.00,
    link: 'https://www.exposeprofi.de/digitales-home-staging#referenzen-virtuelle-renovierung',
    description: [
      {
        text: 'Geliefert werden {{QUANTITY}} Digitale Renovierungsfotos der Räume:',
        children: [
        ]
      },
      { text: 'Basiert auf vom Kunden bereitgestellten Fotos', children: [] },
      { text: 'Individuell eingerichtet', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Exakt identische Perspektive wie zugrundeliegende Fotos', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },
  '360-interior': {
    name: '360° Tour Innen (Virtuelle Tour)',
    defaultPrice: 599.00,
    link: 'https://www.exposeprofi.de/3d-visualisierungen/virtuelle-rundgaenge',
    description: [
      {
        text: 'Geliefert wird {{QUANTITY}}x 360° Tour folgender Wohneinheit:',
        children: [
        ]
      },
      { text: 'Begehung des kompletten Innenbereichs', children: [] },
      { text: 'Individuell eingerichtet', children: [] },
      { text: 'Einzigartige Technologie, da vollkommen frei bewegbar', children: [] },
      { text: 'Intuitive Bedienung', children: [] },
      { text: 'Passend für alle gängigen Endgeräte', children: [] },
      { text: 'Inklusive Fensteraussicht (wahlweise mit beispielhafter oder Verwendung der tatsächlichen Aussicht mittels vom Auftraggeber gelieferten Bildern)', children: [] },
      { text: 'Inkl. 2 Revisionsrunden⁽¹⁾', children: [] },
      { text: 'Inkl. Hosting für 12 Monate⁽²⁾', children: [] }
    ]
  },
  '360-exterior': {
    name: '360° Video Außen',
    sub_name: '(nur in Kombination mit mind. 2x Außen- und 2x Innenvisualisierung)',
    link: 'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen#referenzen-virtueller-videorundgang',
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x 360° Video-Tour des Objektes {{PROJECT_NAME}}', children: [] },
      { text: '(nur in Kombination mit mind. 2x 3D-Außenvisualisierung)', children: [] },
      { text: 'Umgebung schematisch dargestellt', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Länge ca. 90 Sekunden', children: [] },
      { text: 'Inkl. 2 Revisionsrunden', children: [] }
    ]
  },
  'slideshow': {
    name: 'Slideshow Video',
    defaultPrice: 0,
    link: 'https://www.exposeprofi.de/3d-visualisierungen/architekturvisualisierungen#referenzen-virtueller-videorundgang',
    description: [
      { text: 'Geliefert wird {{QUANTITY}} Slideshow-Video des Objektes', children: [] },
      { text: 'Inkl. aller Visualisierungen und weiterer Fotos', children: [] },
      { text: 'Professionell vertont und kommentiert', children: [] },
      { text: 'Inkl. Untertiteln', children: [] }
    ]
  },
  'site-plan': {
    name: '3D-Lageplan',
    defaultPrice: 0,
    description: [
      { text: 'Geliefert wird {{QUANTITY}} 3D-Lageplan des Objektes in Draufsicht', children: [] },
      { text: 'Exklusive Qualität', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },
  'social-media': {
    name: 'Social Media Paket',
    defaultPrice: 0,
    description: [
      {
        text: 'Geliefert wird {{QUANTITY}}x Social Media Paket für die Visualisierung des Objektes, bestehend aus:',
        children: [
          { text: 'Alle statischen Visualisierungen in den für Social Media Posts passenden Formaten', children: [] },
          { text: 'Video in passendem Format', children: [] }
        ]
      },
      { text: 'Fotorealistische Qualität', children: [] }
    ]
  },
  'video-snippet': {
    name: 'Video Snippet Außen und Innen',
    sub_name: '(nur in Kombination mit mind. 2x Außen- und 2x Innenvisualisierung)',
    defaultPrice: 0,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x Video-Snippet des Objektes, bei dem wir durch Unterstützung von künstlicher Intelligenz aus den statischen Innen- und Außenvisualisierungen ein Video mit Bewegtbildern erstellen', children: [] },
      { text: '(nur in Kombination mit mind. 2x Außen- und 2x Innenvisualisierung)', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Basiert auf 2x Außen- und 2x Innenvisualisierungen', children: [] },
      { text: 'Länge ca. 30 Sekunden, max 9 Fotos', children: [] },
      { text: 'Da KI-generiert, keine Revisionsrunde', children: [] }
    ]
  },
  'expose-layout': {
    name: 'Exposé Layout',
    defaultPrice: 0,
    description: [
      { text: 'Geliefert wird {{QUANTITY}} Exposé Layout für den Vertrieb des Objektes', children: [] },
      { text: 'Nur in Kombination mit allen zuvor genannten Positionen erhältlich', children: [] },
      { text: 'Layout und Farbkonzept nach Absprache, einfach gehalten', children: [] },
      { text: 'Bestandteile (Beispiel-Aufbau): Inhaltsverzeichnis, Kurzbeschreibung Projekt, Lagebeschreibung, Bauvorhaben/Objektbeschreibung, Ausstattung, Grundrisse (inkl. m²- Angaben und evtl. Piktogramm für die Lage im Gebäude), Preistabelle und Finanzierung, Kontaktinformationen.', children: [] },
      { text: 'Format: PPT', children: [] },
      { text: 'Inkl. 2 Revisionsrunden', children: [] },
      { text: 'Dient auch als Layout für weitere Projekte', children: [] }
    ]
  },
  'expose-creation': {
    name: 'Exposé-Erstellung',
    defaultPrice: 0,
    link: 'https://www.exposeprofi.de/workflow/exposedesigns',
    description: [
      { text: 'Geliefert wird {{QUANTITY}} komplettes Exposé für den Vertrieb des Objektes', children: [] },
      { text: 'In druckfertiger, digitaler Ausführung', children: [] },
      { text: 'Exklusive Qualität basierend auf gelieferten Texten und Informationen', children: [] },
      { text: 'Nur in Kombination mit allen zuvor genannten Positionen erhältlich', children: [] },
      { text: 'Alle Texte werden vom Kunden so zur Verfügung gestellt, dass Sie unverändert übernommen werden können', children: [] },
      { text: 'Alle zusätzlich benötigten Fotos werden vom Kunden so zur Verfügung gestellt, dass Sie unverändert übernommen werden können', children: [] },
      { text: 'Inkl. 2 Revisionsrunden', children: [] }
    ]
  },
    'project-branding': {
    name: 'Projekt-Branding',
    defaultPrice: 0,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x Gesamtmarkenkonzept für das Bauvorhaben zur Schaffung einer unverwechselbaren Identität', children: [] },
      { text: 'Entwicklung eines durchgängigen visuellen Auftritts (Logo, Farbwelt, Typografie)', children: [] },
      { text: 'Abgestimmt auf Zielgruppe, Lage und Architektur des Projekts', children: [] },
      { text: 'Premium-Design mit Fokus auf Wertigkeit, Ästhetik und Markenwahrnehmung', children: [] }
    ]
  },

  'project-website': {
    name: 'Projektwebseite (Profi-Design)',
    description: [
      { text: 'Erstellung einer modernen, responsiven Website zur professionellen Präsentation des Projekts', children: [] },
      { text: 'Individuelles Design, visuell hochwertig, klar strukturiert und zielgruppenorientiert', children: [] },
      { text: 'Optimiert für alle gängigen Geräte, Bildschirmgrößen und Browser', children: [] },
      { text: 'Vollständig funktionsfähig und onlinefähig ausgeliefert', children: [] },
      { text: 'Inkl. Hosting für 12 Monate', children: [] }
    ]
  },

  'flat-finder': {
    name: 'Flat Finder',
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x interaktiver Flat Finder als Kernelement der Projektwebseite', children: [] },
      { text: 'Interaktive Außenansicht mit klickbarer Auswahl einzelner Wohneinheiten', children: [] },
      { text: 'Detaillierte Apartmentübersicht mit Grundrissen, Visualisierungen und/oder 360° Touren', children: [] },
      { text: 'Unterstützt aktiv den Verkaufsprozess durch realistische Darstellung', children: [] },
      { text: 'Vollständig an das Design und Branding der Projektwebseite angepasst', children: [] }
    ]
  },

  'online-marketing': {
    name: 'Online Marketing',
    description: [
      { text: 'Entwicklung und Umsetzung einer zielgerichteten Social-Media-Strategie', children: [] },
      { text: 'Erstellung hochwertiger Postings und Anzeigen auf Basis der Visualisierungen und Videos', children: [] },
      { text: 'Planung, Gestaltung und Schaltung von Kampagnen zur Leadgenerierung', children: [] },
      { text: 'Zielgruppen- und Marktanalysen zur optimalen Kampagnenausrichtung', children: [] },
      { text: 'Laufende Betreuung und Optimierung für maximale Performance', children: [] },
      { text: 'Laufzeit: 6 Monate (inkl. Werbebudget)', children: [] }
    ]
  },

  '3d-floorplan-special': {
    name: '3D-Grundriss Spezial',
    defaultPrice: 99.00,
    link: 'https://www.exposeprofi.de/3d-visualisierungen/3d-grundrisse',
    description: [
      { text: 'Geliefert werden {{QUANTITY}} 3D-Grundrisse Spezial', children: [] },
      { text: 'Hochwertig standardmöbliert', children: [] },
      { text: 'Premium Qualität mit erweiterten Details', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] },
      { text: '2.500px x 1.500 px bei 300 DPI', children: [] }
    ]
  },

  '2d-floor-view': {
    name: '2D-Geschossansicht',
    defaultPrice: 99.00,
    description: [
      { text: 'Geliefert werden {{QUANTITY}} 2D-Geschossansichten', children: [] },
      { text: 'Übersichtliche Darstellung aller Einheiten pro Geschoss', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },

  '2d-garage-plan': {
    name: '2D-Tiefgaragenplan',
    defaultPrice: 99.00,
    description: [
      { text: 'Geliefert werden {{QUANTITY}} 2D-Tiefgaragenpläne', children: [] },
      { text: 'Übersichtliche Darstellung der Stellplätze', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },

  'renovation-exterior': {
    name: 'Digitale Renovierung Außen',
    defaultPrice: 189.00,
    link: 'https://www.exposeprofi.de/digitales-home-staging#referenzen-virtuelle-renovierung',
    description: [
      { text: 'Geliefert werden {{QUANTITY}} Digitale Renovierungsfotos der Außenansicht:', children: [] },
      { text: 'Basiert auf vom Kunden bereitgestellten Fotos', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Exakt identische Perspektive wie zugrundeliegende Fotos', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },

  'timelapse-exterior': {
    name: 'Zeitraffer Außen',
    defaultPrice: 899.00,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x Zeitraffer-Video der Außenansicht des Objektes', children: [] },
      { text: 'Fotorealistische Qualität', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },

  'ki-video': {
    name: 'KI Video',
    defaultPrice: 299.00,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x KI-generiertes Video des Objektes', children: [] },
      { text: 'Basiert auf statischen Visualisierungen', children: [] },
      { text: 'Bewegtbilder durch künstliche Intelligenz', children: [] },
      { text: 'Da KI-generiert, keine Revisionsrunde', children: [] }
    ]
  },

  '2d-micro-location': {
    name: '2D-Mikrolageplan',
    defaultPrice: 129.00,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x 2D-Mikrolageplan des Objektes', children: [] },
      { text: 'Darstellung der unmittelbaren Umgebung', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  },

  '2d-macro-location': {
    name: '2D-Makrolageplan',
    defaultPrice: 129.00,
    description: [
      { text: 'Geliefert wird {{QUANTITY}}x 2D-Makrolageplan des Objektes', children: [] },
      { text: 'Darstellung der erweiterten Umgebung und Infrastruktur', children: [] },
      { text: 'Inkl. 1 Revisionsrunde⁽¹⁾', children: [] }
    ]
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = serviceDescriptions;
}
if (typeof exports !== 'undefined') {
  exports.serviceDescriptions = serviceDescriptions;
}