'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ServiceItem } from '@/components/ServiceItem';
import { ImageUploadSection } from '@/components/ImageUploadSection';
import { Summary } from '@/components/Summary';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { ALL_SERVICES } from '@/lib/services';
import serviceDescriptions from '@/lib/service_description.js';
import { signOut } from '@/app/(auth)/actions';
import { useNotification } from '@/contexts/NotificationContext';
import { useProposal } from '@/contexts/ProposalContext';

const STORAGE_KEY = 'proposalFormData';
const AUTOSAVE_INTERVAL = 5000;

interface ClientInfo {
  clientNumber: string;
  companyName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

interface ProjectInfo {
  projectNumber: string;
  projectName: string;
  projectType: string;
  customProjectType: string;
  deliveryTime: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  offerValidUntil: string;
}

interface ServiceData {
  name: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  customPrice?: number;
  buildingType?: string;
  apartmentSize?: string;
  projectType?: string;
  areaSize?: string;
  modifiedDefaults?: any[];
  pricingTiers?: Array<{ quantity: number; price: number; label: string }>;
  link?: string;
}

interface DiscountInfo {
  type: string;
  value: number;
  description: string;
}

interface ImageData {
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  imageData?: string;
}

const stripLeadingPercentageTokens = (value: string): string => {
  if (!value) return '';
  return value.replace(/^(\s*\d+(?:[.,]\d+)?%\s*)+/g, '').trim();
};

const getLastLeadingPercentageValue = (value: string): number => {
  const leadingBlock = value.match(/^(\s*\d+(?:[.,]\d+)?%\s*)+/)?.[0] || '';
  const matches = Array.from(leadingBlock.matchAll(/(\d+(?:[.,]\d+)?)%/g));
  if (matches.length === 0) return 0;
  const last = matches[matches.length - 1][1];
  return parseFloat(last.replace(',', '.')) || 0;
};

const buildCanonicalDiscountDescription = (
  type: string,
  numericValue: number,
  rawDescription: string
): string => {
  const cleanDescription = stripLeadingPercentageTokens(rawDescription || '');
  if (type === 'percentage' && numericValue > 0) {
    return cleanDescription ? `${numericValue}% ${cleanDescription}` : `${numericValue}%`;
  }
  return cleanDescription;
};

export default function ProposalFormPage() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const proposal = useProposal();
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    clientNumber: '',
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    country: ''
  });

  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    projectNumber: '',
    projectName: '',
    projectType: '',
    customProjectType: '',
    deliveryTime: '4-6',
    deliveryDaysMin: 4,
    deliveryDaysMax: 6,
    offerValidUntil: ''
  });

  const [activeServices, setActiveServices] = useState<Set<string>>(new Set());
  const [customServices, setCustomServices] = useState<Array<{id: string, name: string, description: string, unitPrice: number}>>([]);
  const [customDraft, setCustomDraft] = useState<{ name: string; price: string; description: string }>({
    name: '',
    price: '',
    description: ''
  });
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [serviceCustomPrices, setServiceCustomPrices] = useState<Record<string, number>>({});
  const [serviceBuildingTypes, setServiceBuildingTypes] = useState<Record<string, string>>({});
  const [serviceApartmentSizes, setServiceApartmentSizes] = useState<Record<string, string>>({});
  const [serviceProjectTypes, setServiceProjectTypes] = useState<Record<string, string>>({});
  const [serviceAreaSizes, setServiceAreaSizes] = useState<Record<string, string>>({});
  // Tracks extra instances per base service id: baseId -> [copyKey, ...]
  const [serviceDuplicates, setServiceDuplicates] = useState<Record<string, string[]>>({});
  
  const [images, setImages] = useState<ImageData[]>([]);
  const [discount, setDiscount] = useState<DiscountInfo>({
    type: '',
    value: 0,
    description: ''
  });

  const [showJSON, setShowJSON] = useState(false);
  const [jsonData, setJsonData] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const [totals, setTotals] = useState({
    subtotalNet: 0,
    discountAmount: 0,
    totalNet: 0,
    totalVat: 0,
    totalGross: 0
  });

  // Project types configuration (Building Types)
  const projectTypes = [
    'EFH',
    'DHH',
    'MFH-3-5',
    'MFH-6-10',
    'MFH-11-15',
    'Custom'
  ];

  const countries = [
    'Deutschland',
    'Österreich',
    'Schweiz',
    'Frankreich',
    'Italien',
    'Spanien',
    'Niederlande',
    'Belgien',
    'Polen',
    'Tschechien'
  ];

  // Set default offer valid date (1 week from now)
  useEffect(() => {
    const oneWeekLater = new Date();
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    setProjectInfo(prev => ({
      ...prev,
      offerValidUntil: oneWeekLater.toISOString().split('T')[0]
    }));
  }, []);

  // Load saved data on mount — prefer context rawProposalData (set by preview edits)
  useEffect(() => {
    if (proposal.state.rawProposalData) {
      loadSavedData(proposal.state.rawProposalData);
    } else {
      loadSavedData();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save functionality
  useEffect(() => {
    const interval = setInterval(() => {
      saveFormData();
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [clientInfo, projectInfo, activeServices, serviceQuantities, serviceCustomPrices, serviceBuildingTypes, serviceApartmentSizes, serviceProjectTypes, serviceAreaSizes, serviceDuplicates, discount]);

  // Calculate totals whenever relevant data changes
  useEffect(() => {
    calculateTotals();
  }, [activeServices, serviceQuantities, serviceCustomPrices, serviceBuildingTypes, serviceApartmentSizes, serviceProjectTypes, serviceAreaSizes, discount]);

  const loadSavedData = (externalData?: any) => {
    try {
      let data: any;

      if (externalData) {
        data = externalData;
        console.log('Loading form data from shared context (preview edits)...');
      } else {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;
        data = JSON.parse(savedData);
        console.log('Loading saved form data...');
      }

      if (data.clientInfo) {
        setClientInfo(data.clientInfo);
      }

      if (data.projectInfo) {
        const oneWeekLater = new Date();
        oneWeekLater.setDate(oneWeekLater.getDate() + 7);
        setProjectInfo({
          ...data.projectInfo,
          offerValidUntil: oneWeekLater.toISOString().split('T')[0]
        });
      }

      if (data.services) {
        const activeSet = new Set<string>();
        const quantities: Record<string, number> = {};
        const customPrices: Record<string, number> = {};
        const buildingTypes: Record<string, string> = {};
        const apartmentSizes: Record<string, string> = {};
        const projectTypes: Record<string, string> = {};
        const areaSizes: Record<string, string> = {};
        const duplicatesMap: Record<string, string[]> = {};

        data.services.forEach((service: any) => {
          // If a saved copy has an instanceKey, use it directly; otherwise derive from name
          const instanceKey: string | null = service.instanceKey
            ? service.instanceKey
            : getServiceIdFromName(service.name);

          if (instanceKey) {
            activeSet.add(instanceKey);
            quantities[instanceKey] = service.quantity;
            if (service.customPrice) customPrices[instanceKey] = service.customPrice;
            if (service.buildingType) buildingTypes[instanceKey] = service.buildingType;
            if (service.apartmentSize) apartmentSizes[instanceKey] = service.apartmentSize;
            if (service.projectType) projectTypes[instanceKey] = service.projectType;
            if (service.areaSize) areaSizes[instanceKey] = service.areaSize;

            // Restore duplicate tracking
            if (instanceKey.includes('__')) {
              const baseId = instanceKey.split('__')[0];
              if (!duplicatesMap[baseId]) duplicatesMap[baseId] = [];
              duplicatesMap[baseId].push(instanceKey);
            }
          }
        });

        setActiveServices(activeSet);
        setServiceQuantities(quantities);
        setServiceCustomPrices(customPrices);
        setServiceBuildingTypes(buildingTypes);
        setServiceApartmentSizes(apartmentSizes);
        setServiceProjectTypes(projectTypes);
        setServiceAreaSizes(areaSizes);
        setServiceDuplicates(duplicatesMap);
      }

      if (data.pricing?.discount) {
        const d = data.pricing.discount;
        const normalizedValue = Number(d.value) || 0;
        const recoveredPercentageValue = d.type === 'percentage' && normalizedValue <= 0
          ? getLastLeadingPercentageValue(d.description || '')
          : normalizedValue;
        setDiscount({
          type: d.type || '',
          value: recoveredPercentageValue,
          description: stripLeadingPercentageTokens(d.description || '')
        });
      }

      console.log('✅ Form data restored from localStorage');
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  const saveFormData = () => {
    try {
      setAutoSaveStatus('saving');
      const data = collectFormData(false);
      
      const dataToSave: {
        clientInfo: ClientInfo;
        projectInfo: ProjectInfo & { date: string; MM: string; DD: string };
        services: ServiceData[];
        images: Array<{
          title: string;
          description: string;
          fileName: string;
          fileSize: number;
          fileType: string;
        }>;
        pricing: {
          subtotalNet: string;
          totalNetPrice: string;
          totalVat: string;
          totalGrossPrice: string;
          discount?: {
        type: string;
        value: number;
        amount: string;
        description: string;
          };
        };
        signature: {
          signatureName: string;
        };
      } = {
        ...data,
        images: data.images.map((img: ImageData) => ({
          title: img.title,
          description: img.description,
          fileName: img.fileName,
          fileSize: img.fileSize,
          fileType: img.fileType
        }))
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      console.log('💾 Form data auto-saved');
      setAutoSaveStatus('saved');
      
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving form data:', error);
      if ((error as Error).name === 'QuotaExceededError') {
        console.warn('⚠️ Storage quota exceeded. Skipping auto-save.');
      }
      setAutoSaveStatus('idle');
    }
  };

  const calculateTotals = () => {
    let subtotalNet = 0;

    // Calculate service totals
    activeServices.forEach(serviceId => {
      const quantity = serviceQuantities[serviceId] || 0;
      if (quantity > 0) {
        const price = calculateServicePrice(serviceId, quantity);
        subtotalNet += price;
      }
    });

    // Calculate discount
    let discountAmount = 0;
    if (discount.type && discount.value > 0) {
      if (discount.type === 'percentage') {
        discountAmount = subtotalNet * (discount.value / 100);
      } else if (discount.type === 'fixed') {
        discountAmount = discount.value;
      }
    }

    const totalNet = subtotalNet - discountAmount;
    const totalVat = totalNet * 0.19;
    const totalGross = totalNet + totalVat;

    setTotals({
      subtotalNet,
      discountAmount,
      totalNet,
      totalVat,
      totalGross
    });
  };

  /** Strips copy suffix from instance keys like "exterior-ground__2" → "exterior-ground" */
  const getBaseServiceId = (instanceKey: string): string =>
    instanceKey.includes('__') ? instanceKey.split('__')[0] : instanceKey;

  const calculateServicePrice = (serviceId: string, quantity: number): number => {
    // Strip copy suffix so duplicate instances share the same pricing logic
    const baseId = getBaseServiceId(serviceId);

    // Check if it's a custom service
    if (baseId.startsWith('custom-')) {
        const customService = customServices.find(s => s.id === baseId);
        return customService ? (customService.unitPrice * quantity) : 0;
    }

    const customPrice = serviceCustomPrices[serviceId];
    if (customPrice && customPrice > 0) {
      return customPrice * quantity;
    }

    // Service-specific pricing logic (switch on baseId; dict lookups use serviceId for per-instance data)
    switch (baseId) {
      case 'exterior-ground': {
        // Per-instance override falls back to the global project building type
        const buildingType = serviceBuildingTypes[serviceId] || projectInfo.projectType;
        if (!buildingType) return 0;
        
        const priceMatrix: Record<string, number[]> = {
          'EFH': [499, 349, 299, 229, 199],
          'DHH': [599, 399, 359, 329, 299],
          'MFH-3-5': [599, 399, 359, 329, 299], // Same as DHH
          'MFH-6-10': [699, 499, 399, 349, 329],
          'MFH-11-15': [799, 599, 499, 399, 349]
        };
        
        // Use default if exact match not found
        const prices = priceMatrix[buildingType] || [0, 0, 0, 0, 0];
        const unitPrice = quantity <= 5 ? prices[quantity - 1] : prices[4];
        return unitPrice * quantity;
      }
      
      case 'exterior-bird': {
        // Per-instance override falls back to the global project building type
        const birdBuildingType = serviceBuildingTypes[serviceId] || projectInfo.projectType;
        if (!birdBuildingType) return 0;
        
        const birdPriceMatrix: Record<string, number[]> = {
          'EFH': [499, 349, 299, 229, 199],
          'DHH': [599, 399, 359, 329, 299],
          'MFH-3-5': [599, 399, 359, 329, 299],
          'MFH-6-10': [699, 499, 399, 349, 329],
          'MFH-11-15': [799, 599, 499, 399, 349]
        };
        
        const birdPrices = birdPriceMatrix[birdBuildingType] || [0, 0, 0, 0, 0];
        const birdUnitPrice = quantity <= 5 ? birdPrices[quantity - 1] : birdPrices[4];
        return birdUnitPrice * quantity;
      }
      
      case '3d-floorplan': {
        const projectType = serviceProjectTypes[serviceId];
        if (projectType === 'commercial') {
          const areaSize = serviceAreaSizes[serviceId];
          const commercialPrices: Record<string, number> = {
            '100': 99, '250': 199, '500': 299, '1000': 399, '1500': 499
          };
          return (commercialPrices[areaSize] || 0) * quantity;
        }
        return 69 * quantity;
      }

      case '3d-complete-floor':
        return 199 * quantity;

      case '2d-floorplan': {
        const projectType = serviceProjectTypes[serviceId];
        if (projectType === 'commercial') {
          const areaSize = serviceAreaSizes[serviceId];
          const commercialPrices: Record<string, number> = {
            '100': 39, '250': 79, '500': 119, '1000': 159, '1500': 199
          };
          return (commercialPrices[areaSize] || 0) * quantity;
        }
        return 49 * quantity;
      }
      
      case 'home-staging':
        return 99 * quantity;
      
      case 'renovation':
        return 139 * quantity;
      
      case '360-interior': {
        const apartmentSize = serviceApartmentSizes[serviceId];
        if (!apartmentSize) return 0;
        const prices: Record<string, number> = {
          '30': 999, '40': 1299, '50': 1499, '60': 1699,
          '70': 1799, '80': 1899, '90': 1999, '100': 2299, 'EFH': 2499
        };
        return (prices[apartmentSize] || 0) * quantity;
      }
      
      case '360-exterior': {
        const buildingType = serviceBuildingTypes[serviceId];
        if (!buildingType) return 0;
        const prices: Record<string, number> = {
          'EFH-DHH': 1299, 'MFH-3-5': 1299, 'MFH-6-10': 1699, 'MFH-11-15': 1999
        };
        return (prices[buildingType] || 0) * quantity;
      }

      case 'slideshow':
        return 499 * quantity;
      
      case 'site-plan':
        return 99 * quantity;

      case 'social-media':
        return 299 * quantity;
      
      case 'interior': {
        const projectType = serviceProjectTypes[serviceId];
        if (projectType === 'commercial') {
          // Commercial interior pricing
          const commercialTierPrices = [499, 399, 389, 369, 359, 349, 339, 329, 319];
          const unitPrice = quantity <= 9 ? commercialTierPrices[quantity - 1] : 299;
          return unitPrice * quantity;
        }
        // Residential interior pricing
        const tierPrices = [399, 299, 289, 269, 259, 249, 239, 229, 219];
        const unitPrice = quantity <= 9 ? tierPrices[quantity - 1] : 199;
        return unitPrice * quantity;
      }
      
      case 'terrace':
        return 0; // Price on request
      
      case 'video-snippet':
        return 299 * quantity;
      
      case 'expose-layout':
        return 1199 * quantity;
      
      case 'expose-creation':
        return 499 * quantity;
      
      case 'project-branding':
        return 1999 * quantity;
      
      case 'project-website':
      case 'flat-finder':
      case 'online-marketing':
        return 0; // Price on request
      
      default:
        return 0;
    }
  };

  const getServiceIdFromName = (name: string): string | null => {
    const serviceMapping: Record<string, string> = {
      '3D-Außenvisualisierung Bodenperspektive': 'exterior-ground',
      '3D-Außenvisualisierung Vogelperspektive': 'exterior-bird',
      '3D-Grundriss': '3d-floorplan',
      '3D-Geschossplan': '3d-complete-floor',
      '2D-Grundriss': '2d-floorplan',
      'Digital Home Staging': 'home-staging',
      'Digitale Renovierung': 'renovation',
      '360° Tour Innen': '360-interior',
      '360° Video Außen': '360-exterior',
      'Slideshow Video': 'slideshow',
      '3D-Lageplan': 'site-plan',
      'Social Media Paket': 'social-media',
      '3D-Innenvisualisierung': 'interior',
      '3D-Visualisierung Terrasse': 'terrace',
      'Video Snippet Außen und Innen': 'video-snippet',
      'Exposé Layout': 'expose-layout',
      'Exposé-Erstellung': 'expose-creation',
      'Projekt-Branding': 'project-branding',
      'Projektwebseite (Profi-Design)': 'project-website',
      'Flat Finder': 'flat-finder',
      'Online Marketing': 'online-marketing'
    };
    return serviceMapping[name] || null;
  };

  const handleDuplicate = (baseId: string) => {
    // Find first unused copy key
    const existing = new Set(Object.values(serviceDuplicates).flat());
    let n = 2;
    while (existing.has(`${baseId}__${n}`)) n++;
    const copyKey = `${baseId}__${n}`;

    setServiceDuplicates(prev => ({
      ...prev,
      [baseId]: [...(prev[baseId] || []), copyKey]
    }));
    setActiveServices(prev => new Set([...prev, copyKey]));
    setServiceQuantities(prev => ({ ...prev, [copyKey]: 1 }));
  };

  const handleRemoveDuplicate = (copyKey: string, baseId: string) => {
    setServiceDuplicates(prev => ({
      ...prev,
      [baseId]: (prev[baseId] || []).filter(k => k !== copyKey)
    }));
    setActiveServices(prev => { const s = new Set(prev); s.delete(copyKey); return s; });
    setServiceQuantities(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
    setServiceCustomPrices(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
    setServiceBuildingTypes(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
    setServiceApartmentSizes(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
    setServiceProjectTypes(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
    setServiceAreaSizes(prev => { const n = { ...prev }; delete n[copyKey]; return n; });
  };

  const collectFormData = (includeImageData = true) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('de-DE', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });

    const services: ServiceData[] = [];

    // Build the iteration order so duplicates always appear right after their
    // base service (matching the on-page rendering). `activeServices` is a Set
    // whose insertion order interleaves duplicates after unrelated services
    // when they are added later — that's why we don't iterate it directly.
    const orderedServiceIds: string[] = [];
    ALL_SERVICES.forEach(s => {
      if (activeServices.has(s.id)) orderedServiceIds.push(s.id);
      (serviceDuplicates[s.id] || []).forEach(copyKey => {
        if (activeServices.has(copyKey)) orderedServiceIds.push(copyKey);
      });
    });
    // Append any active service IDs not yet emitted (e.g. custom services,
    // or copies whose base is missing from ALL_SERVICES) in their original
    // insertion order so we never silently drop one.
    activeServices.forEach(id => {
      if (!orderedServiceIds.includes(id)) orderedServiceIds.push(id);
    });

    orderedServiceIds.forEach(serviceId => {
      const quantity = serviceQuantities[serviceId] || 0;
      if (quantity > 0) {

        // Handle Custom Services
        if (serviceId.startsWith('custom-')) {
            const custom = customServices.find(s => s.id === serviceId);
            if (custom) {
                 const totalPrice = custom.unitPrice * quantity;
                 // Only emit a description bullet when the user actually typed one.
                 // Otherwise the empty entry renders as an undeletable blank bullet
                 // in the preview and gets reinstated by every auto-save.
                 const trimmedDesc = (custom.description || '').trim();
                 services.push({
                     name: custom.name,
                     quantity,
                     unitPrice: formatPriceForJSON(custom.unitPrice),
                     totalPrice: formatPriceForJSON(totalPrice),
                     modifiedDefaults: trimmedDesc
                       ? [{ text: trimmedDesc, children: [] }]
                       : []
                 });
            }
            return;
        }

        const totalPrice = calculateServicePrice(serviceId, quantity);
        const unitPrice = quantity > 0 ? totalPrice / quantity : 0;
        
        const serviceData: ServiceData = {
          name: getServiceNameFromId(getBaseServiceId(serviceId)),
          quantity,
          unitPrice: formatPriceForJSON(unitPrice),
          totalPrice: formatPriceForJSON(totalPrice)
        } as any;

        // Persist instance key so duplicates survive a page reload
        if (serviceId.includes('__')) {
          (serviceData as any).instanceKey = serviceId;
        }

        if (serviceCustomPrices[serviceId]) {
          serviceData.customPrice = serviceCustomPrices[serviceId];
        }
        if (serviceBuildingTypes[serviceId]) {
          serviceData.buildingType = serviceBuildingTypes[serviceId];
        }
        if (serviceApartmentSizes[serviceId]) {
          serviceData.apartmentSize = serviceApartmentSizes[serviceId];
        }
        if (serviceProjectTypes[serviceId]) {
          serviceData.projectType = serviceProjectTypes[serviceId];
        }
        if (serviceAreaSizes[serviceId]) {
          serviceData.areaSize = serviceAreaSizes[serviceId];
        }

        services.push(serviceData);
      }
    });

    // Compute pricing fresh from services (avoids stale totals state from async useEffect)
    let freshSubtotal = 0;
    services.forEach((s: any) => {
      freshSubtotal += parseFloat(String(s.totalPrice).replace(',', '.')) || 0;
    });
    let freshDiscountAmount = 0;
    if (discount.type && discount.value > 0) {
      if (discount.type === 'percentage') freshDiscountAmount = freshSubtotal * (discount.value / 100);
      else if (discount.type === 'fixed') freshDiscountAmount = discount.value;
    }
    const freshTotalNet = freshSubtotal - freshDiscountAmount;
    const freshTotalVat = freshTotalNet * 0.19;
    const freshTotalGross = freshTotalNet + freshTotalVat;

    const result: any = {
      clientInfo,
      projectInfo: {
        ...projectInfo,
        date: dateStr,
        MM: String(today.getMonth() + 1).padStart(2, '0'),
        DD: String(today.getDate()).padStart(2, '0')
      },
      services,
      images: includeImageData ? images : images.map(img => ({
        title: img.title,
        description: img.description,
        fileName: img.fileName,
        fileSize: img.fileSize,
        fileType: img.fileType
      })),
      pricing: {
        subtotalNet: formatPriceForJSON(freshSubtotal),
        totalNetPrice: formatPriceForJSON(freshTotalNet),
        totalVat: formatPriceForJSON(freshTotalVat),
        totalGrossPrice: formatPriceForJSON(freshTotalGross)
      },
      signature: {
        signatureName: 'Christopher Helm'
      }
    };

    if (discount.type && discount.value > 0) {
      const discountDescription = buildCanonicalDiscountDescription(
        discount.type,
        discount.value,
        discount.description
      );
      result.pricing.discount = {
        type: discount.type,
        value: discount.value,
        amount: formatPriceForJSON(freshDiscountAmount),
        description: discountDescription
      };
    }

    return result;
  };

  const getServiceNameFromId = (serviceId: string): string => {
    const serviceMapping: Record<string, string> = {
      'exterior-ground': '3D-Außenvisualisierung Bodenperspektive',
      'exterior-bird': '3D-Außenvisualisierung Vogelperspektive',
      '3d-floorplan': '3D-Grundriss',
      '3d-complete-floor': '3D-Geschossplan',
      '2d-floorplan': '2D-Grundriss',
      'home-staging': 'Digital Home Staging',
      'renovation': 'Digitale Renovierung',
      '360-interior': '360° Tour Innen',
      '360-exterior': '360° Video Außen',
      'slideshow': 'Slideshow Video',
      'site-plan': '3D-Lageplan',
      'social-media': 'Social Media Paket',
      'interior': '3D-Innenvisualisierung',
      'terrace': '3D-Visualisierung Terrasse',
      'video-snippet': 'Video Snippet Außen und Innen',
      'expose-layout': 'Exposé Layout',
      'expose-creation': 'Exposé-Erstellung',
      'project-branding': 'Projekt-Branding',
      'project-website': 'Projektwebseite (Profi-Design)',
      'flat-finder': 'Flat Finder',
      'online-marketing': 'Online Marketing'
    };
    return serviceMapping[serviceId] || serviceId;
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2).replace('.', ',') + ' €';
  };

  const formatPriceForJSON = (price: number): string => {
    return price.toFixed(2).replace('.', ',');
  };

  const handleFetchClient = async () => {
    const clientIdentifier = clientInfo.clientNumber.trim();
    
    if (!clientIdentifier) {
      showNotification('Bitte Kundennummer oder E-Mail eingeben', 'error');
      return;
    }

    // Check if it's a 5-digit number OR a valid email address
    const isClientNumber = /^\d{5}$/.test(clientIdentifier);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientIdentifier);

    if (!isClientNumber && !isEmail) {
      showNotification('Bitte eine gültige 5-stellige Kundennummer oder E-Mail-Adresse eingeben', 'error');
      return;
    }

    try {
      showNotification('🔍 Kunde wird gesucht...', 'info');
      const response = await fetch(`/api/client-lookup/${encodeURIComponent(clientIdentifier)}`);
      
      if (response.ok) {
        const clientData = await response.json();
        
        if (clientData && clientData.success && clientData.data) {
          const client = clientData.data;
          setClientInfo(prev => ({
            ...prev,
            companyName: client.company_name || ''
          }));
          showNotification(`✓ ${client.company_name || 'Client found'}`, 'success');
        } else {
          showNotification('⚠ Kunde/Firma nicht gefunden', 'error');
        }
      } else {
        showNotification('⚠ Fehler bei Datenbankverbindung', 'error');
      }
    } catch (error) {
      console.error('Error looking up client:', error);
      showNotification('⚠ Verbindungsfehler', 'error');
    }
  };

  const handleGenerateJSON = () => {
    if (discount.value > 0 && !discount.type) {
      showNotification('Bitte eine Rabattart auswählen (Prozent oder Festbetrag).', 'error');
      return;
    }
    const data = collectFormData(true);
    const jsonString = JSON.stringify(data, null, 2);
    setJsonData(jsonString);
    setShowJSON(true);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonData).then(() => {
      showNotification('✅ JSON in Zwischenablage kopiert!', 'success');
    });
  };

  const handlePreviewProposal = () => {
    if (!clientInfo.companyName || !clientInfo.street || !clientInfo.postalCode || 
        !clientInfo.city || !clientInfo.country) {
      showNotification('Bitte alle Pflichtfelder der Kundeninformationen ausfüllen.', 'error');
      return;
    }

    const data = collectFormData(true);

    if (data.services.length === 0) {
      showNotification('Bitte mindestens eine Leistung auswählen.', 'error');
      return;
    }

    if (discount.value > 0 && !discount.type) {
      showNotification('Bitte eine Rabattart auswählen (Prozent oder Festbetrag).', 'error');
      return;
    }

    try {
      // Share via context (survives in-app navigation without localStorage)
      proposal.setRawProposalData(data);
      // Also keep localStorage as fallback
      localStorage.setItem('proposalPreviewData', JSON.stringify(data));
      router.push('/edit');
    } catch (error) {
      console.error('Error storing preview data:', error);
      showNotification('Fehler bei Vorschau-Vorbereitung. Bitte erneut versuchen.', 'error');
    }
  };

  const handleReset = () => {
    if (confirm('Sind Sie sicher, dass Sie das Formular zurücksetzen möchten? Alle gespeicherten Daten werden gelöscht.')) {
      setClientInfo({
        clientNumber: '',
        companyName: '',
        street: '',
        postalCode: '',
        city: '',
        country: ''
      });
      setProjectInfo({
        projectNumber: '',
        projectName: '',
        projectType: '',
        customProjectType: '',
        deliveryTime: '4-6',
        deliveryDaysMin: 4,
        deliveryDaysMax: 6,
        offerValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      setActiveServices(new Set());
      setCustomServices([]);
      setServiceQuantities({});
      setServiceCustomPrices({});
      setServiceBuildingTypes({});
      setServiceApartmentSizes({});
      setServiceProjectTypes({});
      setServiceAreaSizes({});
      setServiceDuplicates({});
      setImages([]);
      setDiscount({ type: '', value: 0, description: '' });
      setShowJSON(false);
      setJsonData('');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('proposalPreviewData');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-10 py-12 flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-white text-3xl font-semibold tracking-tight">
              Angebotsgenerator
            </h1>
            <p className="text-white/80 mt-2 text-base">
              Angebot erstellen
            </p>
          </div>
          <div className="flex-shrink-0 flex items-center gap-5">
            <Link
              href="/proposals"
              className="text-white/90 hover:text-white text-sm font-medium border border-white/30 rounded-md px-4 py-2 transition-colors"
            >
              Alle Angebote
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="text-white/70 hover:text-white text-sm font-medium px-3 py-2 transition-colors"
              >
                Abmelden
              </button>
            </form>
            <div className="text-white text-xl font-bold">ExposeProfi</div>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-10 py-12">
          {/* Client Information */}
          <div className="mb-10 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">
              👤 Kundeninformationen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Kundennummer oder E-Mail
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientInfo.clientNumber}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, clientNumber: e.target.value }))}
                    placeholder="12345 or client@company.com"
                    className="flex-1 px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleFetchClient}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-lg min-w-[40px]"
                    title="Fetch company name"
                  >
                    ✓
                  </button>
                </div>
                <span className="text-xs text-gray-700 mt-1.5 block">
                  5-stellige Kundennummer oder E-Mail-Adresse eingeben
                </span>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Firmenname *
                </label>
                <input
                  type="text"
                  value={clientInfo.companyName}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Wird aus Datenbank geladen"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Straße *
                </label>
                <input
                  type="text"
                  value={clientInfo.street}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="z.B. Musterstraße 123"
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  PLZ *
                </label>
                <input
                  type="text"
                  value={clientInfo.postalCode}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="z.B. 12345"
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Ort *
                </label>
                <input
                  type="text"
                  value={clientInfo.city}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="z.B. Berlin"
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Land *
                </label>
                <select
                  value={clientInfo.country}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, country: e.target.value }))}
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                >
                  <option value="">Land wählen</option>
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Project Information */}
          <div className="mb-10 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">
              🏢 Projektinformationen
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Projektname
                </label>
                <input
                  type="text"
                  value={projectInfo.projectName}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="z.B. Sonnenhof Wohnanlage"
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Gebäudetyp *
                </label>
                <select
                  value={projectInfo.projectType}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, projectType: e.target.value }))}
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                >
                  <option value="">Gebäudetyp wählen...</option>
                  {projectTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-700 mt-1.5 block">
                  Gebäudetyp beeinflusst die Preisgestaltung
                </span>
              </div>

              {projectInfo.projectType === 'Custom' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                    Eigener Gebäudetyp
                  </label>
                  <input
                    type="text"
                    value={projectInfo.customProjectType}
                    onChange={(e) => setProjectInfo(prev => ({ ...prev, customProjectType: e.target.value }))}
                    placeholder="Eigenen Gebäudetyp eingeben"
                    className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Lieferzeit *
                </label>
                <input
                  type="text"
                  value={projectInfo.deliveryTime}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, deliveryTime: e.target.value }))}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
                <span className="text-xs text-gray-700 mt-1.5 block">
                  Standard: 4-6 (nur die Zahl/Range eingeben, "Arbeitstage" wird automatisch ergänzt)
                </span>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Angebot gültig bis *
                </label>
                <input
                  type="date"
                  value={projectInfo.offerValidUntil}
                  onChange={(e) => setProjectInfo(prev => ({ ...prev, offerValidUntil: e.target.value }))}
                  required
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Services Section */}
          <div className="mb-10 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">
              🎨 Leistungen auswählen
            </h2>
            
            {ALL_SERVICES.flatMap((service) => {
              // Helper to build props for any instance (original or copy)
              const buildItemProps = (instanceKey: string, instanceName: string, isCopy: boolean) => ({
                serviceId: instanceKey,
                serviceName: instanceName,
                isActive: activeServices.has(instanceKey),
                quantity: serviceQuantities[instanceKey] || 0,
                customPrice: serviceCustomPrices[instanceKey],
                buildingType: serviceBuildingTypes[instanceKey],
                globalBuildingType: projectInfo.projectType,
                apartmentSize: serviceApartmentSizes[instanceKey],
                projectType: serviceProjectTypes[instanceKey],
                areaSize: serviceAreaSizes[instanceKey],
                price: calculateServicePrice(instanceKey, serviceQuantities[instanceKey] || 0),
                onToggle: (active: boolean) => {
                  const newSet = new Set(activeServices);
                  if (active) { newSet.add(instanceKey); } else { newSet.delete(instanceKey); }
                  setActiveServices(newSet);
                },
                onQuantityChange: (qty: number) => setServiceQuantities(prev => ({ ...prev, [instanceKey]: qty })),
                onBuildingTypeChange: (type: string) => setServiceBuildingTypes(prev => ({ ...prev, [instanceKey]: type })),
                onApartmentSizeChange: (size: string) => setServiceApartmentSizes(prev => ({ ...prev, [instanceKey]: size })),
                onProjectTypeChange: (type: string) => setServiceProjectTypes(prev => ({ ...prev, [instanceKey]: type })),
                onAreaSizeChange: (size: string) => setServiceAreaSizes(prev => ({ ...prev, [instanceKey]: size })),
                onDuplicate: () => handleDuplicate(service.id),
                onRemove: isCopy ? () => handleRemoveDuplicate(instanceKey, service.id) : undefined,
              });

              const copies = serviceDuplicates[service.id] || [];
              return [
                <ServiceItem key={service.id} {...buildItemProps(service.id, service.name, false)} />,
                ...copies.map((copyKey, idx) => (
                  <ServiceItem key={copyKey} {...buildItemProps(copyKey, `${service.name} (Kopie ${idx + 2})`, true)} />
                ))
              ];
            })}

            {/* Custom Services Section */}
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Eigenes Produkt hinzufügen</h3>
              {(() => {
                const parsedPrice = parseFloat(customDraft.price);
                const priceValid = customDraft.price !== '' && !isNaN(parsedPrice) && parsedPrice >= 0;
                const canAdd = customDraft.name.trim() !== '' && priceValid;

                const submitDraft = () => {
                  if (!canAdd) {
                    showNotification('Name und gültiger Preis sind erforderlich', 'error');
                    return;
                  }
                  const newService = {
                    id: `custom-${Date.now()}`,
                    name: customDraft.name.trim(),
                    description: customDraft.description.trim(),
                    unitPrice: parsedPrice,
                    quantity: 1
                  };
                  setCustomServices(prev => [...prev, newService]);
                  setServiceQuantities(prev => ({ ...prev, [newService.id]: 1 }));
                  setActiveServices(prev => new Set(prev).add(newService.id));
                  setCustomDraft({ name: '', price: '', description: '' });
                  showNotification('Eigenes Produkt hinzugefügt', 'success');
                };

                const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitDraft();
                  }
                };

                const inputClass = 'w-full px-4 py-3 border border-gray-300 rounded-lg text-base text-slate-800 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800';

                return (
                  <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      <div className="md:col-span-4">
                        <label htmlFor="customName" className="block text-sm font-semibold text-slate-800 mb-2">
                          Name *
                        </label>
                        <input
                          id="customName"
                          type="text"
                          value={customDraft.name}
                          onChange={(e) => setCustomDraft(prev => ({ ...prev, name: e.target.value }))}
                          onKeyDown={handleEnter}
                          placeholder="Produktname"
                          className={inputClass}
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label htmlFor="customPrice" className="block text-sm font-semibold text-slate-800 mb-2">
                          Preis (€) *
                        </label>
                        <input
                          id="customPrice"
                          type="number"
                          value={customDraft.price}
                          onChange={(e) => setCustomDraft(prev => ({ ...prev, price: e.target.value }))}
                          onKeyDown={handleEnter}
                          placeholder="0,00"
                          step="0.01"
                          min="0"
                          inputMode="decimal"
                          className={inputClass}
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label htmlFor="customDesc" className="block text-sm font-semibold text-slate-800 mb-2">
                          Beschreibung
                        </label>
                        <input
                          id="customDesc"
                          type="text"
                          value={customDraft.description}
                          onChange={(e) => setCustomDraft(prev => ({ ...prev, description: e.target.value }))}
                          onKeyDown={handleEnter}
                          placeholder="Kurze Beschreibung (optional)"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={submitDraft}
                        disabled={!canAdd}
                        className="inline-flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* List of Custom Services */}
              {customServices.length > 0 && (
                <div className="mt-4 space-y-3">
                  {customServices.map(service => {
                    const qty = serviceQuantities[service.id] || 0;
                    return (
                      <div key={service.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-300 rounded-lg p-4">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 break-words">{service.name}</div>
                          {service.description && (
                            <div className="text-sm text-gray-600 mt-0.5 break-words">{service.description}</div>
                          )}
                          <div className="text-sm font-semibold text-slate-700 mt-1">
                            {service.unitPrice.toFixed(2).replace('.', ',')} € pro Einheit
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                            <button
                              type="button"
                              aria-label="Anzahl reduzieren"
                              className="px-3 py-1.5 text-slate-700 hover:bg-gray-100 disabled:opacity-40"
                              disabled={qty <= 0}
                              onClick={() => setServiceQuantities(prev => ({ ...prev, [service.id]: Math.max(0, (prev[service.id] || 0) - 1) }))}
                            >−</button>
                            <span className="px-3 min-w-[2rem] text-center text-slate-800 font-semibold border-x border-gray-300">{qty}</span>
                            <button
                              type="button"
                              aria-label="Anzahl erhöhen"
                              className="px-3 py-1.5 text-slate-700 hover:bg-gray-100"
                              onClick={() => setServiceQuantities(prev => ({ ...prev, [service.id]: (prev[service.id] || 0) + 1 }))}
                            >+</button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomServices(customServices.filter(s => s.id !== service.id));
                              setActiveServices(prev => {
                                const next = new Set(prev);
                                next.delete(service.id);
                                return next;
                              });
                              setServiceQuantities(prev => {
                                const next = { ...prev };
                                delete next[service.id];
                                return next;
                              });
                            }}
                            className="text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Image Upload Section */}
          <ImageUploadSection
            images={images}
            onImagesChange={setImages}
          />

          {/* Discount Section */}
          <div className="mb-10 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">
              💸 Rabatt (Optional)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                  Rabattart
                </label>
                <select
                  value={discount.type}
                  onChange={(e) => setDiscount(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                >
                  <option value="">Kein Rabatt</option>
                  <option value="percentage">Prozent (%)</option>
                  <option value="fixed">Festbetrag (EUR)</option>
                </select>
              </div>

              {discount.type && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                      Rabattwert
                    </label>
                    <input
                      type="number"
                      value={discount.value || ''}
                      onChange={(e) => setDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                    />
                    <span className="text-xs text-gray-700 mt-1.5 block">
                      {discount.type === 'percentage' ? 'Prozent eingeben (z.B. 10 für 10%)' : 'Betrag in EUR eingeben'}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-800 mb-2.5">
                      Rabattbeschreibung
                    </label>
                    <input
                      type="text"
                      value={discount.description}
                      onChange={(e) => setDiscount(prev => ({ ...prev, description: e.target.value }))}
                      placeholder={discount.type === 'percentage' ? 'z.B. Stammkundenrabatt' : 'z.B. Mengenrabatt, Sonderaktion'}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-lg text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Summary — compute discount values inline so they update on every keystroke */}
          {(() => {
            const liveDiscountAmount = discount.type === 'percentage' && discount.value > 0
              ? totals.subtotalNet * (discount.value / 100)
              : discount.type === 'fixed' && discount.value > 0
                ? discount.value
                : 0;
            const liveTotalNet = totals.subtotalNet - liveDiscountAmount;
            const liveTotals = {
              subtotalNet: totals.subtotalNet,
              discountAmount: liveDiscountAmount,
              totalNet: liveTotalNet,
              totalVat: liveTotalNet * 0.19,
              totalGross: liveTotalNet * 1.19,
            };
            return <Summary totals={liveTotals} discount={discount} formatPrice={formatPrice} />;
          })()}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mt-8">
            <button
              type="button"
              onClick={handleReset}
              className="px-8 py-3.5 bg-gray-100 text-slate-800 rounded-lg text-base font-semibold border border-gray-300 hover:bg-gray-200 transition-colors"
            >
              🔄 Zurücksetzen
            </button>
            <button
              type="button"
              onClick={handleGenerateJSON}
              className="px-8 py-3.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-lg text-base font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              📋 JSON erstellen
            </button>
            <button
              type="button"
              onClick={handlePreviewProposal}
              className="px-8 py-3.5 bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-lg text-base font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              👁️ Vorschau Angebot
            </button>
          </div>

          {/* JSON Output */}
          {showJSON && (
            <div className="mt-5">
              <pre className="bg-gray-900 text-gray-300 p-5 rounded-lg max-h-96 overflow-y-auto font-mono text-xs">
                {jsonData}
              </pre>
              <button
                type="button"
                onClick={handleCopyJSON}
                className="mt-2.5 px-5 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm"
              >
                📋 JSON kopieren
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Auto-save Indicator */}
      <AutoSaveIndicator status={autoSaveStatus} />
    </div>
  );
}
