'use client';

import { useState, useEffect, useRef } from 'react';

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
  onDuplicate?: () => void;
  onRemove?: () => void;
}

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
  onAreaSizeChange,
  onDuplicate,
  onRemove
}: ServiceItemProps) {
  const [inputValue, setInputValue] = useState<string>(String(quantity));
  const isFocusedRef = useRef(false);

  // Sync from parent only when the field is not being actively edited.
  // Using a ref (not state) for focus avoids a race condition where the effect
  // fires with the stale old quantity just as the user blurs after typing.
  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputValue(String(quantity));
    }
  }, [quantity]);

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',') + ' €';
  };

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
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            title="Leistung duplizieren"
            className="ml-2 p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Duplizieren"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Kopie entfernen"
            className="ml-1 p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Entfernen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Service Details */}
      {isActive && (
        <div className="ml-8 mt-4 grid gap-4">
          {/* Building Type selector moved to global project settings */}
          
          {/* Wohnungsgröße (für 360-interior) */}
          {serviceId === '360-interior' && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Wohnungsgröße *
              </label>
              <select
                value={apartmentSize || ''}
                onChange={(e) => onApartmentSizeChange?.(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="">Wohnungsgröße wählen...</option>
                <option value="30">bis 30 m² - 999€</option>
                <option value="40">Etwa 40 m² - 1.299€</option>
                <option value="50">Etwa 50 m² - 1.499€</option>
                <option value="60">Etwa 60 m² - 1.699€</option>
                <option value="70">Etwa 70 m² - 1.799€</option>
                <option value="80">Etwa 80 m² - 1.899€</option>
                <option value="90">90 m² bis 100 m² - 1.999€</option>
                <option value="100">100 m² bis 120 m² - 2.299€</option>
                <option value="EFH">EFH und DHH - 2.499€</option>
              </select>
              <span className="text-xs text-gray-700 mt-1 block">
                Wohnungsgröße für Preisberechnung
              </span>
            </div>
          )}

          {/* Projekttyp (für interior - Wohn/Gewerbe) */}
          {serviceId === 'interior' && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Projekttyp *
              </label>
              <select
                value={projectType || 'residential'}
                onChange={(e) => onProjectTypeChange?.(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="residential">Wohnimmobilie</option>
                <option value="commercial">Gewerbe</option>
              </select>
              <span className="text-xs text-gray-700 mt-1 block">
                Gewerbe hat höhere Preise (1=499€, 2=399€, ..., 10+=299€)
              </span>
            </div>
          )}

          {/* Projekttyp (für 3d-floorplan und 2d-floorplan) */}
          {(serviceId === '3d-floorplan' || serviceId === '2d-floorplan') && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  Projekttyp *
                </label>
                <select
                  value={projectType || ''}
                  onChange={(e) => onProjectTypeChange?.(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="">Projekttyp wählen...</option>
                  <option value="residential">
                    Wohnimmobilie ({serviceId === '3d-floorplan' ? '69' : '49'}€ pro Grundriss)
                  </option>
                  <option value="commercial">Gewerbe (Preis nach Fläche)</option>
                </select>
                <span className="text-xs text-gray-700 mt-1 block">
                  Wohnimmobilie oder Gewerbe wählen
                </span>
              </div>

              {/* Area Size (for commercial) */}
              {projectType === 'commercial' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Fläche *
                  </label>
                  <select
                    value={areaSize || ''}
                    onChange={(e) => onAreaSizeChange?.(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">Fläche wählen...</option>
                    {serviceId === '3d-floorplan' ? (
                      <>
                        <option value="100">100 m² - 99€</option>
                        <option value="250">250 m² - 199€</option>
                        <option value="500">500 m² - 299€</option>
                        <option value="1000">1.000 m² - 399€</option>
                        <option value="1500">1.500 m² - 499€</option>
                      </>
                    ) : (
                      <>
                        <option value="100">100 m² - 39€</option>
                        <option value="250">250 m² - 79€</option>
                        <option value="500">500 m² - 119€</option>
                        <option value="1000">1.000 m² - 159€</option>
                        <option value="1500">1.500 m² - 199€</option>
                      </>
                    )}
                  </select>
                  <span className="text-xs text-gray-700 mt-1 block">
                    Fläche für gewerbliche Preisberechnung
                  </span>
                </div>
              )}
            </>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Anzahl {serviceId.includes('floor') ? 'Grundrisse' : 'Ansichten'} *
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={(e) => {
                // Only accept digit characters — block letters, minus, decimals.
                // Use type="text" intentionally: type="number" causes browser-level
                // value normalization that fights React's controlled reconciliation
                // and silently reverts what the user typed.
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setInputValue(raw);
              }}
              onFocus={() => { isFocusedRef.current = true; }}
              onBlur={() => {
                isFocusedRef.current = false;
                const parsed = parseInt(inputValue, 10);
                const normalized = isNaN(parsed) || parsed < 0 ? 0 : parsed;
                setInputValue(String(normalized));
                onQuantityChange(normalized);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
            <span className="text-xs text-gray-700 mt-1 block">
              {serviceId === 'exterior-bird' && 'Preise wie Bodenperspektive (abhängig vom Gebäudetyp)'}
              {serviceId === '3d-complete-floor' && 'Preis: 199,00 € pro Geschoss'}
              {serviceId === 'home-staging' && 'Preis: 99,00 € pro Foto'}
              {serviceId === 'renovation' && 'Preis: 139,00 € pro Foto'}
              {serviceId === 'slideshow' && 'Preis: 499,00 € pro Video'}
              {serviceId === 'site-plan' && 'Preis: 99,00 € pro Lageplan'}
              {serviceId === 'social-media' && 'Preis: 299,00 € pro Paket'}
              {serviceId === 'interior' && (projectType === 'commercial'
                ? 'Gewerblich: 1=499€, 2=399€, 3=389€, 4=369€, 5=359€, 6=349€, 7=339€, 8=329€, 9=319€, 10+=299€'
                : 'Wohnimmobilie: 1=399€, 2=299€, 3=289€, 4=269€, 5=259€, 6=249€, 7=239€, 8=229€, 9=219€, 10+=199€')}
              {serviceId === 'terrace' && 'Preis nach Anfrage'}
              {serviceId === 'video-snippet' && 'Preis: 299,00 € pro Video Snippet'}
              {serviceId === 'expose-layout' && 'Preis: 1.199,00 € pro Layout'}
              {serviceId === 'expose-creation' && 'Preis: 499,00 € pro Exposé'}
              {serviceId === 'project-branding' && 'Preis: 1.999,00 € pro Projekt'}
              {serviceId === 'project-website' && 'Preis nach Anfrage'}
              {serviceId === 'flat-finder' && 'Preis nach Anfrage'}
              {serviceId === 'online-marketing' && 'Preis nach Anfrage'}
            </span>
          </div>

          {/* Preisanzeige */}
          <div className="bg-gray-100 px-4 py-3 rounded-lg font-semibold text-slate-800 text-center border border-gray-300">
            Preis: <strong>{formatPrice(price)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
