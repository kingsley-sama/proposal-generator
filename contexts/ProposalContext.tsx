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
}

export interface ProjectInfo {
  projectNumber: string;
  projectName: string;
  projectType: string;
  customProjectType: string;
  deliveryTime: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  offerValidUntil: string;
  date: string;
  MM: string;
  DD: string;
  year: string;
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
  services: ServiceData[];
  images: ImageData[];
  pricing: PricingData;
  signature: SignatureData;
  terms?: any;
}

interface ProposalContextType {
  state: ProposalState;
  
  // Client Info
  updateClientInfo: (updates: Partial<ClientInfo>) => void;
  
  // Project Info
  updateProjectInfo: (updates: Partial<ProjectInfo>) => void;
  
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
  
  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => void;
  clearStorage: () => void;
  
  // Validation
  isValid: () => boolean;
  getValidationErrors: () => string[];
  
  // Auto-save status
  autoSaveStatus: 'idle' | 'saving' | 'saved';

  // Shared assembled proposal data (used by both form and preview pages)
  assembledData: any | null;
  setAssembledData: (data: any) => void;
  updateAssembledData: (updates: Partial<any>) => void;
}

const ProposalContext = createContext<ProposalContextType | undefined>(undefined);

const STORAGE_KEY = 'proposalFormData';
const AUTOSAVE_INTERVAL = 5000;

// Initial state
const createInitialState = (): ProposalState => ({
  clientInfo: {
    clientNumber: '',
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    country: 'Deutschland'
  },
  projectInfo: {
    projectNumber: '',
    projectName: '',
    projectType: '',
    customProjectType: '',
    deliveryTime: 'Calculated automatically',
    deliveryDaysMin: 0,
    deliveryDaysMax: 0,
    offerValidUntil: getDefaultOfferValidDate(),
    date: new Date().toISOString().split('T')[0],
    MM: String(new Date().getMonth() + 1).padStart(2, '0'),
    DD: String(new Date().getDate()).padStart(2, '0'),
    year: String(new Date().getFullYear())
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
  }
});

function getDefaultOfferValidDate(): string {
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  return oneWeekLater.toISOString().split('T')[0];
}

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProposalState>(createInitialState());
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Shared assembled proposal data — single source of truth for form ↔ preview
  const [assembledData, setAssembledDataState] = useState<any | null>(null);

  // Load assembled data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('proposalPreviewData');
      if (saved) {
        setAssembledDataState(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading assembled proposal data:', e);
    }
  }, []);

  // Persist assembled data to localStorage whenever it changes
  useEffect(() => {
    if (assembledData) {
      try {
        localStorage.setItem('proposalPreviewData', JSON.stringify(assembledData));
      } catch (e) {
        console.error('Error persisting assembled proposal data:', e);
      }
    }
  }, [assembledData]);

  const setAssembledData = useCallback((data: any) => {
    setAssembledDataState(data);
  }, []);

  const updateAssembledData = useCallback((updates: Partial<any>) => {
    setAssembledDataState((prev: any) => {
      if (!prev) return updates;
      return { ...prev, ...updates };
    });
  }, []);

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
      projectName: state.projectInfo.projectName
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
    setState(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        discount
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
      console.log('📂 Loading saved proposal data...');
      
      setState(data);
      console.log('✅ Proposal data restored from localStorage');
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('proposalPreviewData');
    sessionStorage.removeItem('proposalPreviewData');
    setState(createInitialState());
    setAssembledDataState(null);
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

  const value: ProposalContextType = {
    state,
    updateClientInfo,
    updateProjectInfo,
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
    saveToStorage,
    loadFromStorage,
    clearStorage,
    isValid,
    getValidationErrors,
    autoSaveStatus,
    assembledData,
    setAssembledData,
    updateAssembledData
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
