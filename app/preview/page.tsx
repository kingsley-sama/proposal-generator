'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/contexts/NotificationContext';
import { useProposal } from '@/contexts/ProposalContext';
import serviceDescriptions from '@/lib/service_description';
// @ts-ignore
import italicData from '@/italics_data';

interface ProposalData {
  clientInfo: any;
  projectInfo: any;
  services: any[];
  images: any[];
  pricing: any;
  signature: any;
  terms?: any;
}

interface ServiceDescription {
  name: string;
  sub_name?: string;
  defaultPrice?: number;
  description: any[];
  pricingTiers?: Array<{ quantity: number; price: number; label: string }>;
  link?: string;
}

export default function PreviewPage() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const proposal = useProposal();
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState('0');
  const [discountDescription, setDiscountDescription] = useState('Mengenrabatt');
  const [showBulletModal, setShowBulletModal] = useState(false);
  const [bulletModalServiceIndex, setBulletModalServiceIndex] = useState<number | null>(null);
  const [bulletInputText, setBulletInputText] = useState('');
  
  // Bulk Edit State
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [bulkEditText, setBulkEditText] = useState('');

  const toDashString = (items: any[], level = 0): string => {
      if (!items) return '';
      let result = '';
      items.forEach(item => {
          const text = typeof item === 'string' ? item : item.text;
          const dashes = '-'.repeat(level + 1);
          result += `${dashes} ${text}\n`;
          if (item.children && item.children.length > 0) {
              result += toDashString(item.children, level + 1);
          }
      });
      return result;
  };

  const startBulkEdit = (index: number, descriptions: any[]) => {
      setEditingServiceIndex(index);
      setBulkEditText(toDashString(descriptions));
  };
  
  const saveBulkEdit = () => {
      if (editingServiceIndex === null || !proposalData) return;
      const parsed = parseBulletText(bulkEditText);
      
      const newServices = [...proposalData.services];
      newServices[editingServiceIndex].modifiedDefaults = parsed;
      updateProposalData({ services: newServices });
      
      setEditingServiceIndex(null);
      setBulkEditText('');
  };

  // Helper to adjust German singular/plural verb forms based on quantity
  const adjustSingularPlural = (text: string, quantity: number): string => {
    if (quantity === 1) {
      // Singular: "Geliefert werden X ..." → "Geliefert wird X ..."
      text = text.replace(/Geliefert werden (\d+)/i, 'Geliefert wird $1');
      // Plural nouns → singular: "Ansichten" → "Ansicht", "Grundrisse" → "Grundriss", etc.
      text = text.replace(/gerenderte Außenansichten/g, 'gerenderte Außenansicht');
      text = text.replace(/gerenderte Innenansichten/g, 'gerenderte Innenansicht');
      text = text.replace(/gerenderte Ansichten/g, 'gerenderte Ansicht');
      text = text.replace(/(\d+)\s+3D-Grundrisse/g, '$1 3D-Grundriss');
      text = text.replace(/(\d+)\s+2D-Grundrisse/g, '$1 2D-Grundriss');
      text = text.replace(/(\d+)\s+3D-Geschosspläne/g, '$1 3D-Geschossplan');
      text = text.replace(/(\d+)\s+Digital Home Staging Fotos/g, '$1 Digital Home Staging Foto');
      text = text.replace(/(\d+)\s+Digitale Renovierungsfotos/g, '$1 Digitales Renovierungsfoto');
      text = text.replace(/Bodenperspektiven/g, 'Bodenperspektive');
    } else {
      // Plural: "Geliefert wird X ..." → "Geliefert werden X ..."
      text = text.replace(/Geliefert wird (\d+)/i, 'Geliefert werden $1');
      // Singular nouns → plural
      text = text.replace(/gerenderte Außenansicht(?!en)/g, 'gerenderte Außenansichten');
      text = text.replace(/gerenderte Innenansicht(?!en)/g, 'gerenderte Innenansichten');
      text = text.replace(/gerenderte Ansicht(?!en)/g, 'gerenderte Ansichten');
      text = text.replace(/(\d+)\s+3D-Grundriss(?!e)/g, '$1 3D-Grundrisse');
      text = text.replace(/(\d+)\s+2D-Grundriss(?!e)/g, '$1 2D-Grundrisse');
      text = text.replace(/(\d+)\s+3D-Geschossplan(?!.*ä)/g, '$1 3D-Geschosspläne');
      text = text.replace(/(\d+)\s+Digital Home Staging Foto(?!s)/g, '$1 Digital Home Staging Fotos');
      text = text.replace(/(\d+)\s+Digitales Renovierungsfoto(?!s)/g, '$1 Digitale Renovierungsfotos');
      text = text.replace(/Bodenperspektive(?!n)/g, 'Bodenperspektiven');
    }
    return text;
  };

  // Helper: update quantity numbers and singular/plural forms in already-resolved descriptions
  // Replaces any digit(s) that appear right after "Geliefert werden/wird" with the current qty,
  // and also replaces leftover {{QUANTITY}} placeholders.
  const syncQuantityInDescriptions = (items: any[], quantity: number): any[] => {
    return items.map(item => {
      if (typeof item === 'string') {
        let text = item;
        text = text.replace(/\{\{QUANTITY\}\}/g, quantity.toString());
        // Update the number after "Geliefert werden/wird"
        text = text.replace(/(Geliefert (?:werden|wird)\s+)\d+/i, `$1${quantity}`);
        // Update "Xx gerenderte" pattern (e.g. "3x gerenderte")
        text = text.replace(/\d+x\s+gerenderte/i, `${quantity}x gerenderte`);
        // Update quantity in "X 3D-Grundrisse" etc.
        text = text.replace(/\d+(\s+(?:3D-Grundriss|2D-Grundriss|3D-Geschossplan|Digital Home Staging|Digitale Renovierung))/g, `${quantity}$1`);
        text = adjustSingularPlural(text, quantity);
        return text;
      }
      let newItem = { ...item };
      if (newItem.text) {
        newItem.text = newItem.text.replace(/\{\{QUANTITY\}\}/g, quantity.toString());
        newItem.text = newItem.text.replace(/(Geliefert (?:werden|wird)\s+)\d+/i, `$1${quantity}`);
        newItem.text = newItem.text.replace(/\d+x\s+gerenderte/i, `${quantity}x gerenderte`);
        newItem.text = newItem.text.replace(/\d+(\s+(?:3D-Grundriss|2D-Grundriss|3D-Geschossplan|Digital Home Staging|Digitale Renovierung))/g, `${quantity}$1`);
        newItem.text = adjustSingularPlural(newItem.text, quantity);
      }
      if (newItem.children && newItem.children.length > 0) {
        newItem.children = syncQuantityInDescriptions(newItem.children, quantity);
      }
      return newItem;
    });
  };

  // Helper to replace placeholders like {{QUANTITY}} or {{PROJECT_NAME}} in description text
  const replacePlaceholders = (items: any[], context: { quantity: number | string, projectName: string }): any[] => {
    const qty = typeof context.quantity === 'string' ? parseInt(context.quantity) || 1 : context.quantity;
    return items.map(item => {
      // Handle string items (legacy support)
      if (typeof item === 'string') {
        let text = item;
        
        // Replace standard placeholders
        text = text.replace(/\{\{PROJECT_NAME\}\}/g, context.projectName);
        text = text.replace(/\{\{QUANTITY\}\}/g, context.quantity.toString());
        // Adjust singular/plural
        text = adjustSingularPlural(text, qty);
        
        return text;
      }
      
      // Handle object items
      let newItem = { ...item };
      if (newItem.text) {
        // Replace standard placeholders
        newItem.text = newItem.text.replace(/\{\{PROJECT_NAME\}\}/g, context.projectName);
        newItem.text = newItem.text.replace(/\{\{QUANTITY\}\}/g, context.quantity.toString());
        // Adjust singular/plural
        newItem.text = adjustSingularPlural(newItem.text, qty);
      }
      
      if (newItem.children && newItem.children.length > 0) {
        newItem.children = replacePlaceholders(newItem.children, context);
      }
      return newItem;
    });
  };

  useEffect(() => {
    loadProposalData();
  }, []);

  const loadProposalData = () => {
    // Prefer context rawProposalData (set by form page, kept in-memory across navigation)
    // Fall back to localStorage for direct URL access or page refresh
    let dataStr: string | null = null;
    const contextData = proposal.state.rawProposalData;

    let data: any;
    if (contextData) {
      data = contextData;
    } else {
      dataStr = localStorage.getItem('proposalPreviewData');
      if (!dataStr) {
        dataStr = sessionStorage.getItem('proposalPreviewData');
      }
      if (!dataStr) {
        showNotification('Keine Angebotsdaten gefunden. Bitte füllen Sie zuerst das Formular aus.', 'error');
        router.push('/');
        return;
      }
      data = JSON.parse(dataStr);
    }
    
    // Initialize modifiedDefaults for all services if not present
    if (data.services && data.services.length > 0) {
      data.services = data.services.map((service: any) => {
        const serviceInfo = findServiceInfo(service.name);
        
        if (!service.modifiedDefaults) {
          if (serviceInfo && serviceInfo.description) {
            let defaults = JSON.parse(JSON.stringify(serviceInfo.description));
            
            // AUTOMATIC PLACEHOLDER REPLACEMENT
            // Replaces XXX/xxx with quantity and "XXX"/"xxx" with project name
            defaults = replacePlaceholders(defaults, { 
                quantity: service.quantity, 
                projectName: data.projectInfo?.projectName || 'Das Projekt' 
            });

            service.modifiedDefaults = defaults;
          }
        } else {
          // modifiedDefaults already exist (from form page or localStorage) –
          // re-sync the quantity number and singular/plural forms so the
          // description always matches the current quantity.
          const qty = typeof service.quantity === 'string' ? parseInt(service.quantity) || 1 : (service.quantity || 1);
          service.modifiedDefaults = syncQuantityInDescriptions(service.modifiedDefaults, qty);
        }
        // Add pricing tiers if not present
        if (!service.pricingTiers) {
          if (serviceInfo && serviceInfo.pricingTiers) {
            service.pricingTiers = JSON.parse(JSON.stringify(serviceInfo.pricingTiers));
          }
        }
        // Dynamic pricing tiers for exterior-ground based on building type
        if (service.name === '3D-Außenvisualisierung Bodenperspektive') {
          const buildingType = data.projectInfo?.projectType;
          if (buildingType) {
            const fmt = (p: number) => p.toFixed(2).replace('.', ',');
            const priceMatrix: Record<string, number[]> = {
              'EFH': [499, 349, 299, 229, 199],
              'DHH': [599, 399, 359, 329, 299],
              'MFH-3-5': [599, 399, 359, 329, 299],
              'MFH-6-10': [699, 499, 399, 349, 329],
              'MFH-11-15': [799, 599, 499, 399, 349]
            };
            const buildingTypeLabels: Record<string, string> = {
              'EFH': 'EFH (Einfamilienhaus)',
              'DHH': 'DHH (Doppelhaushälfte)',
              'MFH-3-5': 'MFH (3-5 WE)',
              'MFH-6-10': 'MFH (6-10 WE)',
              'MFH-11-15': 'MFH (11-15 WE)'
            };
            // Auto-update sub_name with the building type label
            service.sub_name = `(${buildingTypeLabels[buildingType] || buildingType})`;
            const prices = priceMatrix[buildingType];
            if (prices) {
              service.pricingTiers = [
                { quantity: 1, price: prices[0], label: `1 Ansicht Netto: ${fmt(prices[0])} €` },
                { quantity: 2, price: prices[1], label: `2 Ansichten: Netto pro Ansicht: ${fmt(prices[1])} €` },
                { quantity: 3, price: prices[2], label: `3 Ansichten: Netto pro Ansicht: ${fmt(prices[2])} €` },
                { quantity: 4, price: prices[3], label: `4 Ansichten: Netto pro Ansicht: ${fmt(prices[3])} €` },
                { quantity: 5, price: prices[4], label: `≥5 Ansichten: Netto pro Ansicht: ${fmt(prices[4])} €` },
              ];
            }
          } else {
            service.pricingTiers = [];
          }
        }
        // Dynamic pricing tiers for exterior-bird – same building-type-based matrix as exterior-ground
        if (service.name === '3D-Außenvisualisierung Vogelperspektive') {
          const buildingType = data.projectInfo?.projectType;
          if (buildingType) {
            const fmt = (p: number) => p.toFixed(2).replace('.', ',');
            const priceMatrix: Record<string, number[]> = {
              'EFH': [499, 349, 299, 229, 199],
              'DHH': [599, 399, 359, 329, 299],
              'MFH-3-5': [599, 399, 359, 329, 299],
              'MFH-6-10': [699, 499, 399, 349, 329],
              'MFH-11-15': [799, 599, 499, 399, 349]
            };
            const buildingTypeLabels: Record<string, string> = {
              'EFH': 'EFH (Einfamilienhaus)',
              'DHH': 'DHH (Doppelhaushälfte)',
              'MFH-3-5': 'MFH (3-5 WE)',
              'MFH-6-10': 'MFH (6-10 WE)',
              'MFH-11-15': 'MFH (11-15 WE)'
            };
            // Auto-update sub_name with the building type label
            service.sub_name = `(${buildingTypeLabels[buildingType] || buildingType})`;
            const prices = priceMatrix[buildingType];
            if (prices) {
              service.pricingTiers = [
                { quantity: 1, price: prices[0], label: `1 Ansicht Netto: ${fmt(prices[0])} €` },
                { quantity: 2, price: prices[1], label: `2 Ansichten: Netto pro Ansicht: ${fmt(prices[1])} €` },
                { quantity: 3, price: prices[2], label: `3 Ansichten: Netto pro Ansicht: ${fmt(prices[2])} €` },
                { quantity: 4, price: prices[3], label: `4 Ansichten: Netto pro Ansicht: ${fmt(prices[3])} €` },
                { quantity: 5, price: prices[4], label: `≥5 Ansichten: Netto pro Ansicht: ${fmt(prices[4])} €` },
              ];
            }
          } else {
            service.pricingTiers = [];
          }
        }
        // Add link if not present
        if (!service.link) {
          if (serviceInfo && serviceInfo.link) {
            service.link = serviceInfo.link;
          }
        }
        // Add sub_name if not present
        if (!service.sub_name) {
          if (serviceInfo && (serviceInfo as any).sub_name) {
            service.sub_name = (serviceInfo as any).sub_name;
          }
        }
        return service;
      });
    }
    
    setProposalData(data);

    // Check if discount exists
    if (data.pricing?.discount && (data.pricing.discount.value || data.pricing.discount.amount)) {
      setHasDiscount(true);
      setDiscountType(data.pricing.discount.type || 'fixed');
      setDiscountValue(data.pricing.discount.value?.toString() || data.pricing.discount.amount || '0');
      setDiscountDescription(data.pricing.discount.description || 'Mengenrabatt');
    }
  };

  const updateProposalData = (updates: Partial<ProposalData>) => {
    if (!proposalData) return;
    const newData = { ...proposalData, ...updates };
    setProposalData(newData);
    // Sync to context so form page reflects changes on back-navigation
    proposal.updateRawProposalData(updates);
    // Strip terms from localStorage so footnote defaults always come from italics_data.js
    const { terms, ...dataWithoutTerms } = newData;
    localStorage.setItem('proposalPreviewData', JSON.stringify(dataWithoutTerms));
  };

  const updateService = (index: number, field: string, value: any) => {
    if (!proposalData) return;
    const newServices = [...proposalData.services];
    newServices[index] = { ...newServices[index], [field]: value };

    if (field === 'quantity') {
      // When quantity changes, look up matching tier price and set unitPrice
      const qty = parseInt(value) || 1;
      const service = newServices[index];
      const tierPrice = getTierPriceForQuantity(service.pricingTiers, qty);
      if (tierPrice !== null) {
        service.unitPrice = tierPrice.toFixed(2).replace('.', ',');
      }
      const newPricing = computePricing(newServices);
      updateProposalData({ services: newServices, pricing: newPricing });
    } else if (field === 'unitPrice') {
      const newPricing = computePricing(newServices);
      updateProposalData({ services: newServices, pricing: newPricing });
    } else {
      updateProposalData({ services: newServices });
    }
  };

  const updateBulletPoint = (serviceIndex: number, bulletPath: string, newText: string) => {
    if (!proposalData) return;
    const newServices = [...proposalData.services];
    const service = newServices[serviceIndex];
    const serviceInfo = findServiceInfo(service.name);
    
    const pathParts = bulletPath.split('-');
    const isDefault = pathParts[0] === 'default';
    
    if (isDefault) {
      if (!service.modifiedDefaults) {
        service.modifiedDefaults = JSON.parse(JSON.stringify(serviceInfo?.description || []));
      }
      const indices = pathParts.slice(1).map(Number);
      let target: any = service.modifiedDefaults;
      
      // Navigate to the target location
      for (let i = 0; i < indices.length - 1; i++) {
        if (typeof target[indices[i]] === 'object' && target[indices[i]].children) {
          target = target[indices[i]].children;
        } else {
          // Create path if it doesn't exist
          console.warn('Path navigation failed at index', i);
          return;
        }
      }
      
      // Update the final target
      const finalIndex = indices[indices.length - 1];
      if (typeof target[finalIndex] === 'object' && target[finalIndex].text !== undefined) {
        target[finalIndex].text = newText;
      } else if (typeof target[finalIndex] === 'string') {
        target[finalIndex] = newText;
      }
    }
    
    updateProposalData({ services: newServices });
  };

  const addBulletPoint = (serviceIndex: number) => {
    setBulletModalServiceIndex(serviceIndex);
    setBulletInputText('');
    setShowBulletModal(true);
  };

  const parseBulletText = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const result: any[] = [];
    const stack: any[] = [{ children: result, level: -1 }];

    lines.forEach(line => {
      // Count leading dashes
      const match = line.match(/^(-+)\s*(.+)$/);
      if (!match) {
        // No dashes, treat as level 0
        const item = line.trim();
        if (item) {
          stack[0].children.push(item);
        }
        return;
      }

      const dashes = match[1].length;
      const text = match[2].trim();
      const level = dashes - 1; // 1 dash = level 0, 2 dashes = level 1, etc.

      // Pop stack until we find the right parent level
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      
      if (level > 3) {
        // Max 3 levels of nesting (0, 1, 2, 3)
        console.warn('Maximum nesting level is 3, ignoring deeper levels');
        return;
      }

      const newItem: any = { text, children: [] };
      parent.children.push(newItem);
      stack.push({ children: newItem.children, level });
    });

    // Clean up empty children arrays
    const cleanItem = (item: any): any => {
      if (typeof item === 'string') return item;
      if (item.children && item.children.length > 0) {
        item.children = item.children.map(cleanItem);
        return item;
      } else {
        return item.text;
      }
    };

    return result.map(cleanItem);
  };

  const handleAddBullets = () => {
    if (bulletModalServiceIndex === null || !proposalData) return;
    
    const parsed = parseBulletText(bulletInputText);
    if (parsed.length === 0) {
      showNotification('Bitte mindestens einen Aufzählungspunkt eingeben', 'error');
      return;
    }

    const newServices = [...proposalData.services];
    const service = newServices[bulletModalServiceIndex];
    const serviceInfo = findServiceInfo(service.name);
    
    // Initialize modifiedDefaults from service defaults if not present
    if (!service.modifiedDefaults) {
      service.modifiedDefaults = JSON.parse(JSON.stringify(serviceInfo?.description || []));
    }

    // Add parsed bullets
    service.modifiedDefaults.push(...parsed);
    updateProposalData({ services: newServices });
    
    // Close modal
    setShowBulletModal(false);
    setBulletModalServiceIndex(null);
    setBulletInputText('');
  };

  const addSubBullet = (serviceIndex: number, bulletPath: string, currentLevel: number) => {
    if (currentLevel >= 3) {
      showNotification('Maximale Verschachtelungstiefe (3) erreicht.', 'error');
      return;
    }
    if (!proposalData) return;

    const newServices = [...proposalData.services];
    const service = newServices[serviceIndex];
    
    const pathParts = bulletPath.split('-');
    const isDefault = pathParts[0] === 'default';
    const isCustom = pathParts[0] === 'custom';
    
    if (isDefault) {
      // Copy defaults to modifiedDefaults if not already done
      if (!service.modifiedDefaults) {
        const serviceInfo = findServiceInfo(service.name);
        service.modifiedDefaults = JSON.parse(JSON.stringify(serviceInfo?.description || []));
      }
      
      const indices = pathParts.slice(1).map(Number);
      let target: any = service.modifiedDefaults;
      
      // Navigate to the parent bullet
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        
        if (i === indices.length - 1) {
          // This is the target bullet
          if (typeof target[idx] === 'string') {
            target[idx] = {
              text: target[idx],
              children: ['New sub-point']
            };
          } else if (target[idx].children) {
            target[idx].children.push('New sub-point');
          } else {
            target[idx].children = ['New sub-point'];
          }
        } else {
          // Navigate deeper
          if (typeof target[idx] === 'object' && target[idx].children) {
            target = target[idx].children;
          }
        }
      }
    }
    
    updateProposalData({ services: newServices });
  };

  const findServiceInfo = (serviceName: string): ServiceDescription | null => {
    for (const [key, value] of Object.entries(serviceDescriptions)) {
      if ((value as any).name === serviceName) {
        return value as ServiceDescription;
      }
    }
    return null;
  };

  const deleteBulletPoint = (serviceIndex: number, bulletPath: string) => {
    if (!confirm('Diesen Aufzählungspunkt löschen?')) return;
    if (!proposalData) return;
    
    const newServices = [...proposalData.services];
    const service = newServices[serviceIndex];
    
    const pathParts = bulletPath.split('-');
    const isDefault = pathParts[0] === 'default';
    const isCustom = pathParts[0] === 'custom';
    
    if (isDefault) {
      if (!service.modifiedDefaults) {
        service.modifiedDefaults = JSON.parse(JSON.stringify(service.customDescription || []));
      }
      const indices = pathParts.slice(1).map(Number);
      
      if (indices.length === 1) {
        // Top level deletion
        service.modifiedDefaults.splice(indices[0], 1);
      } else {
        // Nested deletion
        let target: any = service.modifiedDefaults;
        for (let i = 0; i < indices.length - 1; i++) {
          if (typeof target[indices[i]] === 'object' && target[indices[i]].children) {
            if (i === indices.length - 2) {
              // We're at the parent of the item to delete
              target[indices[i]].children.splice(indices[indices.length - 1], 1);
              if (target[indices[i]].children.length === 0) {
                // Remove children array if empty
                delete target[indices[i]].children;
              }
              break;
            } else {
              target = target[indices[i]].children;
            }
          }
        }
      }
    }
    
    updateProposalData({ services: newServices });
  };

  const computePricing = (servicesData: any[]) => {
    let subtotal = 0;
    servicesData.forEach((service: any) => {
      const qty = parseInt(service.quantity) || 0;
      const price = parseFloat(service.unitPrice?.toString().replace(',', '.')) || 0;
      subtotal += qty * price;
    });

    let discountAmount = 0;
    if (hasDiscount && discountValue) {
      const value = parseFloat(discountValue.replace(',', '.'));
      if (discountType === 'percentage') {
        discountAmount = subtotal * (value / 100);
      } else {
        discountAmount = value;
      }
    }

    const totalNet = subtotal - discountAmount;
    const totalVat = totalNet * 0.19;
    const totalGross = totalNet + totalVat;
    const fmt = (val: number) => val.toFixed(2).replace('.', ',');

    const pricing: any = {
      ...(proposalData?.pricing || {}),
      subtotalNet: fmt(subtotal),
      totalNetPrice: fmt(totalNet),
      totalVat: fmt(totalVat),
      totalGrossPrice: fmt(totalGross),
    };
    if (hasDiscount) {
      pricing.discount = {
        type: discountType,
        value: discountValue,
        amount: fmt(discountAmount),
        description: discountDescription,
      };
    }
    return pricing;
  };

  const recalculateTotals = (services?: any[]) => {
    if (!proposalData) return;
    const servicesData = services || proposalData.services;
    const newPricing = computePricing(servicesData);
    updateProposalData({ pricing: newPricing });
  };

  useEffect(() => {
    if (proposalData && hasDiscount) {
      recalculateTotals();
    }
  }, [discountType, discountValue, hasDiscount, discountDescription]);

  // Helper: find the matching tier price for a given quantity
  const getTierPriceForQuantity = (tiers: any[], qty: number): number | null => {
    if (!tiers || tiers.length === 0) return null;
    // Find exact match or the last tier whose quantity <= qty (tiered pricing)
    let matched = tiers[tiers.length - 1]; // default to highest tier
    for (const tier of tiers) {
      if (tier.quantity === qty) { matched = tier; break; }
      if (tier.quantity <= qty) matched = tier;
    }
    return matched?.price ?? null;
  };

  // Helper: rebuild a tier label from its quantity and price
  const rebuildTierLabel = (tier: any, allTiers: any[], tierIndex: number): string => {
    const fmt = (p: number) => p.toFixed(2).replace('.', ',');
    const isLast = tierIndex === allTiers.length - 1;
    const prefix = isLast && allTiers.length > 1 ? '≥' : '';
    if (tier.quantity === 1) {
      return `1 Ansicht Netto: ${fmt(tier.price)} €`;
    }
    return `${prefix}${tier.quantity} Ansichten: Netto pro Ansicht: ${fmt(tier.price)} €`;
  };

  // Update a specific tier's price and sync unitPrice if needed
  const updateTierPrice = (serviceIndex: number, tierIndex: number, newPrice: number) => {
    if (!proposalData) return;
    const newServices = [...proposalData.services];
    const service = { ...newServices[serviceIndex] };
    const tiers = [...(service.pricingTiers || [])];
    tiers[tierIndex] = { ...tiers[tierIndex], price: newPrice };
    tiers[tierIndex].label = rebuildTierLabel(tiers[tierIndex], tiers, tierIndex);
    service.pricingTiers = tiers;

    // If the current quantity matches this tier, update unitPrice
    const qty = parseInt(service.quantity) || 1;
    const matchedPrice = getTierPriceForQuantity(tiers, qty);
    if (matchedPrice !== null) {
      service.unitPrice = matchedPrice.toFixed(2).replace('.', ',');
    }

    newServices[serviceIndex] = service;
    const newPricing = computePricing(newServices);
    updateProposalData({ services: newServices, pricing: newPricing });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatPrice = (value: number) => {
    return value.toFixed(2).replace('.', ',') + ' €';
  };

  const calculatePercentageDiscount = () => {
    if (!proposalData) return '0,00';
    const subtotalText = proposalData.pricing.subtotalNet || '0';
    const subtotal = parseFloat(subtotalText.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    
    const percentage = parseFloat(discountValue.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    
    const discountAmount = (subtotal * percentage / 100);
    return discountAmount.toFixed(2).replace('.', ',');
  };

  const handleGenerateProposal = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(proposalData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Angebot erfolgreich erstellt!\n\nAngebotsnummer: ${result.offerNumber}\nKunde: ${result.clientName}\nGesamt: ${result.totalAmount} €`);
        
        if (result.fileUrl) {
          // Use a hidden link to trigger download instead of window.open
          const a = document.createElement('a');
          a.href = result.fileUrl;
          a.download = result.filename?.split('/').pop() || 'Angebot.docx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        throw new Error(result.error || 'Failed to generate proposal');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(`❌ Fehler beim Erstellen des Angebots:\n${error.message}\n\nStellen Sie sicher, dass der Server läuft.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addDiscount = () => {
    if (hasDiscount) {
      showNotification('Rabatt bereits hinzugefügt. Bitte bearbeiten Sie den bestehenden Rabatt.', 'info');
      return;
    }
    setHasDiscount(true);
    recalculateTotals();
  };

  const removeDiscount = () => {
    setHasDiscount(false);
    setDiscountValue('0');
    if (proposalData) {
      const newData = { ...proposalData };
      delete newData.pricing.discount;
      setProposalData(newData);
      localStorage.setItem('proposalPreviewData', JSON.stringify(newData));
      recalculateTotals();
    }
  };

  const handleEditableBlur = (path: string, e: React.FocusEvent<HTMLSpanElement>) => {
    const newValue = e.currentTarget.textContent || '';
    const pathParts = path.split('.');
    
    if (!proposalData) return;
    
    const newData = { ...proposalData };
    let target: any = newData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!target[pathParts[i]]) target[pathParts[i]] = {};
      target = target[pathParts[i]];
    }
    
    target[pathParts[pathParts.length - 1]] = newValue;
    setProposalData(newData);
    localStorage.setItem('proposalPreviewData', JSON.stringify(newData));
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };

  if (!proposalData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-700 text-lg italic">Angebotsdaten werden geladen...</div>
      </div>
    );
  }

  const offerNumber = `2026-${proposalData.projectInfo.MM}-${proposalData.projectInfo.DD}-8`;

  // Determine if virtual tour is included (for conditional footnote text)
  const hasVirtualTour = proposalData.services?.some((s: any) => s.name?.includes('360° Tour'));

  // Recursive bullet renderer component (Display Only)
  // Level 0 → ● (list-disc), Level 1 → ○ (list-[circle]), Level 2+ → ▪ (list-[square])
  const BulletItem = ({ item, level }: any) => {
    const text = typeof item === 'string' ? item : item.text;
    const children = typeof item === 'object' ? item.children : null;
    // Style for the <ul> wrapping children is based on the child level (level + 1)
    const childListStyleClass =
      level === 0 ? 'list-[circle]' :
      'list-[square]';

    return (
      <li className="mb-0.5 leading-tight">
        <span className="px-0.5 inline text-inherit">
          {text}
        </span>
        {children && children.length > 0 && (
          <ul className={`${childListStyleClass} ml-5 mt-0.5`}>
            {children.map((child: any, i: number) => (
              <BulletItem
                key={i}
                item={child}
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      {/* Preview Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 flex justify-between items-center shadow-lg z-50">
        <h1 className="text-white text-xl font-semibold">📄 Angebotsvorschau</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-white/20 text-white rounded-md text-sm font-semibold hover:bg-white/30 transition-colors"
          >
            ← Zurück zum Formular
          </button>
          <button
            onClick={handleGenerateProposal}
            disabled={isGenerating}
            className="px-6 py-2.5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isGenerating ? '⏳ Wird erstellt...' : '📄 DOCX erstellen'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-20 pb-10 px-0 w-[210mm] max-w-full">
        <div className="text-xs text-gray-600 italic mb-4 text-center">
          💡 Klicken Sie auf einen Text, um ihn zu bearbeiten. Änderungen werden automatisch gespeichert.
        </div>
        {/* Page 1: Cover */}
        <div className="w-full min-h-[1122px] bg-white shadow-lg border border-gray-300 p-24 mb-10 flex flex-col relative">
          <div className="flex-1 pb-24">
            {/* Logo */}
            <div className="flex justify-end mb-6">
              <div className="text-xl font-bold text-slate-800">ExposeProfi.de</div>
            </div>

            {/* Header */}
            <div className="text-[11pt] text-[#022e64] mb-2 font-medium">
              ExposeProfi.de | EPCS GmbH | Bruder-Klaus-Straße 3a | 78467 Konstanz
            </div>

            {/* Recipient Address */}
            <div className="mt-4 mb-6 text-[11pt] leading-normal text-gray-900">
              <div className="font-bold text-gray-900">{proposalData.clientInfo.companyName}</div>
              <div className="text-gray-900">{proposalData.clientInfo.street}</div>
              <div className="text-gray-900">{proposalData.clientInfo.postalCode} {proposalData.clientInfo.city}</div>
              <div className="text-gray-900">{proposalData.clientInfo.country}</div>
            </div>

            {/* Date */}
            <div className="mb-8 text-right text-[11pt] text-gray-900">
              {proposalData.projectInfo.date}
            </div>

            {/* Offer Number */}
            <div className="font-bold text-[16pt] mb-4 text-gray-900">
              Angebot Nr. {offerNumber}
            </div>

            {/* Introduction */}
            <div className="text-justify mb-3 text-[11pt] text-gray-900">
              Vielen Dank für Ihre Anfrage und Ihr damit verbundenes Interesse an einer Zusammenarbeit.
            </div>

            <div className="text-justify mb-3 text-[11pt] text-gray-900">
              <strong className="text-gray-900">Die Vorteile zusammengefasst, die Sie erwarten können:</strong>
            </div>

            {/* Benefits List */}
            <div className="my-7 text-[12pt] leading-relaxed text-gray-900">
              <div className="mb-2 text-justify">
                <strong className="text-gray-900">1. Fotorealismus:</strong> Wir erstellen ausschließlich emotionale 3D-Visualisierungen der höchsten Qualitätsstufe.
              </div>
              <div className="mb-2 text-justify">
                <strong className="text-gray-900">2. Persönliche & individuelle Betreuung:</strong> Sie erhalten bei jedem Projekt die Unterstützung von einem persönlichen Ansprechpartner, der die Visualisierungen individuell für Sie erstellt und immer per Telefon oder Email erreichbar ist.
              </div>
              <div className="mb-2 text-justify">
                <strong className="text-gray-900">3. Effiziente Prozesse & schnelle Lieferzeit:</strong> Wie Sie sehen, melden wir uns innerhalb von 24h mit einem Angebot bei Ihnen. Ihr Projekt verläuft ab Start ebenso reibungslos und Sie erhalten die Visualisierungen schnellstmöglich.
              </div>
              <div className="mb-2 text-justify">
                <strong className="text-gray-900">4. Korrekturschleifen:</strong> Falls Sie Änderungswünsche haben, bieten wir Ihnen ein eigenes Tool, mit dem Sie direkt in der Visualisierung Kommentare hinterlassen können. Das spart Zeit und Missverständnisse.
              </div>
              <div className="mb-2 text-justify">
                <strong className="text-gray-900">5. Preiswert:</strong> Aufgrund effizienter Prozesse bieten wir günstigere Preise bei gleicher Qualität und besserer Betreuung.
              </div>
            </div>
          </div>

          {/* Footer */}
          <PageFooter />
        </div>

        {/* Page 2: Services Table */}
        <div className="w-full min-h-[1122px] bg-white shadow-lg border border-gray-300 p-24 mb-10 flex flex-col relative">
          <div className="flex-1 pb-24">
            <div className="mb-4 text-[10pt] leading-normal text-gray-900">
              <strong className="text-gray-900">Basierend auf den zugesandten Unterlagen unterbreiten wir Ihnen folgendes Angebot:</strong>
            </div>

            {/* Services Table */}
            <table className="w-full border-collapse mb-6 text-[9pt] table-fixed">
              <thead>
                <tr>
                  <th className="border border-gray-800 p-1.5 text-center bg-gray-100 font-bold text-gray-900 w-[8%]">Anz.</th>
                  <th className="border border-gray-800 p-1.5 text-center bg-gray-100 font-bold text-gray-900 w-[22%]">Bezeichnung</th>
                  <th className="border border-gray-800 p-1.5 text-center bg-gray-100 font-bold text-gray-900 w-[55%]">Beschreibung</th>
                  <th className="border border-gray-800 p-1.5 text-center bg-gray-100 font-bold text-gray-900 w-[15%]">Stückpreis netto</th>
                </tr>
              </thead>
              <tbody>
                {proposalData.services.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-gray-800 p-4 text-center text-gray-600 italic">
                      Keine Dienste ausgewählt.
                    </td>
                  </tr>
                ) : (
                  proposalData.services.flatMap((service: any, index: number) => {
                    const serviceInfo = findServiceInfo(service);
                    const rows = [];
                    
                    // Main service row
                    rows.push(
                      <tr key={`service-${index}`}>
                        <td className="border border-gray-800 p-1.5 text-center align-top text-gray-900">
                          <span
                            key={`qty-${index}-${service.quantity}`}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newQty = parseInt(e.currentTarget.textContent || '0');
                              updateService(index, 'quantity', newQty);
                            }}
                            onKeyDown={handleEnterKey}
                            className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                          >
                            {service.quantity}
                          </span>
                        </td>
                        <td className="border border-gray-800 p-1.5 align-top text-gray-900">
                          <span
                            key={`name-${index}-${service.name}`}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => updateService(index, 'name', e.currentTarget.textContent || '')}
                            onKeyDown={handleEnterKey}
                            className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                          >
                            {service.name}
                          </span>
                          {service.sub_name && (
                            <div className="mt-0.5">
                              <span
                                key={`subname-${index}-${service.sub_name}`}
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => updateService(index, 'sub_name', e.currentTarget.textContent || '')}
                                onKeyDown={handleEnterKey}
                                className="text-xs text-gray-600 italic cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                              >
                                {service.sub_name}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-800 p-1.5 align-top text-gray-900">
                          {(() => {
                            // Use modifiedDefaults if available, otherwise use serviceInfo defaults
                            const descriptions = service.modifiedDefaults || (serviceInfo?.description || []);
                            
                            if (editingServiceIndex === index) {
                                return (
                                    <div className="flex flex-col gap-2 min-w-[300px]">
                                        <textarea
                                            value={bulkEditText}
                                            onChange={(e) => setBulkEditText(e.target.value)}
                                            className="w-full h-[300px] p-2 text-xs font-mono border border-blue-500 rounded bg-white shadow-lg z-10 text-gray-900"
                                            autoFocus
                                            placeholder="- Hauptpunkt&#10;-- Unterpunkt&#10;--- Unter-Unterpunkt"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={saveBulkEdit} 
                                                className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600"
                                            >
                                                Speichern
                                            </button>
                                            <button 
                                                onClick={() => setEditingServiceIndex(null)} 
                                                className="bg-gray-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-600"
                                            >
                                                Abbrechen
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            if (!descriptions || descriptions.length === 0) {
                              return (
                                <span 
                                    className="text-gray-400 italic cursor-pointer hover:text-gray-600"
                                    onClick={() => startBulkEdit(index, [])}
                                >
                                    Keine Beschreibung. Klicken zum Hinzufügen.
                                </span>
                              );
                            }
                            
                            return (
                              <div 
                                onClick={(e) => {
                                    startBulkEdit(index, descriptions);
                                }}
                                className="cursor-pointer hover:bg-yellow-50 p-1 -m-1 rounded transition-colors relative group"
                                title="Klicken zum Bearbeiten der Beschreibung"
                              >
                                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-blue-100 text-blue-800 text-[9px] px-1 rounded border border-blue-200 pointer-events-none z-10">
                                    ✎ Text bearbeiten
                                </div>
                                <ul className="list-disc ml-3.5 my-1 pointer-events-none">
                                  {descriptions.map((desc: any, i: number) => (
                                    <BulletItem
                                      key={i}
                                      item={desc}
                                      serviceIndex={index}
                                      bulletPath={`view-${i}`} 
                                      level={0}
                                      onUpdate={() => {}}
                                      onDelete={() => {}}
                                      onAddSub={() => {}}
                                    />
                                  ))}
                                  {service.link && (
                                    <li className="mb-0.5 leading-tight">
                                      <span className="px-0.5 inline">
                                        <strong>Referenzen: </strong>
                                        <a href={service.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline pointer-events-auto">KLICK</a>
                                      </span>
                                    </li>
                                  )}
                                </ul>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="border border-gray-800 p-1.5 text-center align-top text-gray-900">
                          <span
                            key={`price-${index}-${service.unitPrice}`}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const newPrice = e.currentTarget.textContent?.replace(',', '.') || '0';
                              updateService(index, 'unitPrice', newPrice);
                            }}
                            onKeyDown={handleEnterKey}
                            className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                          >
                            {service.unitPrice}
                          </span>
                          {' €'}
                        </td>
                      </tr>
                    );

                    // Add pricing tiers if available
                    if (service.pricingTiers && service.pricingTiers.length > 0) {
                      // Title row
                      rows.push(
                        <tr key={`tier-title-${index}`} className="text-gray-900 ">
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                          <td className="border border-gray-800 p-1.5 text-[9pt]">
                            Preisstaffelung:
                          </td>
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                        </tr>
                      );
                      
                      // Tier rows
                      service.pricingTiers.forEach((tier: any, tierIndex: number) => {
                        // Split label into text prefix and editable price
                        const priceMatch = tier.label?.match(/^(.+?)\s*(\d+[.,]\d{2})\s*€$/);
                        rows.push(
                          <tr key={`tier-${index}-${tierIndex}-${tier.price}`} className="bg-gray-50">
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 pl-5 text-[8.5pt] text-gray-900">
                              {priceMatch ? (
                                <>
                                  {priceMatch[1]}{' '}
                                  <span
                                    key={`tierprice-${index}-${tierIndex}-${tier.price}`}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={(e) => {
                                      const raw = e.currentTarget.textContent?.replace(',', '.') || '0';
                                      const parsed = parseFloat(raw);
                                      if (!isNaN(parsed)) updateTierPrice(index, tierIndex, parsed);
                                    }}
                                    onKeyDown={handleEnterKey}
                                    className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                                  >
                                    {priceMatch[2]}
                                  </span>
                                  {' €'}
                                </>
                              ) : tier.label}
                            </td>
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                          </tr>
                        );
                      });
                    }
                    
                    return rows;
                  })
                )}
              </tbody>
            </table>
            <div className="text-[8.5pt] text-gray-600 italic mt-2">
              💡 Klicken Sie auf Mengen, Namen, Beschreibungen oder Preise, um sie zu bearbeiten
            </div>
          </div>

          {/* Footer */}
          <PageFooter />
        </div>

        {/* Page 3: Perspective Images (if any) */}
        {proposalData.images && proposalData.images.length > 0 && (
          <div className="w-full min-h-[1122px] bg-white shadow-lg border border-gray-300 p-24 mb-10 flex flex-col relative">
            <div className="flex-1 pb-24">
              <div className="font-bold mb-2 text-[11pt] text-gray-900">Perspektivbilder</div>
              {proposalData.images.map((image: any, index: number) => (
                <div key={index} className="mb-8">
                  {image.title && (
                    <div className="font-bold text-[11pt] mb-2 text-gray-900">
                      {image.title}
                    </div>
                  )}
                  {image.description && (
                    <div className="text-[10pt] mb-3 text-justify leading-normal text-gray-900">
                      {image.description}
                    </div>
                  )}
                  {image.imageData && (
                    <div className="mx-auto block w-fit p-4 border-2 border-black">
                      <img
                        src={image.imageData}
                        alt={image.title || `Perspective ${index + 1}`}
                        className="max-w-[400px] w-auto h-auto object-contain"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <PageFooter />
          </div>
        )}

        {/* Page 4: Pricing Summary */}
        <div className="w-full min-h-[1122px] bg-white shadow-lg border border-gray-300 p-24 mb-10 flex flex-col relative">
          <div className="flex-1 pb-24">
            <div className="font-bold mb-2 text-[11pt] text-gray-900">Zusammenfassung:</div>
            
            <table className="w-full border-collapse mt-4 text-gray-900">
              <tbody>
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 w-[70%] text-gray-900">
                    <strong>Zwischensumme (Netto)</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 w-[30%] text-center text-gray-900">
                    <strong>
                      <span
                        key={`subtotal-${proposalData.pricing.subtotalNet}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditableBlur('pricing.subtotalNet', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                      >
                        {proposalData.pricing.subtotalNet}
                      </span> €
                    </strong>
                  </td>
                </tr>
                
                {hasDiscount && (
                  <tr className="border border-gray-800 bg-yellow-50">
                    <td className="border border-gray-800 p-1.5 text-gray-900">
                      <strong>
                        Rabatt: <span
                          key={`disc-desc-${discountDescription}`}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newDesc = e.currentTarget.textContent || 'Mengenrabatt';
                            setDiscountDescription(newDesc);
                          }}
                          onKeyDown={handleEnterKey}
                          className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                        >
                          {discountDescription}
                        </span>
                      </strong>
                    </td>
                    <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                      <strong className="text-amber-700">
                        <select
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                          className="px-2 py-1 mr-2 border border-gray-300 rounded text-gray-900 bg-white"
                        >
                          <option value="fixed">EUR</option>
                          <option value="percentage">%</option>
                        </select>
                        - <span
                          key={`disc-val-${discountValue}`}
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newValue = e.currentTarget.textContent || '0';
                            setDiscountValue(newValue);
                          }}
                          onKeyDown={handleEnterKey}
                          className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                        >
                          {discountValue}
                        </span>
                        {discountType === 'percentage' ? '% ' : ' €'}
                        {discountType === 'percentage' && (
                          <span className="text-gray-600 text-[9pt] ml-1">
                            ({calculatePercentageDiscount()} €)
                          </span>
                        )}
                        <button
                          onClick={removeDiscount}
                          className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                        >
                          Entfernen
                        </button>
                      </strong>
                    </td>
                  </tr>
                )}
                
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 text-gray-900">
                    <strong>Summe (Netto)</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                    <strong>
                      <span
                        key={`totalnet-${proposalData.pricing.totalNetPrice}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditableBlur('pricing.totalNetPrice', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                      >
                        {proposalData.pricing.totalNetPrice}
                      </span> €
                    </strong>
                  </td>
                </tr>
                
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 text-gray-900">
                    <strong>MwSt. (19%)</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                    <strong>
                      <span
                        key={`vat-${proposalData.pricing.totalVat}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditableBlur('pricing.totalVat', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                      >
                        {proposalData.pricing.totalVat}
                      </span> €
                    </strong>
                  </td>
                </tr>
                
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 text-gray-900">
                    <strong>Gesamtbruttopreis</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                    <strong>
                      <span
                        key={`gross-${proposalData.pricing.totalGrossPrice}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => handleEditableBlur('pricing.totalGrossPrice', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                      >
                        {proposalData.pricing.totalGrossPrice}
                      </span> €
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {!hasDiscount && (
              <button
                onClick={addDiscount}
                className="mt-2.5 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 text-sm"
              >
                + Rabatt hinzufügen
              </button>
            )}

            <p className="mt-8 mb-5 text-gray-900">
              <strong>
                <span
                  key={`validuntiltext-${proposalData.terms?.validUntilText}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.validUntilText', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.validUntilText || 'Dieses Angebot ist gültig bis:'}
                </span>{' '}
                <span
                  key={`offervalid-${proposalData.projectInfo.offerValidUntil}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('projectInfo.offerValidUntil', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                >
                  {formatDate(proposalData.projectInfo.offerValidUntil)}
                </span>
              </strong>
            </p>

            {/* Delivery and Terms */}
            <div className="mb-5 text-gray-900">
              <p className="mb-2">
                <strong>Lieferweg:</strong>{' '}
                <span
                  key={`deliverymethod-${proposalData.terms?.deliveryMethod}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryMethod', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryMethod || 'Digital via Email'}
                </span>
              </p>
              <p className="mb-2">
                <strong>Voraussichtl. Leistungsdatum:</strong>{' '}
                <span
                  key={`deliverytime-${proposalData.projectInfo.deliveryTime}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handleEditableBlur('projectInfo.deliveryTime', e);
                  }}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                >
                  {proposalData.projectInfo.deliveryTime || '4-6'}
                </span>
                {' Arbeitstage '}
                <span
                  key={`deliverydaystext-${proposalData.pricing?.totalNetPrice}`}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryDaysText', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryDaysText || (() => {
                    const netStr = proposalData.pricing?.totalNetPrice || '0';
                    const netNum = parseFloat(netStr.replace(/\./g, '').replace(',', '.')) || 0;
                    if (netNum > 2000) {
                      const grossStr = proposalData.pricing?.totalGrossPrice || '0';
                      const grossNum = parseFloat(grossStr.replace(/\./g, '').replace(',', '.')) || 0;
                      const halfAmount = (grossNum * 0.5).toFixed(2).replace('.', ',');
                      return `nach Eingang der Anzahlung i.H.v. 50% des Bruttopreises (${halfAmount} EUR) und Erhalt aller Unterlagen und Informationen`;
                    }
                    return 'nach Auftragseingang und Erhalt aller Unterlagen und Informationen';
                  })()}
                </span>
              </p>
            </div>

            <p className="mb-5 italic text-gray-900">
              <span
                key={`closinggreeting-${proposalData.terms?.closingGreeting}`}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditableBlur('terms.closingGreeting', e)}
                onKeyDown={handleEnterKey}
                className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
              >
                {proposalData.terms?.closingGreeting || 'Mit freundlichen Grüßen'}
              </span>
              <br />
              <span
                key={`signame-${proposalData.signature.signatureName}`}
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditableBlur('signature.signatureName', e)}
                onKeyDown={handleEnterKey}
                className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
              >
                {proposalData.signature.signatureName}
              </span>
            </p>

            {/* Footnotes – matching original template */}
            <div className="text-[8.5pt] mt-4 leading-normal text-gray-900 italic">
              <p>
                <span
                  key="p_one"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_one', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_one || italicData.p_one}
                </span>
              </p>
              <p>
                <span
                  key="p_two"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_two', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_two || italicData.p_two}
                </span>
              </p>
              <p>
                <span
                  key="p_three"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_three', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_three || (hasVirtualTour ? italicData.p_three : '')}
                </span>
              </p>
              <p>
                <span
                  key="p_four"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_four', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_four || italicData.p_four}
                </span>
              </p>
              <p>
                <span
                  key="p_five"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_five', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_five || italicData.p_five}
                </span>
              </p>
              <p>
                <span
                  key="p_six"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_six', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_six || italicData.p_six}
                </span>
              </p>
              <p>
                <span
                  key="p_seven"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_seven', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_seven || italicData.p_seven}
                </span>
              </p>
              <p>
                <span
                  key="p_eight"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_eight', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.p_eight || italicData.p_eight}
                </span>
              </p>
            </div>
            <div className="text-[8.5pt] text-gray-600 italic mt-4">
              💡 Klicken Sie auf Preiswerte, um sie zu bearbeiten
            </div>
          </div>

          {/* Footer */}
          <PageFooter />
        </div>
      </div>

      {/* Bullet Point Modal */}
      {showBulletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-800 to-slate-700">
              <h3 className="text-xl font-semibold text-white">Aufzählungspunkte hinzufügen</h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  Geben Sie die Aufzählungspunkte mit folgender Syntax ein:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">-</code> Hauptpunkt</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">--</code> Unterpunkt (Ebene 1)</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">---</code> Unter-Unterpunkt (Ebene 2)</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">----</code> Ebene 3 (max. Tiefe)</li>
                </ul>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Beispiel:</p>
                  <pre className="text-blue-800 font-mono text-xs whitespace-pre-wrap">
{`- Erster Hauptpunkt
-- Unterpunkt
--- Unter-Unterpunkt
-- Weiterer Unterpunkt
- Zweiter Hauptpunkt
-- Sein Unterpunkt`}
                  </pre>
                </div>
              </div>

              <textarea
                value={bulletInputText}
                onChange={(e) => setBulletInputText(e.target.value)}
                placeholder="- Aufzählungspunkte hier eingeben&#10;-- Unterpunkte mit doppeltem Strich&#10;--- Unter-Unterpunkte mit dreifachem Strich"
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Tipp: Jede Zeile wird ein eigener Aufzählungspunkt. Verwenden Sie Striche, um die Verschachtelungsebene anzugeben.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowBulletModal(false);
                  setBulletModalServiceIndex(null);
                  setBulletInputText('');
                }}
                className="px-5 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddBullets}
                className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageFooter() {
  return (
    <div className="absolute bottom-12 left-24 right-24 pt-2 flex justify-between text-[7pt] leading-tight text-gray-800">
      <div className="flex-1 mr-3">
        <p className="font-bold text-[8pt] mb-0.5 text-gray-900">ExposeProfi.de</p>
        <p>EPCS GmbH</p>
        <p>GF: Christopher Helm</p>
        <p>Bruder-Klaus-Str. 3a, 78467 Konstanz</p>
        <p>HRB 725172, Amtsgericht Freiburg</p>
        <p>St.-Nr: 0908011277</p>
        <p>USt-ID: DE347265281</p>
      </div>

      <div className="flex-1 mr-3">
        <p className="font-bold text-[8pt] mb-0.5 text-gray-900">Bankverbindung</p>
        <p>Qonto (Banque de France)</p>
        <p>IBAN DE62100101239488471916</p>
      </div>

      <div className="flex-1">
        <p>Email: christopher.helm@exposeprofi.de</p>
        <p>Web: www.exposeprofi.de</p>
        <p>Tel: +49-7531-1227491</p>
      </div>
    </div>
  );
}
