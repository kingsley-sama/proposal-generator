'use client';

import { useState } from 'react';

interface ServiceItemProps {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  quantity: number;
  customPrice?: number;
  buildingType?: string;
  apartmentSize?: string;
  projectType?: string;
  areaSize?: string;
  price: number;
  onToggle: (active: boolean) => void;
  onQuantityChange: (quantity: number) => void;
  onCustomPriceChange?: (price: number) => void;
  onBuildingTypeChange?: (type: string) => void;
  onApartmentSizeChange?: (size: string) => void;
  onProjectTypeChange?: (type: string) => void;
  onAreaSizeChange?: (size: string) => void;
}

const serviceDefaults: Record<string, string[]> = {
  'exterior-ground': [
    'Fotorealistische 3D-Visualisierung aus Bodenperspektive',
    'Hochauflösende Darstellung (min. 3000px)',
    'Professionelle Lichtsetzung und Materialisierung',
    'Umgebungsgestaltung mit Vegetation und Kontext'
  ],
  'exterior-bird': [
    'Fotorealistische Vogelperspektive',
    'Ideal für Gesamtübersicht des Projekts',
    'Nur in Kombination mit Bodenperspektiven'
  ],
  '3d-floorplan': [
    'Fotorealistischer 3D-Grundriss',
    'Möblierte Darstellung',
    'Hochauflösende Qualität'
  ],
  '3d-complete-floor': [
    'Komplette 3D-Ansicht eines Geschosses',
    'Alle Wohnungen in einem Geschoss',
    'Möblierte Darstellung'
  ],
  '2d-floorplan': [
    'Professioneller 2D-Grundriss',
    'Bemaßung und Flächenangaben',
    'Druckfertige Qualität'
  ],
  'home-staging': [
    'Digitale Möblierung leerer Räume',
    'Fotorealistische Integration',
    'Verschiedene Einrichtungsstile'
  ],
  'renovation': [
    'Digitale Aufbereitung alter Räume',
    'Visualisierung von Renovierungspotential',
    'Fotorealistische Darstellung'
  ],
  '360-interior': [
    'Interaktive 360° Innenraumtour',
    'Navigation durch alle Räume',
    'Einbettbar auf Website'
  ],
  '360-exterior': [
    '360° Außenansicht Video',
    'Nur mit min. 2x 3D-Außenvisualisierung',
    'Preis auf Anfrage'
  ],
  'slideshow': [
    'Professionelles Slideshow-Video',
    'Musik und Übergänge',
    'Ideal für Social Media'
  ],
  'site-plan': [
    '3D-Darstellung der Lage',
    'Umgebungskontext',
    'Verkehrsanbindung'
  ],
  'social-media': [
    'Optimierte Bilder für Social Media',
    'Verschiedene Formate',
    'Stories und Posts'
  ],
  'interior': [
    'Fotorealistische Innenraumvisualisierung',
    'Hochauflösende Darstellung',
    'Professionelle Lichtsetzung',
    'Verschiedene Perspektiven möglich'
  ],
  'terrace': [
    'Fotorealistische Terrassenvisualisierung',
    'Mit Möblierung und Bepflanzung',
    'Preis auf Anfrage'
  ]
};

export function ServiceItem({
  serviceId,
  serviceName,
  isActive,
  quantity,
  customPrice,
  buildingType,
  apartmentSize,
  projectType,
  areaSize,
  price,
  onToggle,
  onQuantityChange,
  onCustomPriceChange,
  onBuildingTypeChange,
  onApartmentSizeChange,
  onProjectTypeChange,
  onAreaSizeChange
}: ServiceItemProps) {
  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',') + ' €';
  };

  const defaults = serviceDefaults[serviceId] || [];

  return (
    <div
      className={`bg-white p-5 rounded-lg mb-4 border transition-all ${
        isActive
          ? 'border-slate-800 shadow-md ring-2 ring-slate-800/10'
          : 'border-gray-300 hover:border-slate-800 hover:shadow-sm'
      }`}
    >
      {/* Service Header */}
      <div className="flex items-center mb-4">
        <input
          type="checkbox"
          id={`check-${serviceId}`}
          checked={isActive}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-5 h-5 mr-3 cursor-pointer accent-slate-800"
        />
        <label
          htmlFor={`check-${serviceId}`}
          className="font-semibold text-base text-slate-800 cursor-pointer flex-1"
        >
          {serviceName}
        </label>
      </div>

      {/* Service Details */}
      {isActive && (
        <div className="ml-8 mt-4 grid gap-4">
          {/* Building Type selector moved to global project settings */}
          
          {/* Apartment Size (for 360-interior) */}
          {serviceId === '360-interior' && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Apartment Size *
              </label>
              <select
                value={apartmentSize || ''}
                onChange={(e) => onApartmentSizeChange?.(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="">Select Apartment Size...</option>
                <option value="30">bis 30 m²</option>
                <option value="40">Etwa 40 m²</option>
                <option value="50">Etwa 50 m²</option>
                <option value="60">Etwa 60 m²</option>
                <option value="70">Etwa 70 m²</option>
                <option value="80">Etwa 80 m²</option>
                <option value="90">90 m² bis 100 m²</option>
                <option value="100">100 m² bis 120 m²</option>
                <option value="EFH">EFH und DHH</option>
              </select>
              <span className="text-xs text-gray-700 mt-1 block">
                Select apartment size for pricing
              </span>
            </div>
          )}

          {/* Project Type (for 3d-floorplan and 2d-floorplan) */}
          {(serviceId === '3d-floorplan' || serviceId === '2d-floorplan') && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Project Type *
                </label>
                <select
                  value={projectType || ''}
                  onChange={(e) => onProjectTypeChange?.(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="">Select Project Type...</option>
                  <option value="residential">
                    Residential ({serviceId === '3d-floorplan' ? '69' : '49'}€ per plan)
                  </option>
                  <option value="commercial">Commercial (Price by area size)</option>
                </select>
                <span className="text-xs text-gray-700 mt-1 block">
                  Select residential or commercial project
                </span>
              </div>

              {/* Area Size (for commercial) */}
              {projectType === 'commercial' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Area Size (Fläche) *
                  </label>
                  <select
                    value={areaSize || ''}
                    onChange={(e) => onAreaSizeChange?.(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Select Area Size...</option>
                    {serviceId === '3d-floorplan' ? (
                      <>
                        <option value="100">100 sqm - 99€</option>
                        <option value="250">250 sqm - 199€</option>
                        <option value="500">500 sqm - 299€</option>
                        <option value="1000">1000 sqm - 399€</option>
                        <option value="1500">1500 sqm - 499€</option>
                      </>
                    ) : (
                      <>
                        <option value="100">100 sqm - 39€</option>
                        <option value="250">250 sqm - 79€</option>
                        <option value="500">500 sqm - 119€</option>
                        <option value="1000">1000 sqm - 159€</option>
                        <option value="1500">1500 sqm - 199€</option>
                      </>
                    )}
                  </select>
                  <span className="text-xs text-gray-700 mt-1 block">
                    Select area size for commercial pricing
                  </span>
                </div>
              )}
            </>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Number of {serviceId.includes('floor') ? 'Floor Plans' : 'Views'} *
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => onQuantityChange(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
            <span className="text-xs text-gray-700 mt-1 block">
              {serviceId === 'exterior-bird' && 'Price: 12,00 € per view (only with ground perspectives)'}
              {serviceId === '3d-complete-floor' && 'Price: 199,00 € per floor'}
              {serviceId === 'home-staging' && 'Price: 99,00 € per photo'}
              {serviceId === 'renovation' && 'Price: 139,00 € per photo'}
              {serviceId === 'slideshow' && 'Price: 499,00 € per video'}
              {serviceId === 'site-plan' && 'Price: 99,00 € per site plan'}
              {serviceId === 'social-media' && 'Price: 299,00 € per package'}
              {serviceId === 'interior' && 'Tiered pricing: 1=399€, 2=299€, 3=289€, 4=269€, 5=259€, 6=249€, 7=239€, 8=229€, 9=219€, 10+=199€'}
              {serviceId === 'terrace' && 'Preis nach Anfrage'}
            </span>
          </div>

          {/* Custom Price */}
          {onCustomPriceChange && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Custom Unit Price (Optional)
              </label>
              <input
                type="number"
                value={customPrice || ''}
                onChange={(e) => onCustomPriceChange(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                placeholder="Leave empty for default price"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <span className="text-xs text-gray-700 mt-1 block">
                Override default price per unit (in €)
              </span>
            </div>
          )}

          {/* Default Bullet Points */}
          {defaults.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">
                Default Description (editable in preview):
              </p>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {defaults.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Price Display */}
          <div className="bg-gray-100 px-4 py-3 rounded-lg font-semibold text-slate-800 text-center border border-gray-300">
            Price: <strong>{formatPrice(price)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
