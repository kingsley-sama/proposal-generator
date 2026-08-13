'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { calculateDeliveryTime } from '@/utils/deliveryTime';
import { parseServiceDescription, formatForTemplate, type BulletPoint } from '@/utils/descriptionHelpers';

// Import service descriptions as source of truth
const serviceDescriptions = require('@/lib/service_description.js');

// Types
export interface ClientInfo {
  clientNumber: string;
  companyName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  /** Setup form — client's contact person */
  contactPersonName: string;
  contactPersonEmail: string;
}

export interface ProjectInfo {
  projectNumber: string;
  projectName: string;
  /**
   * Building type of the visualised property (Einfamilienhaus, Hotel, …) —
   * NOT a database enum. Drives the exterior-visualisation price matrices and
   * is stored on the proposal as `proposals.project_type`. The `projects` row's
   * own `project_type` enum comes from `projectCategory` instead.
   */
  projectType: string;
  customProjectType: string;
  /** DB enum public.property_type_values: 'Commercial' | 'Residential' */
  propertyType: string;
  /** Setup form — responsible project manager */
  projectManagerName: string;
  /** DB enum public.pm_type: 'general' | 'dedicated' */
  projectManagerType: string;
  /** DB enum public.project_type_values: 'Digital Makler' | 'Flat rate' | 'Standard' */
  projectCategory: string;
  /** DB enum public.construction_type_values: 'New' | 'Existing' */
  constructionType: string;
  /** DB enum public.yes_no_values: 'Yes' | 'No' */
  questionnaireReceived: string;
  /** DB enum public.first_next_project: 'First' | 'Next' */
  firstOrNextProject: string;
  /** ISO date → projects.order_confirmation_date (NOT NULL in the DB) */
  orderConfirmationDate: string;
  /** ISO date → projects.delivery_completion_date (optional) */
  deliveryCompletionDate: string;
  deliveryTime: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  offerValidUntil: string;
  date: string;
  MM: string;
  DD: string;
  year: string;
}

export interface PartialInvoiceInfo {
  /** True once the user has explicitly answered the Yes/No toggle. */
  answered: boolean;
  enabled: boolean;
  split: string;
  note: string;
}

export interface OfferMeta {
  salespersonName: string;
  partialInvoice: PartialInvoiceInfo;
  /** DB enum public.yes_no_values: 'Yes' | 'No' */
  deposit: string;
  /** Set to true once the Setup form has passed "Mark as Ready". */
  isReady: boolean;
}

export interface ServiceData {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customPrice?: number;
  buildingType?: string;
  apartmentSize?: string;
  projectType?: string;
  areaSize?: string;
  customDescription?: BulletPoint[];  // Now uses structured bullet points
  modifiedDefaults?: any[];
}

export interface DiscountInfo {
  type: 'percentage' | 'fixed' | '';
  value: number;
  amount?: number;
  description: string;
}

export interface ImageData {
  title: string;
  description: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  imageData?: string;
}

export interface PricingData {
  subtotalNet: number;
  discountAmount: number;
  totalNetPrice: number;
  totalVat: number;
  totalGrossPrice: number;
  discount?: DiscountInfo;
}

export interface SignatureData {
  signatureName: string;
}

export interface ProposalState {
  clientInfo: ClientInfo;
  projectInfo: ProjectInfo;
  offerMeta: OfferMeta;
  services: ServiceData[];
  images: ImageData[];
  pricing: PricingData;
  signature: SignatureData;
  terms?: any;
  /** Shared raw proposal data between form and preview pages */
  rawProposalData: any | null;
}

interface ProposalContextType {
  state: ProposalState;
  
  // Client Info
  updateClientInfo: (updates: Partial<ClientInfo>) => void;
  
  // Project Info
  updateProjectInfo: (updates: Partial<ProjectInfo>) => void;

  // Offer meta (setup form: salesperson, partial invoice, ready flag).
  // partialInvoice accepts a partial patch that is shallow-merged.
  updateOfferMeta: (
    updates: Partial<Omit<OfferMeta, 'partialInvoice'>> & {
      partialInvoice?: Partial<PartialInvoiceInfo>;
    }
  ) => void;

  // Services
  addService: (serviceId: string) => void;
  removeService: (serviceId: string) => void;
  updateService: (serviceId: string, updates: Partial<ServiceData>) => void;
  updateServiceDescription: (serviceId: string, description: BulletPoint[]) => void;
  getServiceById: (serviceId: string) => ServiceData | undefined;
  isServiceActive: (serviceId: string) => boolean;
  getFormattedDescription: (serviceId: string) => any[];  // Get formatted description for template
  
  // Images
  addImage: (image: ImageData) => void;
  removeImage: (index: number) => void;
  updateImage: (index: number, updates: Partial<ImageData>) => void;
  
  // Pricing
  updateDiscount: (discount: DiscountInfo) => void;
  removeDiscount: () => void;
  recalculatePricing: () => void;
  
  // Signature
  updateSignature: (updates: Partial<SignatureData>) => void;
  
  // Shared raw proposal data (bridge between form and preview)
  setRawProposalData: (data: any) => void;
  updateRawProposalData: (updates: Partial<any>) => void;

  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
  clearStorage: () => void;
  
  // Validation
  isValid: () => boolean;
  getValidationErrors: () => string[];
  /** Field-level validation for the Setup form (Step 1). Keyed by field id. */
  getSetupErrors: () => Record<string, string>;
  
  // Auto-save status
  autoSaveStatus: 'idle' | 'saving' | 'saved';
}

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

const STORAGE_KEY = 'proposalFormData';
const AUTOSAVE_INTERVAL = 5000;

const stripLeadingPercentageTokens = (value: string): string => {
  if (!value) return '';
  return value.replace(/^(\s*\d+(?:[.,]\d+)?%\s*)+/g, '').trim();
};

const toCanonicalDiscount = (discount: DiscountInfo): DiscountInfo => {
  const numericValue = Number(discount.value) || 0;
  const cleanDescription = stripLeadingPercentageTokens(discount.description || '');

  if (discount.type === 'percentage' && numericValue > 0) {
    return {
      ...discount,
      value: numericValue,
      description: cleanDescription ? `${numericValue}% ${cleanDescription}` : `${numericValue}%`
    };
  }

  return {
    ...discount,
    value: numericValue,
    description: cleanDescription
  };
};

// Initial state
const createInitialState = (): ProposalState => ({
  clientInfo: {
    clientNumber: '',
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland',
    contactPersonName: '',
    contactPersonEmail: ''
  },
  projectInfo: {
    projectNumber: '',
    projectName: '',
    projectType: '',
    customProjectType: '',
    propertyType: '',
    projectManagerName: '',
    projectManagerType: '',
    projectCategory: '',
    constructionType: '',
    questionnaireReceived: '',
    firstOrNextProject: '',
    orderConfirmationDate: new Date().toISOString().split('T')[0],
    deliveryCompletionDate: '',
    deliveryTime: 'Calculated automatically',
    deliveryDaysMin: 0,
    deliveryDaysMax: 0,
    offerValidUntil: getDefaultOfferValidDate(),
    date: new Date().toISOString().split('T')[0],
    MM: String(new Date().getMonth() + 1).padStart(2, '0'),
    DD: String(new Date().getDate()).padStart(2, '0'),
    year: String(new Date().getFullYear())
  },
  offerMeta: {
    salespersonName: '',
    partialInvoice: { answered: false, enabled: false, split: '', note: '' },
    deposit: '',
    isReady: false
  },
  services: [],
  images: [],
  pricing: {
    subtotalNet: 0,
    discountAmount: 0,
    totalNetPrice: 0,
    totalVat: 0,
    totalGrossPrice: 0
  },
  signature: {
    signatureName: 'Christopher Helm'
  },
  rawProposalData: null
});

function getDefaultOfferValidDate(): string {
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  return oneWeekLater.toISOString().split('T')[0];
}

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProposalState>(createInitialState());
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load from storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Auto-save
  useEffect(() => {
    const interval = setInterval(() => {
      saveToStorage();
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [state]);

  // Recalculate pricing and delivery time when services or discount change
  useEffect(() => {
    recalculatePricing();
    updateDeliveryTime();
  }, [state.services, state.pricing.discount]);

  // Update delivery time based on services
  const updateDeliveryTime = useCallback(() => {
    setState(prev => {
      const deliveryInfo = calculateDeliveryTime(prev.services);
      return {
        ...prev,
        projectInfo: {
          ...prev.projectInfo,
          deliveryTime: deliveryInfo.deliveryTime,
          deliveryDaysMin: deliveryInfo.deliveryDaysMin,
          deliveryDaysMax: deliveryInfo.deliveryDaysMax
        }
      };
    });
  }, [state.services]);

  // Client Info
  const updateClientInfo = useCallback((updates: Partial<ClientInfo>) => {
    setState(prev => ({
      ...prev,
      clientInfo: { ...prev.clientInfo, ...updates }
    }));
  }, []);

  // Project Info
  const updateProjectInfo = useCallback((updates: Partial<ProjectInfo>) => {
    setState(prev => ({
      ...prev,
      projectInfo: { ...prev.projectInfo, ...updates }
    }));
  }, []);

  // Offer meta (salesperson, partial invoice, ready flag)
  const updateOfferMeta = useCallback((updates: Partial<Omit<OfferMeta, 'partialInvoice'>> & {
    partialInvoice?: Partial<PartialInvoiceInfo>;
  }) => {
    setState(prev => ({
      ...prev,
      offerMeta: {
        ...prev.offerMeta,
        ...updates,
        // Merge nested partialInvoice so callers can patch a single field.
        partialInvoice: {
          ...prev.offerMeta.partialInvoice,
          ...(updates.partialInvoice || {})
        }
      }
    }));
  }, []);

  // Services
  const addService = useCallback((serviceId: string) => {
    setState(prev => {
      // Check if service already exists
      if (prev.services.some(s => s.id === serviceId)) {
        return prev;
      }

      // Get service info from service_description.js
      const serviceInfo = serviceDescriptions[serviceId];
      if (!serviceInfo) {
        console.warn(`Service ${serviceId} not found in service descriptions`);
        return prev;
      }

      const newService: ServiceData = {
        id: serviceId,
        name: serviceInfo.name,
        quantity: 1,
        unitPrice: serviceInfo.defaultPrice || 0,
        totalPrice: serviceInfo.defaultPrice || 0,
        customDescription: serviceInfo.description 
          ? parseServiceDescription(serviceInfo.description)  // Parse into editable structure
          : []
      };

      return {
        ...prev,
        services: [...prev.services, newService]
      };
    });
  }, []);

  const removeService = useCallback((serviceId: string) => {
    setState(prev => ({
      ...prev,
      services: prev.services.filter(s => s.id !== serviceId)
    }));
  }, []);

  const updateService = useCallback((serviceId: string, updates: Partial<ServiceData>) => {
    setState(prev => ({
      ...prev,
      services: prev.services.map(service => {
        if (service.id !== serviceId) return service;
        
        const updated = { ...service, ...updates };
        
        // Recalculate total if quantity or price changed
        if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
          updated.totalPrice = updated.quantity * updated.unitPrice;
        }
        
        return updated;
      })
    }));
  }, []);

  const updateServiceDescription = useCallback((serviceId: string, description: BulletPoint[]) => {
    updateService(serviceId, { customDescription: description });
  }, [updateService]);

  const getServiceById = useCallback((serviceId: string) => {
    return state.services.find(s => s.id === serviceId);
  }, [state.services]);

  const isServiceActive = useCallback((serviceId: string) => {
    return state.services.some(s => s.id === serviceId);
  }, [state.services]);

  // Get formatted description for document generation (replaces XXX placeholders)
  const getFormattedDescription = useCallback((serviceId: string) => {
    const service = getServiceById(serviceId);
    if (!service || !service.customDescription) return [];
    
    return formatForTemplate(service.customDescription, {
      quantity: service.quantity,
      projectName: state.projectInfo.projectName,
      serviceId: service.id
    });
  }, [state.services, state.projectInfo.projectName, getServiceById]);

  // Images
  const addImage = useCallback((image: ImageData) => {
    setState(prev => ({
      ...prev,
      images: [...prev.images, image]
    }));
  }, []);

  const removeImage = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  }, []);

  const updateImage = useCallback((index: number, updates: Partial<ImageData>) => {
    setState(prev => ({
      ...prev,
      images: prev.images.map((img, i) => 
        i === index ? { ...img, ...updates } : img
      )
    }));
  }, []);

  // Pricing
  const recalculatePricing = useCallback(() => {
    setState(prev => {
      let subtotalNet = 0;

      // Calculate service totals
      prev.services.forEach(service => {
        subtotalNet += service.totalPrice;
      });

      // Calculate discount
      let discountAmount = 0;
      const discount = prev.pricing?.discount;
      if (discount && discount.type && discount.value > 0) {
        if (discount.type === 'percentage') {
          discountAmount = subtotalNet * (discount.value / 100);
        } else if (discount.type === 'fixed') {
          discountAmount = discount.value;
        }
      }

      const totalNetPrice = subtotalNet - discountAmount;
      const totalVat = totalNetPrice * 0.19;
      const totalGrossPrice = totalNetPrice + totalVat;

      return {
        ...prev,
        pricing: {
          ...prev.pricing,
          subtotalNet,
          discountAmount,
          totalNetPrice,
          totalVat,
          totalGrossPrice,
          discount: discount || prev.pricing?.discount
        }
      };
    });
  }, []);

  const updateDiscount = useCallback((discount: DiscountInfo) => {
    const normalizedDiscount = toCanonicalDiscount(discount);
    setState(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        discount: normalizedDiscount
      }
    }));
  }, []);

  const removeDiscount = useCallback(() => {
    setState(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        discount: undefined
      }
    }));
  }, []);

  // Shared raw proposal data
  const setRawProposalData = useCallback((data: any) => {
    setState(prev => ({ ...prev, rawProposalData: data }));
  }, []);

  const updateRawProposalData = useCallback((updates: Partial<any>) => {
    setState(prev => ({
      ...prev,
      rawProposalData: prev.rawProposalData
        ? { ...prev.rawProposalData, ...updates }
        : updates
    }));
  }, []);

  // Signature
  const updateSignature = useCallback((updates: Partial<SignatureData>) => {
    setState(prev => ({
      ...prev,
      signature: { ...prev.signature, ...updates }
    }));
  }, []);

  // Persistence
  const saveToStorage = useCallback(() => {
    try {
      setAutoSaveStatus('saving');
      
      // Create a clean version without heavy data for localStorage
      const dataToSave = {
        ...state,
        images: state.images.map(img => ({
          title: img.title,
          description: img.description,
          fileName: img.fileName,
          fileSize: img.fileSize,
          fileType: img.fileType
          // Omit imageData for localStorage
        }))
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      
      // Also save full data (with images) to sessionStorage for preview
      sessionStorage.setItem('proposalPreviewData', JSON.stringify(state));
      // Save rawProposalData to sessionStorage for cross-tab fallback
      if (state.rawProposalData) {
        sessionStorage.setItem('rawProposalData', JSON.stringify(state.rawProposalData));
      }
      
      console.log('💾 Proposal data auto-saved');
      setAutoSaveStatus('saved');
      
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving proposal data:', error);
      if ((error as Error).name === 'QuotaExceededError') {
        console.warn('⚠️ Storage quota exceeded. Skipping auto-save.');
      }
      setAutoSaveStatus('idle');
    }
  }, [state]);

  const loadFromStorage = useCallback(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (!savedData) return;

      const data = JSON.parse(savedData);
      if (data?.pricing?.discount) {
        data.pricing.discount = toCanonicalDiscount(data.pricing.discount);
      }
      console.log('📂 Loading saved proposal data...');

      // Merge over a fresh initial state so saves written before the Setup-form
      // fields existed still get well-formed clientInfo/projectInfo/offerMeta.
      const base = createInitialState();
      const merged: ProposalState = {
        ...base,
        ...data,
        clientInfo: { ...base.clientInfo, ...(data.clientInfo || {}) },
        projectInfo: { ...base.projectInfo, ...(data.projectInfo || {}) },
        offerMeta: {
          ...base.offerMeta,
          ...(data.offerMeta || {}),
          partialInvoice: {
            ...base.offerMeta.partialInvoice,
            ...(data.offerMeta?.partialInvoice || {})
          }
        }
      };
      setState(merged);
      // Also restore rawProposalData from sessionStorage if available
      const rawData = sessionStorage.getItem('rawProposalData');
      if (rawData) {
        setState(prev => ({ ...prev, rawProposalData: JSON.parse(rawData) }));
      }
      console.log('✅ Proposal data restored from localStorage');
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem('proposalPreviewData');
    setState(createInitialState());
    console.log('🗑️ Proposal data cleared');
  }, []);

  // Validation
  const isValid = useCallback(() => {
    return getValidationErrors().length === 0;
  }, [state]);

  const getValidationErrors = useCallback(() => {
    const errors: string[] = [];

    if (!state.clientInfo.companyName) {
      errors.push('Client company name is required');
    }

    if (!state.projectInfo.projectName) {
      errors.push('Project name is required');
    }

    if (state.services.length === 0) {
      errors.push('At least one service must be selected');
    }

    state.services.forEach((service, index) => {
      if (service.quantity <= 0) {
        errors.push(`Service "${service.name}" must have quantity > 0`);
      }
      if (service.unitPrice <= 0) {
        errors.push(`Service "${service.name}" must have price > 0`);
      }
    });

    return errors;
  }, [state]);

  // Field-level validation for the Setup form (Step 1). Returns a map of
  // fieldId → message for every required field that is not yet filled.
  const getSetupErrors = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    const { clientInfo, projectInfo, offerMeta } = state;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!clientInfo.clientNumber?.trim()) errors.clientNumber = 'Kunden-ID ist erforderlich';
    if (!projectInfo.projectNumber?.trim()) errors.projectNumber = 'Projekt-ID ist erforderlich';
    if (!projectInfo.projectName?.trim()) errors.projectName = 'Projektname ist erforderlich';
    if (!projectInfo.projectManagerName?.trim())
      errors.projectManagerName = 'Name des Projektleiters ist erforderlich';
    if (!projectInfo.projectManagerType?.trim())
      errors.projectManagerType = 'Art des Projektleiters ist erforderlich';
    if (!projectInfo.projectType?.trim()) errors.projectType = 'Gebäudetyp ist erforderlich';
    if (projectInfo.projectType === 'Custom' && !projectInfo.customProjectType?.trim())
      errors.customProjectType = 'Bitte den Gebäudetyp angeben';
    if (!projectInfo.propertyType?.trim()) errors.propertyType = 'Immobilientyp ist erforderlich';
    if (!projectInfo.projectCategory?.trim()) errors.projectCategory = 'Projektart ist erforderlich';
    if (!projectInfo.constructionType?.trim())
      errors.constructionType = 'Bauart (Neubau/Bestand) ist erforderlich';
    if (!projectInfo.questionnaireReceived?.trim())
      errors.questionnaireReceived = 'Bitte angeben, ob der Fragebogen vorliegt';
    if (!projectInfo.firstOrNextProject?.trim())
      errors.firstOrNextProject = 'Bitte Erst- oder Folgeprojekt angeben';
    // NOT NULL in the DB — never let it fall through to the CURRENT_DATE default.
    if (!projectInfo.orderConfirmationDate?.trim())
      errors.orderConfirmationDate = 'Auftragsbestätigungsdatum ist erforderlich';
    // deliveryCompletionDate stays optional: it is not always known up front.
    if (
      projectInfo.deliveryCompletionDate?.trim() &&
      projectInfo.orderConfirmationDate?.trim() &&
      projectInfo.deliveryCompletionDate < projectInfo.orderConfirmationDate
    )
      errors.deliveryCompletionDate = 'Liefertermin darf nicht vor der Auftragsbestätigung liegen';
    if (!clientInfo.contactPersonName?.trim())
      errors.contactPersonName = 'Ansprechpartner ist erforderlich';
    if (!clientInfo.contactPersonEmail?.trim()) {
      errors.contactPersonEmail = 'E-Mail des Ansprechpartners ist erforderlich';
    } else if (!EMAIL_RE.test(clientInfo.contactPersonEmail.trim())) {
      errors.contactPersonEmail = 'Bitte eine gültige E-Mail-Adresse eingeben';
    }
    if (!offerMeta.salespersonName?.trim())
      errors.salespersonName = 'Vertriebsmitarbeiter ist erforderlich';
    if (!projectInfo.date?.trim()) errors.date = 'Datum ist erforderlich';
    if (!offerMeta.partialInvoice.answered) {
      errors.partialInvoice = 'Bitte Teilrechnung mit Ja oder Nein beantworten';
    } else if (offerMeta.partialInvoice.enabled && !offerMeta.partialInvoice.split?.trim()) {
      errors.partialInvoice = 'Bitte die Aufteilung der Teilrechnung angeben';
    }
    if (!offerMeta.deposit?.trim()) errors.deposit = 'Bitte Anzahlung mit Ja oder Nein beantworten';

    return errors;
  }, [state]);

  const value: ProposalContextType = {
    state,
    updateClientInfo,
    updateProjectInfo,
    updateOfferMeta,
    addService,
    removeService,
    updateService,
    updateServiceDescription,
    getServiceById,
    isServiceActive,
    getFormattedDescription,
    addImage,
    removeImage,
    updateImage,
    updateDiscount,
    removeDiscount,
    recalculatePricing,
    updateSignature,
    setRawProposalData,
    updateRawProposalData,
    saveToStorage,
    loadFromStorage,
    clearStorage,
    isValid,
    getValidationErrors,
    getSetupErrors,
    autoSaveStatus
  };

  return (
    <ProposalContext.Provider value={value}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposal() {
  const context = useContext(ProposalContext);
  if (context === undefined) {
    throw new Error('useProposal must be used within a ProposalProvider');
  }
  return context;
}
