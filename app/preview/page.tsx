'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/contexts/NotificationContext';
import serviceDescriptions from '@/lib/service_description';

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
  defaultPrice?: number;
  description: any[];
  pricingTiers?: Array<{ quantity: number; price: number; label: string }>;
  link?: string;
}

export default function PreviewPage() {
  const router = useRouter();
  const { showNotification } = useNotification();
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

  // Helper to replace placeholders like {{QUANTITY}} or {{PROJECT_NAME}} in description text
  const replacePlaceholders = (items: any[], context: { quantity: number | string, projectName: string }): any[] => {
    return items.map(item => {
      // Handle string items (legacy support)
      if (typeof item === 'string') {
        let text = item;
        
        // Replace standard placeholders
        text = text.replace(/\{\{PROJECT_NAME\}\}/g, context.projectName);
        text = text.replace(/\{\{QUANTITY\}\}/g, context.quantity.toString());
        
        return text;
      }
      
      // Handle object items
      let newItem = { ...item };
      if (newItem.text) {
        // Replace standard placeholders
        newItem.text = newItem.text.replace(/\{\{PROJECT_NAME\}\}/g, context.projectName);
        newItem.text = newItem.text.replace(/\{\{QUANTITY\}\}/g, context.quantity.toString());
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
    let dataStr = localStorage.getItem('proposalPreviewData');
    if (!dataStr) {
      dataStr = sessionStorage.getItem('proposalPreviewData');
    }

    if (!dataStr) {
      showNotification('No proposal data found. Please fill out the form first.', 'error');
      router.push('/');
      return;
    }

    const data = JSON.parse(dataStr);
    
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
        }
        // Add pricing tiers if not present
        if (!service.pricingTiers) {
          if (serviceInfo && serviceInfo.pricingTiers) {
            service.pricingTiers = JSON.parse(JSON.stringify(serviceInfo.pricingTiers));
          }
        }
        // Add link if not present
        if (!service.link) {
          if (serviceInfo && serviceInfo.link) {
            service.link = serviceInfo.link;
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
    localStorage.setItem('proposalPreviewData', JSON.stringify(newData));
  };

  const updateService = (index: number, field: string, value: any) => {
    if (!proposalData) return;
    const newServices = [...proposalData.services];
    newServices[index] = { ...newServices[index], [field]: value };
    updateProposalData({ services: newServices });
    
    // Recalculate totals if quantity or price changed
    if (field === 'quantity' || field === 'unitPrice') {
      recalculateTotals(newServices);
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
      showNotification('Please enter at least one bullet point', 'error');
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
      showNotification('Maximum nesting level (3) reached. Cannot add more sub-bullets.', 'error');
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
    if (!confirm('Delete this bullet point?')) return;
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

  const recalculateTotals = (services?: any[]) => {
    if (!proposalData) return;
    const servicesData = services || proposalData.services;
    
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
    
    const formatPrice = (val: number) => val.toFixed(2).replace('.', ',');
    
    const newPricing = {
      ...proposalData.pricing,
      subtotalNet: formatPrice(subtotal),
      totalNetPrice: formatPrice(totalNet),
      totalVat: formatPrice(totalVat),
      totalGrossPrice: formatPrice(totalGross)
    };
    
    if (hasDiscount) {
      newPricing.discount = {
        type: discountType,
        value: discountValue,
        amount: formatPrice(discountAmount),
        description: discountDescription
      };
    }
    
    updateProposalData({ pricing: newPricing });
  };

  useEffect(() => {
    if (proposalData && hasDiscount) {
      recalculateTotals();
    }
  }, [discountType, discountValue, hasDiscount, discountDescription]);

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
        alert(`✅ Proposal generated successfully!\n\nOffer Number: ${result.offerNumber}\nClient: ${result.clientName}\nTotal: ${result.totalAmount} €`);
        
        if (result.fileUrl) {
          window.open(result.fileUrl, '_blank');
        }
      } else {
        throw new Error(result.error || 'Failed to generate proposal');
      }
    } catch (error: any) {
      console.error('Error:', error);
      alert(`❌ Error generating proposal:\n${error.message}\n\nMake sure the server is running.`);
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
        <div className="text-gray-700 text-lg italic">Loading proposal data...</div>
      </div>
    );
  }

  const offerNumber = `2026-${proposalData.projectInfo.MM}-${proposalData.projectInfo.DD}-8`;

  // Recursive bullet renderer component (Display Only)
  const BulletItem = ({ item, level }: any) => {
    const text = typeof item === 'string' ? item : item.text;
    const children = typeof item === 'object' ? item.children : null;
    const listStyleClass = level === 0 ? 'list-disc' : 'list-[circle]';
    
    return (
      <li className="mb-0.5 leading-tight">
        <span className="px-0.5 inline text-inherit">
          {text}
        </span>
        {children && children.length > 0 && (
          <ul className={`${listStyleClass} ml-5 mt-0.5`}>
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
        <h1 className="text-white text-xl font-semibold">📄 Proposal Preview</h1>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2.5 bg-white/20 text-white rounded-md text-sm font-semibold hover:bg-white/30 transition-colors"
          >
            ← Back to Form
          </button>
          <button
            onClick={handleGenerateProposal}
            disabled={isGenerating}
            className="px-6 py-2.5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isGenerating ? '⏳ Generating...' : '📄 Generate DOCX'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-20 pb-10 px-0 w-[210mm] max-w-full">
        <div className="text-xs text-gray-600 italic mb-4 text-center">
          💡 Click on any text to edit it. Changes are saved automatically.
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
                  <th className="border border-gray-800 p-1.5 text-center bg-gray-100 font-bold text-gray-900 w-[8%]">Anzahl</th>
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
                    const serviceInfo = findServiceInfo(service.name);
                    const rows = [];
                    
                    // Main service row
                    rows.push(
                      <tr key={`service-${index}`}>
                        <td className="border border-gray-800 p-1.5 text-center align-top text-gray-900">
                          <span
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
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => updateService(index, 'name', e.currentTarget.textContent || '')}
                            onKeyDown={handleEnterKey}
                            className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                          >
                            {service.name}
                          </span>
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
                                            placeholder="- Main point&#10;-- Sub point&#10;--- Sub-sub point"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={saveBulkEdit} 
                                                className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-600"
                                            >
                                                Save Changes
                                            </button>
                                            <button 
                                                onClick={() => setEditingServiceIndex(null)} 
                                                className="bg-gray-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-gray-600"
                                            >
                                                Cancel
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
                                    No description. Click to add.
                                </span>
                              );
                            }
                            
                            return (
                              <div 
                                onClick={(e) => {
                                    startBulkEdit(index, descriptions);
                                }}
                                className="cursor-pointer hover:bg-yellow-50 p-1 -m-1 rounded transition-colors relative group"
                                title="Click to edit full description"
                              >
                                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-blue-100 text-blue-800 text-[9px] px-1 rounded border border-blue-200 pointer-events-none z-10">
                                    ✎ Edit Text
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
                                </ul>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="border border-gray-800 p-1.5 text-center align-top text-gray-900">
                          <span
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
                    if (serviceInfo && serviceInfo.pricingTiers) {
                      // Title row
                      rows.push(
                        <tr key={`tier-title-${index}`} className="bg-gray-50">
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                          <td className="border border-gray-800 p-1.5 text-[9pt] font-bold">
                            Preisstaffelung:
                          </td>
                          <td className="border border-gray-800 p-1.5">&nbsp;</td>
                        </tr>
                      );
                      
                      // Tier rows
                      serviceInfo.pricingTiers.forEach((tier: any, tierIndex: number) => {
                        rows.push(
                          <tr key={`tier-${index}-${tierIndex}`} className="bg-gray-50">
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 pl-5 text-[8.5pt] text-gray-900">
                              {tier.label}
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
              💡 Click on quantities, names, descriptions, or prices to edit them
            </div>
          </div>

          {/* Footer */}
          <PageFooter />
        </div>

        {/* Page 3: Perspective Images (if any) */}
        {proposalData.images && proposalData.images.length > 0 && (
          <div className="w-full min-h-[1122px] bg-white shadow-lg border border-gray-300 p-24 mb-10 flex flex-col relative">
            <div className="flex-1 pb-24">
              <div className="font-bold mb-2 text-[11pt] text-gray-900">Empfohlene Perspektiven Außen:</div>
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
                        className="w-[400px] h-auto"
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
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.validUntilText', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.validUntilText || 'Dieses Angebot ist gültig bis:'}
                </span>{' '}
                <span
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
              <p>
                <strong>Lieferweg:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryMethod', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryMethod || 'Die Lieferung erfolgt digital via E-Mail oder Link nach vollständiger Zahlung und Erhalt aller notwendigen Unterlagen.'}
                </span>
              </p>
              <p>
                <strong>Lieferzeit:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newValue = e.currentTarget.textContent || '';
                    handleEditableBlur('projectInfo.deliveryTime', e);
                  }}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
                >
                  {proposalData.projectInfo.deliveryTime || proposalData.projectInfo.deliveryDays || 'XXX Werktage'}
                </span>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryDaysText', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryDaysText || 'Werktage ab Beauftragung und Erhalt der Unterlagen'}
                </span>
              </p>
            </div>

            <div className="mb-5 text-gray-900">
              <p>
                <strong>Zahlungsbedingungen:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.paymentTerms', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.paymentTerms || '50% Anzahlung, Rest nach Lieferung - innerhalb 14 Tage netto'}
                </span>
              </p>
            </div>

            <p className="mb-5 italic text-gray-900">
              <span
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
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditableBlur('signature.signatureName', e)}
                onKeyDown={handleEnterKey}
                className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-1 rounded"
              >
                {proposalData.signature.signatureName}
              </span>
            </p>

            {/* Footnotes */}
            <div className="text-[8.5pt] mt-4 leading-normal text-gray-900">
              <p><strong>Hinweise:</strong></p>
              <p>
                • <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.note1', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.note1 || 'Alle Preise verstehen sich in Euro zzgl. der gesetzlichen Mehrwertsteuer.'}
                </span>
              </p>
              <p>
                • <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.note2', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.note2 || 'Die Lieferzeit beginnt nach Auftragsbestätigung und Zahlungseingang der Anzahlung.'}
                </span>
              </p>
            </div>

            <div className="mt-8 pt-5 border-t border-gray-300 text-[11px] leading-relaxed text-gray-900">
              <p>
                <strong>Korrekturschleifen:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.revisionPolicy', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.revisionPolicy || 'Bis zu 2 Korrekturschleifen sind im Preis inbegriffen. Weitere Korrekturschleifen werden nach Aufwand berechnet.'}
                </span>
              </p>
              <p>
                <strong>Nutzungsrechte:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.usageRights', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text hover:bg-yellow-50 focus:bg-yellow-100 focus:outline-2 focus:outline-blue-500 px-0.5 rounded"
                >
                  {proposalData.terms?.usageRights || 'Mit vollständiger Bezahlung erhalten Sie die uneingeschränkten Nutzungsrechte an den gelieferten Visualisierungen.'}
                </span>
              </p>
            </div>
            <div className="text-[8.5pt] text-gray-600 italic mt-4">
              💡 Click on any price values to edit them
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
              <h3 className="text-xl font-semibold text-white">Add Bullet Points</h3>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  Enter bullet points using the following syntax:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 mb-4">
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">-</code> Main bullet point</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">--</code> Sub-bullet point (level 1)</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">---</code> Sub-sub-bullet point (level 2)</li>
                  <li><code className="bg-gray-100 px-2 py-0.5 rounded">----</code> Level 3 (maximum depth)</li>
                </ul>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">Example:</p>
                  <pre className="text-blue-800 font-mono text-xs whitespace-pre-wrap">
{`- First main point
-- Sub-point of first
--- Sub-sub-point
-- Another sub-point
- Second main point
-- Its sub-point`}
                  </pre>
                </div>
              </div>

              <textarea
                value={bulletInputText}
                onChange={(e) => setBulletInputText(e.target.value)}
                placeholder="- Enter your bullet points here&#10;-- Add sub-bullets with double dashes&#10;--- Add sub-sub-bullets with triple dashes"
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                💡 Tip: Each line will be a separate bullet point. Use dashes to indicate nesting level.
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
                Cancel
              </button>
              <button
                onClick={handleAddBullets}
                className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
              >
                Add Bullets
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
