'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/contexts/NotificationContext';
import { useProposal } from '@/contexts/ProposalContext';
import serviceDescriptions from '@/lib/service_description';
import { ALL_SERVICES } from '@/lib/services';
import SetupForm from '@/components/SetupForm';
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

// contentEditable cell whose text is managed imperatively instead of via React
// children. Once the user types, the browser owns the DOM inside the span; if
// React also renders children there, reconciliation after a state update
// duplicates the text or crashes on insertBefore. React renders the span
// empty; the value is written through a ref whenever it changes while the
// cell is not focused.
function EditableSpan({
  value,
  onInput,
  onBlur,
  onKeyDown,
  className,
  spanRef,
}: {
  value: string | number;
  onInput?: (e: React.FormEvent<HTMLSpanElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSpanElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSpanElement>) => void;
  className?: string;
  spanRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  const localRef = useRef<HTMLSpanElement>(null);
  const ref = spanRef ?? localRef;
  const text = String(value ?? '');
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== text) {
      el.textContent = text;
    }
  }, [text, ref]);
  return (
    // translate="no" keeps browser auto-translate (e.g. Chrome/Google
    // Translate) from replacing the text nodes with <font> wrappers, which
    // both duplicates values visually and mangles German number formatting
    // (comma decimal → dot) before it is parsed on blur.
    <span
      ref={ref}
      translate="no"
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
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

const buildCanonicalPercentageDiscountDescription = (
  numericValue: number,
  rawDescription: string
): string => {
  const cleanDescription = stripLeadingPercentageTokens(rawDescription || '');
  return cleanDescription ? `${numericValue}% ${cleanDescription}` : `${numericValue}%`;
};

// The exterior-visualisation price matrices are keyed by building-type code
// (EFH / DHH / MFH-*). The Setup form collects human-readable project and
// property types, so translate those labels to a code before looking a price
// up — otherwise every tier falls back to the 0,00 € "custom" placeholder.
const BUILDING_TYPE_BY_LABEL: Record<string, string> = {
  'einfamilienhaus': 'EFH',
  'doppelhaushälfte': 'DHH',
  'doppelhaus': 'DHH',
  'mehrfamilienhaus': 'MFH-3-5',
  'wohnanlage': 'MFH-6-10',
};

const toBuildingTypeCode = (value?: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  // Already a code (EFH, DHH, MFH-3-5, …) or the explicit "Custom" option.
  if (/^(EFH|DHH|MFH-[\d-]+|Custom)$/i.test(trimmed)) return trimmed;
  return BUILDING_TYPE_BY_LABEL[trimmed.toLowerCase()] || trimmed;
};

// Resolve the building type for a service: an explicit per-service override
// wins, then the property type from Setup, then the project type.
const resolveBuildingType = (service: any, data: any): string =>
  toBuildingTypeCode(service?.buildingType) ||
  toBuildingTypeCode(data?.projectInfo?.propertyType) ||
  toBuildingTypeCode(data?.projectInfo?.projectType);

// The subset of the document that the Setup form owns. Kept in one place so
// the empty skeleton, the live sync, and the generation payload cannot drift.
const setupFieldsFrom = (state: any) => ({
  clientInfo: {
    clientNumber: state.clientInfo.clientNumber,
    companyName: state.clientInfo.companyName,
    street: state.clientInfo.street,
    postalCode: state.clientInfo.postalCode,
    city: state.clientInfo.city,
    country: state.clientInfo.country,
    contactPersonName: state.clientInfo.contactPersonName,
    contactPersonEmail: state.clientInfo.contactPersonEmail,
  },
  projectInfo: {
    projectNumber: state.projectInfo.projectNumber,
    projectName: state.projectInfo.projectName,
    projectType: state.projectInfo.projectType,
    customProjectType: state.projectInfo.customProjectType,
    propertyType: state.projectInfo.propertyType,
    projectManagerName: state.projectInfo.projectManagerName,
    projectManagerType: state.projectInfo.projectManagerType,
  },
});

// Drop empty strings so a blank Setup field never overwrites a value that the
// document already has.
const pickFilled = <T extends Record<string, any>>(source: T): Partial<T> => {
  const out: Record<string, any> = {};
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim() === '') return;
    if (value == null) return;
    out[key] = value;
  });
  return out as Partial<T>;
};

const parseLocalizedNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
};

export default function PreviewPage() {
  const router = useRouter();
  const { showNotification } = useNotification();
  const proposal = useProposal();
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('0');
  const [discountDescription, setDiscountDescription] = useState('');
  const [showBulletModal, setShowBulletModal] = useState(false);
  const [bulletModalServiceIndex, setBulletModalServiceIndex] = useState<number | null>(null);
  const [bulletInputText, setBulletInputText] = useState('');
  
  // Offer number shown in preview (fetched from server to stay in sync with the counter)
  const [offerNumber, setOfferNumber] = useState<string>('…');
  // True when this editor was opened on an already-saved proposal (via
  // /proposals/[offerNumber]/edit) rather than on a new one.
  const [isExistingProposal, setIsExistingProposal] = useState(false);

  // Bulk Edit State
  const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
  const [bulkEditText, setBulkEditText] = useState('');

  // Add-product drawer
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  // Newly added service: briefly highlighted and scrolled into view.
  const [highlightServiceIndex, setHighlightServiceIndex] = useState<number | null>(null);
  const serviceRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // Per-service delete: inline confirmation + undo toast
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [undo, setUndo] = useState<{ service: any; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whether the Setup form has been completed. It is only shown (and therefore
  // only gates generation) when editing an already-saved proposal; a new
  // proposal generates straight from the review view, as it did before.
  const isReady = proposal.state.offerMeta?.isReady ?? false;
  const canGenerate = !isExistingProposal || isReady;

  // Refs for summary spans — used by recomputePricingLive to update totals
  // directly in the DOM while the user is typing, so we don't trigger a full
  // re-render of the services table on every keystroke.
  const subtotalNetRef = useRef<HTMLSpanElement>(null);
  const totalNetPriceRef = useRef<HTMLSpanElement>(null);
  const totalVatRef = useRef<HTMLSpanElement>(null);
  const totalGrossPriceRef = useRef<HTMLSpanElement>(null);
  const discountAmountRef = useRef<HTMLSpanElement>(null);

  const toDashString = (items: any[], level = 0): string => {
      if (!items) return '';
      let result = '';
      items.forEach(item => {
          const text = (typeof item === 'string' ? item : item.text || '').trimEnd();
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
      // Singular: "Geliefert werden Xx ..." → "Geliefert wird Xx ..."
      text = text.replace(/Geliefert werden (\d+x?)/i, 'Geliefert wird $1');
      // Plural nouns → singular: "Ansichten" → "Ansicht", "Grundrisse" → "Grundriss", etc.
      text = text.replace(/gerenderte Außenansichten/g, 'gerenderte Außenansicht');
      text = text.replace(/gerenderte Innenansichten/g, 'gerenderte Innenansicht');
      text = text.replace(/gerenderte Ansichten/g, 'gerenderte Ansicht');
      text = text.replace(/(\d+x?)\s+3D-Grundrisse/g, '$1 3D-Grundriss');
      text = text.replace(/(\d+x?)\s+2D-Grundrisse/g, '$1 2D-Grundriss');
      text = text.replace(/(\d+x?)\s+3D-Geschosspläne/g, '$1 3D-Geschossplan');
      text = text.replace(/(\d+x?)\s+Digital Home Staging Fotos/g, '$1 Digital Home Staging Foto');
      text = text.replace(/(\d+x?)\s+Digitale Renovierungsfotos/g, '$1 Digitales Renovierungsfoto');
      // Switch article + noun together so we don't corrupt unrelated bullets like
      // "im Angebot aufgeführten Bodenperspektiven verfügbar" (exterior-bird).
      text = text.replace(/aus den folgenden Bodenperspektiven/g, 'aus der folgenden Bodenperspektive');
      text = text.replace(/aus den folgenden Vogelperspektiven/g, 'aus der folgenden Vogelperspektive');
      text = text.replace(/\(siehe rote Pfeile\)/g, '(siehe roten Pfeil)');
      text = text.replace(/\(siehe blaue Pfeile\)/g, '(siehe blauen Pfeil)');
      // "der Räume:" (plural genitive) → "des Raumes:" (singular genitive)
      text = text.replace(/ der Räume:/g, ' des Raumes:');
      // Newly-covered services (revert plural → singular)
      text = text.replace(/(\d+x?)\s+3D-Lagepläne/g, '$1 3D-Lageplan');
      text = text.replace(/(\d+x?)\s+Slideshow-Videos/g, '$1 Slideshow-Video');
      text = text.replace(/(\d+x?)\s+Social Media Pakete/g, '$1 Social Media Paket');
      text = text.replace(/(\d+x?)\s+Video-Snippets/g, '$1 Video-Snippet');
      text = text.replace(/bei denen wir/g, 'bei dem wir');
      text = text.replace(/Videos mit Bewegtbildern/g, 'ein Video mit Bewegtbildern');
      text = text.replace(/(\d+x?)\s+Exposé Layouts/g, '$1 Exposé Layout');
      text = text.replace(/(\d+x?)\s+komplette Exposés/g, '$1 komplettes Exposé');
      // 360° Video-Tour first (more specific) so it isn't shadowed by "360° Tour"
      text = text.replace(/(\d+x?)\s+360° Video-Touren/g, '$1 360° Video-Tour');
      text = text.replace(/(\d+x?)\s+360° Touren\b/g, '$1 360° Tour');
      text = text.replace(/folgender Wohneinheiten:/g, 'folgender Wohneinheit:');
      text = text.replace(/folgender Einheiten:/g, 'folgender Einheit:');
      // Terrace child bullet "Xx Terrassen (Whg. ..)" → singular
      text = text.replace(/(\d+x?\s+)Terrassen(\s+\(Whg)/g, '$1Terrasse$2');
      // Flat Finder
      text = text.replace(/(\d+x?\s+)interaktive Flat Finder\b/g, '$1interaktiver Flat Finder');
      text = text.replace(/\bals Kernelemente\b/g, 'als eines der Kernelemente');
    } else {
      // Plural: "Geliefert wird Xx ..." → "Geliefert werden Xx ..."
      text = text.replace(/Geliefert wird (\d+x?)/i, 'Geliefert werden $1');
      // Singular nouns → plural
      text = text.replace(/gerenderte Außenansicht(?!en)/g, 'gerenderte Außenansichten');
      text = text.replace(/gerenderte Innenansicht(?!en)/g, 'gerenderte Innenansichten');
      text = text.replace(/gerenderte Ansicht(?!en)/g, 'gerenderte Ansichten');
      text = text.replace(/(\d+x?)\s+3D-Grundriss(?!e)/g, '$1 3D-Grundrisse');
      text = text.replace(/(\d+x?)\s+2D-Grundriss(?!e)/g, '$1 2D-Grundrisse');
      text = text.replace(/(\d+x?)\s+3D-Geschossplan(?!.*ä)/g, '$1 3D-Geschosspläne');
      text = text.replace(/(\d+x?)\s+Digital Home Staging Foto(?!s)/g, '$1 Digital Home Staging Fotos');
      text = text.replace(/(\d+x?)\s+Digitales Renovierungsfoto(?!s)/g, '$1 Digitale Renovierungsfotos');
      // Switch article + noun together — avoids touching "aufgeführten Bodenperspektiven".
      text = text.replace(/aus der folgenden Bodenperspektive(?!n)/g, 'aus den folgenden Bodenperspektiven');
      text = text.replace(/aus der folgenden Vogelperspektive(?!n)/g, 'aus den folgenden Vogelperspektiven');
      text = text.replace(/\(siehe roten Pfeil\)/g, '(siehe rote Pfeile)');
      text = text.replace(/\(siehe blauen Pfeil\)/g, '(siehe blaue Pfeile)');
      // "des Raumes:" (singular genitive) → "der Räume:" (plural genitive)
      text = text.replace(/ des Raumes:/g, ' der Räume:');
      // Newly-covered services (singular → plural)
      text = text.replace(/(\d+x?)\s+3D-Lageplan(?!\w)/g, '$1 3D-Lagepläne');
      text = text.replace(/(\d+x?)\s+Slideshow-Video(?!s)/g, '$1 Slideshow-Videos');
      text = text.replace(/(\d+x?)\s+Social Media Paket(?!e)/g, '$1 Social Media Pakete');
      text = text.replace(/(\d+x?)\s+Video-Snippet(?!s)/g, '$1 Video-Snippets');
      text = text.replace(/bei dem wir/g, 'bei denen wir');
      text = text.replace(/ein Video mit Bewegtbildern/g, 'Videos mit Bewegtbildern');
      text = text.replace(/(\d+x?)\s+Exposé Layout(?!s)/g, '$1 Exposé Layouts');
      text = text.replace(/(\d+x?)\s+komplettes Exposé(?!s)/g, '$1 komplette Exposés');
      // 360° Video-Tour first (more specific) so it isn't shadowed by "360° Tour"
      text = text.replace(/(\d+x?)\s+360° Video-Tour(?!en)/g, '$1 360° Video-Touren');
      text = text.replace(/(\d+x?)\s+360° Tour(?!en)\b/g, '$1 360° Touren');
      text = text.replace(/folgender Wohneinheit:/g, 'folgender Wohneinheiten:');
      text = text.replace(/folgender Einheit:/g, 'folgender Einheiten:');
      // Terrace child bullet "Xx Terrasse (Whg. ..)" → plural
      text = text.replace(/(\d+x?\s+)Terrasse(?!n)(\s+\(Whg)/g, '$1Terrassen$2');
      // Flat Finder
      text = text.replace(/(\d+x?\s+)interaktiver Flat Finder\b/g, '$1interaktive Flat Finder');
      text = text.replace(/\bals eines der Kernelemente\b/g, 'als Kernelemente');
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
        text = text.replace(/\{\{QUANTITY\}\}x?/g, `${quantity}x`);
        // Update the number after "Geliefert werden/wird" (x suffix preserved automatically)
        text = text.replace(/(Geliefert (?:werden|wird)\s+)\d+/i, `$1${quantity}`);
        // Update "Xx gerenderte" pattern (e.g. "3x gerenderte") – old or new format
        text = text.replace(/\d+x?\s+gerenderte/i, `${quantity}x gerenderte`);
        // Update quantity in "Xx 3D-Grundrisse" etc. – outputs with x
        text = text.replace(/\d+x?(\s+(?:3D-Grundriss|2D-Grundriss|3D-Geschossplan|Digital Home Staging|Digitale Renovierung))/g, `${quantity}x$1`);
        text = adjustSingularPlural(text, quantity);
        return text;
      }
      let newItem = { ...item };
      if (newItem.text) {
        newItem.text = newItem.text.replace(/\{\{QUANTITY\}\}x?/g, `${quantity}x`);
        newItem.text = newItem.text.replace(/(Geliefert (?:werden|wird)\s+)\d+/i, `$1${quantity}`);
        newItem.text = newItem.text.replace(/\d+x?\s+gerenderte/i, `${quantity}x gerenderte`);
        newItem.text = newItem.text.replace(/\d+x?(\s+(?:3D-Grundriss|2D-Grundriss|3D-Geschossplan|Digital Home Staging|Digitale Renovierung))/g, `${quantity}x$1`);
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

        return text.trimEnd();
      }

      // Handle object items
      let newItem = { ...item };
      if (newItem.text) {
        // Replace standard placeholders
        newItem.text = newItem.text.replace(/\{\{PROJECT_NAME\}\}/g, context.projectName);
        newItem.text = newItem.text.replace(/\{\{QUANTITY\}\}/g, context.quantity.toString());
        // Adjust singular/plural
        newItem.text = adjustSingularPlural(newItem.text, qty).trimEnd();
      }
      
      if (newItem.children && newItem.children.length > 0) {
        newItem.children = replacePlaceholders(newItem.children, context);
      }
      return newItem;
    });
  };

  useEffect(() => {
    loadProposalData();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  // Mirror the Setup form's fields into the rendered document. The form writes
  // to ProposalContext while the document renders from `proposalData`; without
  // this the two diverge and the Setup values never reach the page or the
  // generated .docx. Only non-empty context values are copied, so a blank
  // context never wipes data that was loaded from storage or typed inline.
  // Only applies while editing a saved proposal — that is the only mode that
  // shows the form. A new proposal renders purely from the data the generator
  // handed over, exactly as the preview did before the form existed.
  const setupSnapshot = JSON.stringify(setupFieldsFrom(proposal.state));
  useEffect(() => {
    if (!proposalData || !isExistingProposal) return;
    const setup = JSON.parse(setupSnapshot) as ReturnType<typeof setupFieldsFrom>;

    const merge = (target: any, source: Record<string, any>) => {
      let changed = false;
      const next = { ...target };
      Object.entries(source).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim() === '') return;
        if (value == null || next[key] === value) return;
        next[key] = value;
        changed = true;
      });
      return changed ? next : target;
    };

    const clientInfo = merge(proposalData.clientInfo || {}, setup.clientInfo);
    const projectInfo = merge(proposalData.projectInfo || {}, setup.projectInfo);
    if (clientInfo === proposalData.clientInfo && projectInfo === proposalData.projectInfo) return;

    // Building type drives the exterior pricing tiers, so re-enrich the
    // services whenever the project/property type changes.
    const merged = { ...proposalData, clientInfo, projectInfo };
    merged.services = (merged.services || []).map((s: any) => enrichService({ ...s }, merged));
    updateProposalData({
      clientInfo: merged.clientInfo,
      projectInfo: merged.projectInfo,
      services: merged.services,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupSnapshot, proposalData, isExistingProposal]);

  // Enrich a single service object with description defaults, pricing tiers,
  // sub_name and link — the same treatment loaded services get, so a product
  // added live in the editor renders identically. `data` supplies projectInfo
  // context (project name, building type) used by the placeholder/tier logic.
  const enrichService = (service: any, data: any) => {
    {
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
        // Per-instance override (service.buildingType) falls back to the global type
        if (service.name === '3D-Außenvisualisierung Bodenperspektive') {
          const buildingType = resolveBuildingType(service, data);
          if (buildingType) {
            const fmt = (p: number) => p.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            const priceMatrix: Record<string, number[]> = {
              'EFH': [499, 349, 299, 229, 199],
              'DHH': [599, 399, 359, 329, 299],
              'MFH-3-5': [599, 399, 359, 329, 299],
              'MFH-6-10': [699, 499, 399, 349, 329],
              'MFH-11-15': [799, 599, 499, 399, 349]
            };
            const buildingTypeLabels: Record<string, string> = {
              'EFH': 'Einfamilienhaus',
              'DHH': 'Doppelhaus',
              'MFH-3-5': 'Projekt mit 3 bis 5 Wohneinheiten',
              'MFH-6-10': 'Projekt mit 6 bis 10 Wohneinheiten',
              'MFH-11-15': 'Projekt mit 11 bis 15 Wohneinheiten'
            };
            // Auto-update sub_name with the building type label; use customProjectType for 'Custom'
            const resolvedLabel = buildingType === 'Custom'
              ? (data.projectInfo?.customProjectType || 'Custom')
              : (buildingTypeLabels[buildingType] || buildingType);
            service.sub_name = `(${resolvedLabel})`;
            const prices = priceMatrix[buildingType];
            if (prices) {
              service.pricingTiers = [
                { quantity: 1, price: prices[0], label: `1 Ansicht Netto: ${fmt(prices[0])} €` },
                { quantity: 2, price: prices[1], label: `2 Ansichten: Netto pro Ansicht: ${fmt(prices[1])} €` },
                { quantity: 3, price: prices[2], label: `3 Ansichten: Netto pro Ansicht: ${fmt(prices[2])} €` },
                { quantity: 4, price: prices[3], label: `4 Ansichten: Netto pro Ansicht: ${fmt(prices[3])} €` },
                { quantity: 5, price: prices[4], label: `5 Ansichten: Netto pro Ansicht: ${fmt(prices[4])} €` },
              ];
            } else {
              // Custom building type: generate editable placeholder tiers
              service.pricingTiers = [
                { quantity: 1, price: 0, label: `1 Ansicht Netto: ${fmt(0)} €` },
                { quantity: 2, price: 0, label: `2 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 3, price: 0, label: `3 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 4, price: 0, label: `4 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 5, price: 0, label: `5 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
              ];
            }
          } else {
            service.pricingTiers = [];
          }
        }
        // Bird view pricing: same as exterior-ground (building-type based)
        // Also sync sub_name with the building type (same labels as exterior-ground)
        // Per-instance override (service.buildingType) falls back to the global type
        if (service.name === '3D-Außenvisualisierung Vogelperspektive') {
          const buildingType = resolveBuildingType(service, data);
          if (buildingType) {
            const fmt = (p: number) => p.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            const birdPriceMatrix: Record<string, number[]> = {
              'EFH': [499, 349, 299, 229, 199],
              'DHH': [599, 399, 359, 329, 299],
              'MFH-3-5': [599, 399, 359, 329, 299],
              'MFH-6-10': [699, 499, 399, 349, 329],
              'MFH-11-15': [799, 599, 499, 399, 349]
            };
            const buildingTypeLabels: Record<string, string> = {
              'EFH': 'Einfamilienhaus',
              'DHH': 'Doppelhaus',
              'MFH-3-5': 'Projekt mit 3 bis 5 Wohneinheiten',
              'MFH-6-10': 'Projekt mit 6 bis 10 Wohneinheiten',
              'MFH-11-15': 'Projekt mit 11 bis 15 Wohneinheiten'
            };
            const resolvedBirdLabel = buildingType === 'Custom'
              ? (data.projectInfo?.customProjectType || 'Custom')
              : (buildingTypeLabels[buildingType] || buildingType);
            service.sub_name = `(${resolvedBirdLabel})`;
            const birdPrices = birdPriceMatrix[buildingType];
            if (birdPrices) {
              service.pricingTiers = [
                { quantity: 1, price: birdPrices[0], label: `1 Ansicht Netto: ${fmt(birdPrices[0])} €` },
                { quantity: 2, price: birdPrices[1], label: `2 Ansichten: Netto pro Ansicht: ${fmt(birdPrices[1])} €` },
                { quantity: 3, price: birdPrices[2], label: `3 Ansichten: Netto pro Ansicht: ${fmt(birdPrices[2])} €` },
                { quantity: 4, price: birdPrices[3], label: `4 Ansichten: Netto pro Ansicht: ${fmt(birdPrices[3])} €` },
                { quantity: 5, price: birdPrices[4], label: `5 Ansichten: Netto pro Ansicht: ${fmt(birdPrices[4])} €` },
              ];
            } else {
              // Custom building type: generate editable placeholder tiers
              service.pricingTiers = [
                { quantity: 1, price: 0, label: `1 Ansicht Netto: ${fmt(0)} €` },
                { quantity: 2, price: 0, label: `2 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 3, price: 0, label: `3 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 4, price: 0, label: `4 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
                { quantity: 5, price: 0, label: `5 Ansichten: Netto pro Ansicht: ${fmt(0)} €` },
              ];
            }
          }
        }
        // Set sub_name for 360° Tour Innen based on apartment size
        if (service.name === '360° Tour Innen' && service.apartmentSize) {
          const apartmentSizeLabels: Record<string, string> = {
            '30': 'bis 30 m²',
            '40': 'ca. 40 m²',
            '50': 'ca. 50 m²',
            '60': 'ca. 60 m²',
            '70': 'ca. 70 m²',
            '80': 'ca. 80 m²',
            '90': '90–100 m²',
            '100': '100–120 m²',
            'EFH': 'EFH / DHH'
          };
          service.sub_name = `(${apartmentSizeLabels[service.apartmentSize] || service.apartmentSize})`;
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
    }
  };

  const setupFieldsFromContext = () => setupFieldsFrom(proposal.state);

  // A blank document to start from when nothing has been stored yet.
  const emptyProposalData = (): ProposalData => {
    const { projectInfo, signature } = proposal.state;
    const setup = setupFieldsFromContext();
    return {
      clientInfo: { ...setup.clientInfo },
      projectInfo: {
        ...setup.projectInfo,
        date: projectInfo.date,
        year: projectInfo.year,
        MM: projectInfo.MM,
        DD: projectInfo.DD,
        offerValidUntil: projectInfo.offerValidUntil,
        deliveryTime: projectInfo.deliveryTime,
      },
      services: [],
      images: [],
      pricing: {
        subtotalNet: '0,00',
        totalNetPrice: '0,00',
        totalVat: '0,00',
        totalGrossPrice: '0,00',
      },
      signature: { signatureName: signature.signatureName },
    };
  };

  const loadProposalData = () => {
    // Prefer context rawProposalData (set by the Setup form, kept in-memory
    // across navigation). Fall back to localStorage for a page refresh.
    const contextData = proposal.state.rawProposalData;

    let data: any;
    if (contextData) {
      data = contextData;
    } else {
      let dataStr: string | null = localStorage.getItem('proposalPreviewData');
      if (!dataStr) {
        dataStr = sessionStorage.getItem('proposalPreviewData');
      }
      if (dataStr) {
        data = JSON.parse(dataStr);
      } else {
        // Nothing stored yet (a brand-new proposal). Start from an empty
        // document instead of navigating away: the services table has its own
        // empty state, so the user can build the proposal from here.
        // Redirecting to /setup would bounce straight back, because /setup
        // redirects to /edit.
        data = emptyProposalData();
      }
    }

    // Enrich every service the same way (descriptions, tiers, sub_name, link).
    if (data.services && data.services.length > 0) {
      data.services = data.services.map((service: any) => enrichService(service, data));
    }

    setProposalData(data);

    // An existing proposal opened from the list carries its own offer number;
    // only a new proposal needs the next free one from the counter.
    if (data.offerNumber) {
      setOfferNumber(data.offerNumber);
      setIsExistingProposal(true);
    } else {
      // Fetch the real next offer number so the preview matches the Word document
      const YY = data.projectInfo?.year || String(new Date().getFullYear());
      const MM = data.projectInfo?.MM   || String(new Date().getMonth() + 1).padStart(2, '0');
      const DD = data.projectInfo?.DD   || String(new Date().getDate()).padStart(2, '0');
      fetch(`/api/next-offer-number?year=${YY}&month=${MM}&day=${DD}`)
        .then(r => r.json())
        .then(res => { if (res.offerNumber) setOfferNumber(res.offerNumber); })
        .catch(() => setOfferNumber(`${YY}-${MM}-${DD}-8`));
    }

    // Check if discount exists
    if (data.pricing?.discount) {
      const storedDiscount = data.pricing.discount;
      if (storedDiscount.type === 'fixed') {
        // Preview UI only edits percentage discounts; keep fixed discounts in payload untouched.
        setHasDiscount(false);
        setDiscountValue('0');
        setDiscountDescription(storedDiscount.description || '');
      } else {
        const normalizedDescription = stripLeadingPercentageTokens(storedDiscount.description || '');
        const numericValue = Number(storedDiscount.value) || getLastLeadingPercentageValue(storedDiscount.description || '');
        const hasValidDiscount = numericValue > 0;

        if (hasValidDiscount) {
          setHasDiscount(true);
          setDiscountValue(String(numericValue));
          setDiscountDescription(normalizedDescription);

          // Persist a cleaned, canonical discount payload so generation cannot reuse stale text.
          data.pricing.discount = {
            ...storedDiscount,
            type: 'percentage',
            value: numericValue,
            description: buildCanonicalPercentageDiscountDescription(numericValue, normalizedDescription)
          };
        } else {
          setHasDiscount(false);
          setDiscountValue('0');
          setDiscountDescription('');
          delete data.pricing.discount;
        }
      }
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
      // Re-sync description text so the quantity number and singular/plural
      // forms match the new quantity (e.g. "Geliefert wird 1x ... Raumes:" →
      // "Geliefert werden 11x ... Räume:"). Without this, modifiedDefaults
      // stays frozen at whatever the previous quantity produced.
      if (service.modifiedDefaults) {
        service.modifiedDefaults = syncQuantityInDescriptions(service.modifiedDefaults, qty);
      }
      const tierPrice = getTierPriceForQuantity(service.pricingTiers, qty);
      if (tierPrice !== null) {
        service.unitPrice = tierPrice.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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

  // Add a product to the proposal live. Builds a base service, enriches it the
  // same way loaded services are, sets an initial unit price from its tier or
  // default, appends it, and recomputes totals immediately.
  const addProduct = (serviceId: string) => {
    if (!proposalData) return;
    const info: any = (serviceDescriptions as any)[serviceId];
    if (!info) return;
    if (proposalData.services.some((s: any) => s.name === info.name)) {
      showNotification('Diese Leistung ist bereits im Angebot.', 'info');
      return;
    }
    const base: any = {
      id: serviceId,
      name: info.name,
      quantity: 1,
      unitPrice: '0,00',
      totalPrice: '0,00',
    };
    const enriched = enrichService(base, proposalData);
    let price = info.defaultPrice ?? 0;
    const tierPrice = getTierPriceForQuantity(enriched.pricingTiers, 1);
    if (tierPrice !== null) price = tierPrice;
    enriched.unitPrice = price.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // Insert at the service's canonical position rather than appending, so the
    // document keeps the running order defined in lib/services.ts.
    const orderOf = (id: string) =>
      ALL_SERVICES.find((s) => s.id === id)?.order ?? Number.MAX_SAFE_INTEGER;
    const newOrder = orderOf(serviceId);
    const newServices = [...proposalData.services];
    let insertAt = newServices.findIndex((s: any) => orderOf(idForService(s)) > newOrder);
    if (insertAt === -1) insertAt = newServices.length;
    newServices.splice(insertAt, 0, enriched);

    const newPricing = computePricing(newServices);
    updateProposalData({ services: newServices, pricing: newPricing });

    if (price > 0) {
      showNotification(`${info.name} hinzugefügt`, 'success');
    } else {
      // Several services (Terrasse, Flat Finder, Online Marketing, …) carry no
      // default or tiered price. Silently inserting a 0,00 € line is how a
      // proposal goes out under-priced, so say so explicitly.
      showNotification(
        `${info.name} hinzugefügt — kein Standardpreis hinterlegt, bitte Stückpreis eintragen.`,
        'info'
      );
    }
    setHighlightServiceIndex(insertAt);
  };

  // Services loaded from storage do not always carry their id, so fall back to
  // matching on the name from lib/services.ts.
  const idForService = (service: any): string =>
    service?.id || ALL_SERVICES.find((s) => s.name === service?.name)?.id || '';

  // Delete a service. A snapshot is kept so the undo toast can restore the
  // service with its edits (a plain re-add would only bring back defaults).
  const confirmDeleteService = (index: number) => {
    if (!proposalData) return;
    const removed = proposalData.services[index];
    const newServices = proposalData.services.filter((_: any, i: number) => i !== index);
    const newPricing = computePricing(newServices);
    updateProposalData({ services: newServices, pricing: newPricing });
    setConfirmDeleteIndex(null);
    setEditingServiceIndex(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ service: removed, index });
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };

  // Scroll a freshly added service into view and clear the highlight after a
  // moment, so the user can see where in the document it landed.
  useEffect(() => {
    if (highlightServiceIndex === null) return;
    serviceRowRefs.current[highlightServiceIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    const t = setTimeout(() => setHighlightServiceIndex(null), 2000);
    return () => clearTimeout(t);
  }, [highlightServiceIndex]);

  const undoDelete = () => {
    if (!proposalData || !undo) return;
    const newServices = [...proposalData.services];
    newServices.splice(Math.min(undo.index, newServices.length), 0, undo.service);
    const newPricing = computePricing(newServices);
    updateProposalData({ services: newServices, pricing: newPricing });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
  };

  // Recompute pricing live (without committing to services or triggering a
  // React re-render) so the summary reflects in-progress edits to
  // quantity/unitPrice before blur. Writes straight to the summary DOM via
  // refs to keep typing in the edited span free of reconciliation lag.
  const recomputePricingLive = (index: number, field: 'quantity' | 'unitPrice', rawValue: string) => {
    if (!proposalData) return;
    const tempServices = proposalData.services.map((s: any) => ({ ...s }));
    const tempService = tempServices[index];
    if (!tempService) return;

    if (field === 'quantity') {
      const qty = parseInt(rawValue.replace(/x$/i, '')) || 0;
      tempService.quantity = qty;
      const tierPrice = getTierPriceForQuantity(tempService.pricingTiers, qty);
      if (tierPrice !== null) {
        tempService.unitPrice = tierPrice.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
    } else {
      const num = parseFloat(rawValue.replace(/\./g, '').replace(',', '.')) || 0;
      tempService.unitPrice = num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    const newPricing = computePricing(tempServices);
    if (subtotalNetRef.current) subtotalNetRef.current.textContent = newPricing.subtotalNet;
    if (totalNetPriceRef.current) totalNetPriceRef.current.textContent = newPricing.totalNetPrice;
    if (totalVatRef.current) totalVatRef.current.textContent = newPricing.totalVat;
    if (totalGrossPriceRef.current) totalGrossPriceRef.current.textContent = newPricing.totalGrossPrice;
    if (discountAmountRef.current && newPricing.discount?.amount) {
      discountAmountRef.current.textContent = newPricing.discount.amount;
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

  const computePricing = (servicesData: any[], applyDiscount = hasDiscount) => {
    let subtotal = 0;
    servicesData.forEach((service: any) => {
      const qty = parseInt(service.quantity) || 0;
      const price = parseFloat(service.unitPrice?.toString().replace(/\./g, '').replace(',', '.')) || 0;
      subtotal += qty * price;
    });

    const existingDiscount = proposalData?.pricing?.discount;
    const hasFixedDiscount = existingDiscount?.type === 'fixed' &&
      ((Number(existingDiscount.value) || 0) > 0 || parseLocalizedNumber(existingDiscount.amount) > 0);

    let discountAmount = 0;
    const numericDiscountValue = parseFloat((discountValue || '0').replace(',', '.')) || 0;
    const fixedDiscountValue = hasFixedDiscount
      ? (Number(existingDiscount.value) || parseLocalizedNumber(existingDiscount.amount))
      : 0;

    if (applyDiscount && numericDiscountValue > 0) {
      discountAmount = subtotal * (numericDiscountValue / 100);
    } else if (!applyDiscount && fixedDiscountValue > 0) {
      discountAmount = fixedDiscountValue;
    }

    const totalNet = subtotal - discountAmount;
    const totalVat = totalNet * 0.19;
    const totalGross = totalNet + totalVat;
    const fmt = (val: number) => val.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    const pricing: any = {
      ...(proposalData?.pricing || {}),
      subtotalNet: fmt(subtotal),
      totalNetPrice: fmt(totalNet),
      totalVat: fmt(totalVat),
      totalGrossPrice: fmt(totalGross),
    };
    if (applyDiscount && numericDiscountValue > 0) {
      const fullDescription = buildCanonicalPercentageDiscountDescription(numericDiscountValue, discountDescription);
      pricing.discount = {
        type: 'percentage',
        value: numericDiscountValue,
        amount: fmt(discountAmount),
        description: fullDescription,
      };
    } else if (!applyDiscount && fixedDiscountValue > 0 && existingDiscount) {
      pricing.discount = {
        ...existingDiscount,
        value: fixedDiscountValue,
      };
    } else {
      delete pricing.discount;
    }
    return pricing;
  };

  const recalculateTotals = (services?: any[], applyDiscount?: boolean) => {
    if (!proposalData) return;
    const servicesData = services || proposalData.services;
    const newPricing = computePricing(servicesData, applyDiscount ?? hasDiscount);
    updateProposalData({ pricing: newPricing });
  };

  useEffect(() => {
    if (proposalData && hasDiscount) {
      recalculateTotals();
    }
  }, [discountValue, hasDiscount, discountDescription]);

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
  const rebuildTierLabel = (tier: any, allTiers: any[], tierIndex: number, serviceName?: string): string => {
    const fmt = (p: number) => p.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const isLast = tierIndex === allTiers.length - 1;
    const isExterior = serviceName === '3D-Außenvisualisierung Bodenperspektive' ||
                       serviceName === '3D-Außenvisualisierung Vogelperspektive';
    const prefix = isLast && allTiers.length > 1 && !isExterior ? '≥' : '';
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
    tiers[tierIndex].label = rebuildTierLabel(tiers[tierIndex], tiers, tierIndex, service.name);
    service.pricingTiers = tiers;

    // If the current quantity matches this tier, update unitPrice
    const qty = parseInt(service.quantity) || 0;
    const matchedPrice = getTierPriceForQuantity(tiers, qty);
    if (matchedPrice !== null) {
      service.unitPrice = matchedPrice.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
    return value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
  };

  const calculatePercentageDiscount = () => {
    if (!proposalData) return '0,00';
    const percentage = parseFloat(discountValue.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
    let subtotal = 0;
    proposalData.services.forEach((service: any) => {
      const qty = parseInt(service.quantity) || 0;
      const price = parseFloat(service.unitPrice?.toString().replace(/\./g, '').replace(',', '.')) || 0;
      subtotal += qty * price;
    });
    return (subtotal * percentage / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleGenerateProposal = async () => {
    if (!proposalData) return;

    if (!proposalData.services || proposalData.services.length === 0) {
      showNotification('Das Angebot enthält noch keine Leistungen.', 'error');
      return;
    }

    // Don't let a service that has no default price go out at 0,00 €.
    const unpriced = proposalData.services.filter(
      (s: any) => parseLocalizedNumber(s.unitPrice) <= 0
    );
    if (unpriced.length > 0) {
      showNotification(
        `Bitte einen Stückpreis eintragen für: ${unpriced.map((s: any) => s.name).join(', ')}`,
        'error'
      );
      return;
    }

    setIsGenerating(true);

    try {
      // While editing a saved proposal, merge in the Setup form's fields — they
      // live in ProposalContext, not in the rendered document, and without this
      // they never reach generation. A new proposal is generated from the
      // document alone, as it was before the form existed.
      const setup = setupFieldsFromContext();
      const payload = isExistingProposal
        ? {
            ...proposalData,
            clientInfo: { ...proposalData.clientInfo, ...pickFilled(setup.clientInfo) },
            projectInfo: { ...proposalData.projectInfo, ...pickFilled(setup.projectInfo) },
            offerMeta: proposal.state.offerMeta,
          }
        : { ...proposalData };

      const response = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert(`✅ Angebot erfolgreich erstellt!\n\nAngebotsnummer: ${result.offerNumber}\nKunde: ${result.clientName}\nGesamt: ${result.totalAmount} €`);

        if (result.docxBase64) {
          const bytes = Uint8Array.from(atob(result.docxBase64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename || 'Angebot.docx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
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
    recalculateTotals(undefined, true);
  };

  const removeDiscount = () => {
    setHasDiscount(false);
    setDiscountValue('0');
    setDiscountDescription('');
    recalculateTotals(undefined, false);
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 [font-family:var(--font-manrope)]">
        <div className="w-[280px] h-[396px] rounded-sm bg-white border border-gray-200 shadow-sm animate-pulse mb-6" />
        <div className="text-gray-500 text-sm tracking-wide">Angebotsdaten werden geladen …</div>
      </div>
    );
  }

  // offerNumber is fetched dynamically from /api/next-offer-number (see state above)

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
      {/* Editor Toolbar */}
      <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-3.5 flex justify-between items-center shadow-lg z-50 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {isExistingProposal && (
            <>
              <button
                onClick={() =>
                  document.getElementById('extra-info-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="text-white/80 hover:text-white text-sm font-semibold whitespace-nowrap"
              >
                ↑ Zusatzinfos
              </button>
              <div className="h-5 w-px bg-white/20" />
            </>
          )}
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">
              Angebot {offerNumber}
              {proposalData.clientInfo?.companyName ? ` · ${proposalData.clientInfo.companyName}` : ''}
            </div>
            <div className="text-white/50 text-[11px] flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${autoSaveChipColor(proposal.autoSaveStatus)}`} />
              {autoSaveChipText(proposal.autoSaveStatus)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowAddDrawer(true)}
            className="px-4 py-2.5 bg-white/15 text-white rounded-md text-sm font-semibold hover:bg-white/25 transition-colors whitespace-nowrap"
          >
            + Produkt hinzufügen
          </button>
          <button
            onClick={handleGenerateProposal}
            disabled={isGenerating || !canGenerate}
            title={!canGenerate ? 'Bitte zuerst die Einrichtung abschließen' : undefined}
            className="px-6 py-2.5 bg-green-500 text-white rounded-md text-sm font-semibold hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed disabled:transform-none disabled:hover:shadow-none whitespace-nowrap"
          >
            {isGenerating ? '⏳ Wird erstellt...' : '📄 DOCX erstellen'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-24 pb-16 px-0 w-[210mm] max-w-full">
        {/* Extra-information form. Only shown when an already-saved proposal is
            being edited; a brand-new proposal goes straight to the document. */}
        {isExistingProposal && <SetupForm />}
        <div className="text-xs text-gray-600 italic mb-4 text-center">
          💡 Klicken Sie auf einen Text, um ihn zu bearbeiten. Änderungen werden automatisch gespeichert.
        </div>
        {/* Page 1: Cover */}
        <SheetLabel title="Anschreiben" />
        <div className="w-full min-h-[1122px] bg-white border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.18)] rounded-[3px] p-24 mb-12 flex flex-col relative">
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
        <SheetLabel title="Leistungen & Preise" />
        <div className="w-full min-h-[1122px] bg-white border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.18)] rounded-[3px] p-24 mb-12 flex flex-col relative">
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
                    <td colSpan={4} className="border border-gray-800 p-8 text-center">
                      <div className="text-gray-600 italic mb-3">
                        Noch keine Leistungen — fügen Sie eine hinzu, um das Angebot aufzubauen.
                      </div>
                      <button
                        onClick={() => setShowAddDrawer(true)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#2F6FED] px-4 py-2 text-xs font-bold text-white hover:bg-[#2558C4] transition-colors [font-family:var(--font-manrope)]"
                      >
                        + Produkt hinzufügen
                      </button>
                    </td>
                  </tr>
                ) : (
                  proposalData.services.flatMap((service: any, index: number) => {
                    const serviceInfo = findServiceInfo(service);
                    const rows = [];
                    
                    // Main service row
                    rows.push(
                      <tr
                        key={`service-${index}`}
                        ref={(el) => { serviceRowRefs.current[index] = el; }}
                        className={`group/svc transition-colors duration-500 ${
                          highlightServiceIndex === index ? 'bg-[#EDF3FF]' : ''
                        }`}
                      >
                        <td className="border border-gray-800 p-1.5 text-center align-top text-gray-900 relative">
                          <EditableSpan
                            value={service.quantity}
                            onInput={(e) => {
                              recomputePricingLive(index, 'quantity', e.currentTarget.textContent || '0');
                            }}
                            onBlur={(e) => {
                              const newQty = parseInt(e.currentTarget.textContent?.replace(/x$/i, '') || '0');
                              updateService(index, 'quantity', newQty);
                            }}
                            onKeyDown={handleEnterKey}
                            className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                          />
                          <div className="mt-1.5 flex justify-center [font-family:var(--font-manrope)]">
                            {confirmDeleteIndex === index ? (
                              <span className="inline-flex items-center gap-1 text-[10px]">
                                <span className="text-gray-600">Löschen?</span>
                                <button
                                  onClick={() => confirmDeleteService(index)}
                                  className="font-bold text-red-600 hover:underline"
                                >
                                  Ja
                                </button>
                                <span className="text-gray-300">/</span>
                                <button
                                  onClick={() => setConfirmDeleteIndex(null)}
                                  className="font-semibold text-gray-500 hover:underline"
                                >
                                  Nein
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteIndex(index)}
                                title="Leistung entfernen"
                                aria-label="Leistung entfernen"
                                className="text-gray-300 hover:text-red-600 opacity-0 group-hover/svc:opacity-100 focus:opacity-100 transition-opacity"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                  <path d="M10 11v6M14 11v6" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-800 p-1.5 align-top text-gray-900">
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) => updateService(index, 'name', e.currentTarget.textContent || '')}
                            onKeyDown={handleEnterKey}
                            className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                          >
                            {service.name}
                          </span>
                          {service.sub_name && (
                            <div className="mt-0.5">
                              <span
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => updateService(index, 'sub_name', e.currentTarget.textContent || '')}
                                onKeyDown={handleEnterKey}
                                className="text-xs text-gray-600 italic cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
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
                                                className="bg-[#2F6FED] text-white px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-[#2558C4] transition-colors [font-family:var(--font-manrope)]"
                                            >
                                                Speichern
                                            </button>
                                            <button
                                                onClick={() => setEditingServiceIndex(null)}
                                                className="text-gray-600 border border-gray-300 px-3.5 py-1.5 rounded-full text-xs font-bold hover:bg-gray-100 transition-colors [font-family:var(--font-manrope)]"
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
                                className="cursor-pointer hover:bg-[#EDF3FF] p-1 -m-1 rounded transition-colors relative group"
                                title="Klicken zum Bearbeiten der Beschreibung"
                              >
                                <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 bg-[#2F6FED] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full pointer-events-none z-10 [font-family:var(--font-manrope)]">
                                    Text bearbeiten
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
                          <EditableSpan
                            value={service.unitPrice}
                            onInput={(e) => {
                              recomputePricingLive(index, 'unitPrice', e.currentTarget.textContent?.trim() || '0');
                            }}
                            onBlur={(e) => {
                              const raw = e.currentTarget.textContent?.trim() || '0';
                              // Parse German-formatted input (dot = thousands, comma = decimal)
                              const num = parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0;
                              updateService(index, 'unitPrice', num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                            }}
                            onKeyDown={handleEnterKey}
                            className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                          />
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
                        const priceMatch = tier.label?.match(/^(.+?)\s*([\d.]+,\d{2})\s*€$/);
                        rows.push(
                          <tr key={`tier-${index}-${tierIndex}`} className="bg-gray-50">
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 text-[8.5pt]">&nbsp;</td>
                            <td className="border border-gray-800 p-1 pl-5 text-[8.5pt] text-gray-900">
                              {priceMatch ? (
                                <>
                                  {priceMatch[1]}{' '}
                                  <EditableSpan
                                    value={priceMatch[2]}
                                    onBlur={(e) => {
                                      const raw = e.currentTarget.textContent?.replace(/\./g, '').replace(',', '.') || '0';
                                      const parsed = parseFloat(raw);
                                      if (!isNaN(parsed)) updateTierPrice(index, tierIndex, parsed);
                                    }}
                                    onKeyDown={handleEnterKey}
                                    className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                                  />
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
          </div>

          {/* Footer */}
          <PageFooter />
        </div>

        {/* Page 3: Perspective Images (if any) */}
        {proposalData.images && proposalData.images.length > 0 && (
          <>
          <SheetLabel title="Empfohlene Perspektiven" />
          <div className="w-full min-h-[1122px] bg-white border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.18)] rounded-[3px] p-24 mb-12 flex flex-col relative">
            <div className="flex-1 pb-24">
              <div className="font-bold mb-2 text-[11pt] text-gray-900">Empfohlene Perspektiven Außen</div>
              {proposalData.images.map((image: any, index: number) => (
                <div key={index} className="mb-8">
                  {image.imageData && image.title && (
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
          </>
        )}

        {/* Page 4: Pricing Summary */}
        <SheetLabel title="Zusammenfassung & Konditionen" />
        <div className="w-full min-h-[1122px] bg-white border border-gray-300 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_12px_28px_-12px_rgba(15,23,42,0.18)] rounded-[3px] p-24 mb-12 flex flex-col relative">
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
                      <EditableSpan
                        spanRef={subtotalNetRef}
                        value={proposalData.pricing.subtotalNet}
                        onBlur={(e) => handleEditableBlur('pricing.subtotalNet', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                      /> €
                    </strong>
                  </td>
                </tr>
                
                {hasDiscount && (
                  <tr className="border border-gray-800 bg-[#F4F8FF]">
                    <td className="border border-gray-800 p-1.5 text-gray-900">
                      <strong>
                        Rabatt: <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newDesc = e.currentTarget.textContent || '';
                            setDiscountDescription(newDesc);
                          }}
                          onKeyDown={handleEnterKey}
                          className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                        >
                          {discountDescription}
                        </span>
                      </strong>
                    </td>
                    <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                      <strong className="text-amber-700">
                        - <span
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={(e) => {
                            const newValue = e.currentTarget.textContent || '0';
                            setDiscountValue(newValue);
                          }}
                          onKeyDown={handleEnterKey}
                          className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                        >
                          {discountValue}
                        </span>
                        {'% '}
                        <span className="text-gray-600 text-[9pt] ml-1">
                          (<span ref={discountAmountRef} translate="no">{calculatePercentageDiscount()}</span> €)
                        </span>
                        <button
                          onClick={removeDiscount}
                          className="ml-2 text-[11px] font-semibold text-red-600 border border-red-300 px-2.5 py-0.5 rounded-full hover:bg-red-50 transition-colors [font-family:var(--font-manrope)]"
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
                      <EditableSpan
                        spanRef={totalNetPriceRef}
                        value={proposalData.pricing.totalNetPrice}
                        onBlur={(e) => handleEditableBlur('pricing.totalNetPrice', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                      /> €
                    </strong>
                  </td>
                </tr>
                
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 text-gray-900">
                    <strong>MwSt. (19%)</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                    <strong>
                      <EditableSpan
                        spanRef={totalVatRef}
                        value={proposalData.pricing.totalVat}
                        onBlur={(e) => handleEditableBlur('pricing.totalVat', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                      /> €
                    </strong>
                  </td>
                </tr>
                
                <tr className="border border-gray-800">
                  <td className="border border-gray-800 p-1.5 text-gray-900">
                    <strong>Gesamtbruttopreis</strong>
                  </td>
                  <td className="border border-gray-800 p-1.5 text-center text-gray-900">
                    <strong>
                      <EditableSpan
                        spanRef={totalGrossPriceRef}
                        value={proposalData.pricing.totalGrossPrice}
                        onBlur={(e) => handleEditableBlur('pricing.totalGrossPrice', e)}
                        onKeyDown={handleEnterKey}
                        className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                      /> €
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>

            {!hasDiscount && (
              <button
                onClick={addDiscount}
                className="mt-3 text-[#2F6FED] border border-[#2F6FED]/40 px-4 py-1.5 rounded-full hover:bg-[#EDF3FF] text-[13px] font-semibold transition-colors [font-family:var(--font-manrope)]"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.validUntilText || 'Dieses Angebot ist gültig bis:'}
                </span>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('projectInfo.offerValidUntil', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
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
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryMethod', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryMethod || 'Digital via Email'}
                </span>
              </p>
              <p className="mb-2">
                <strong>Voraussichtl. Leistungsdatum:</strong>{' '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    handleEditableBlur('projectInfo.deliveryTime', e);
                  }}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
                >
                  {proposalData.projectInfo.deliveryTime || '4-6'}
                </span>
                {' Arbeitstage '}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.deliveryDaysText', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.deliveryDaysText || (() => {
                    const netStr = proposalData.pricing?.totalNetPrice || '0';
                    const netNum = parseFloat(netStr.replace(/\./g, '').replace(',', '.')) || 0;
                    if (netNum > 2000) {
                      const grossStr = proposalData.pricing?.totalGrossPrice || '0';
                      const grossNum = parseFloat(grossStr.replace(/\./g, '').replace(',', '.')) || 0;
                      const halfAmount = (grossNum * 0.5).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                      return `nach Eingang der Anzahlung i.H.v. 50% des Bruttopreises (${halfAmount} EUR) und Erhalt aller Unterlagen und Informationen`;
                    }
                    return 'nach Auftragseingang und Erhalt aller Unterlagen und Informationen';
                  })()}
                </span>
              </p>
            </div>

            <p className="mb-5 italic text-gray-900">
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditableBlur('terms.closingGreeting', e)}
                onKeyDown={handleEnterKey}
                className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
              >
                {proposalData.terms?.closingGreeting || 'Mit freundlichen Grüßen'}
              </span>
              <br />
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => handleEditableBlur('signature.signatureName', e)}
                onKeyDown={handleEnterKey}
                className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-1 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.p_two || italicData.p_two}
                </span>
              </p>
              {(proposalData.terms?.p_three || hasVirtualTour) && (
              <p>
                <span
                  key="p_three"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_three', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.p_three || italicData.p_three}
                </span>
              </p>
              )}
              <p>
                <span
                  key="p_four"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleEditableBlur('terms.p_four', e)}
                  onKeyDown={handleEnterKey}
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
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
                  className="cursor-text transition-colors hover:bg-[#EDF3FF] hover:shadow-[inset_0_-1px_0_0_#9DB8E8] focus:bg-white focus:shadow-none focus:outline-2 focus:outline-[#2F6FED] px-0.5 rounded"
                >
                  {proposalData.terms?.p_eight || italicData.p_eight}
                </span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <PageFooter />
        </div>
      </div>

      {/* Add-product drawer */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end [font-family:var(--font-manrope)]">
          <div
            className="absolute inset-0 bg-[#0E1218]/50 backdrop-blur-[2px]"
            onClick={() => setShowAddDrawer(false)}
          />
          <div className="relative h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-[slideIn_.18s_ease-out]">
            <div className="px-6 pt-5 pb-4 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.18em] text-gray-400 uppercase">
                    Leistung
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Produkt hinzufügen</h3>
                </div>
                <button
                  onClick={() => setShowAddDrawer(false)}
                  aria-label="Schließen"
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
              <input
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                placeholder="Leistung suchen…"
                className="mt-3 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2F6FED] focus:border-[#2F6FED]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {ALL_SERVICES.filter((s) =>
                s.name.toLowerCase().includes(addSearch.trim().toLowerCase())
              ).map((s) => {
                const info: any = (serviceDescriptions as any)[s.id];
                const already = proposalData.services.some((x: any) => x.name === (info?.name || s.name));
                const price = info?.defaultPrice;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{info?.name || s.name}</div>
                      <div className="text-xs text-gray-500">
                        {price != null
                          ? `ab ${price.toFixed(2).replace('.', ',')} € netto`
                          : 'Preis nach Staffel'}
                      </div>
                    </div>
                    {already ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        ✓ Hinzugefügt
                      </span>
                    ) : (
                      <button
                        onClick={() => addProduct(s.id)}
                        className="shrink-0 rounded-full border border-[#2F6FED] px-3.5 py-1.5 text-xs font-bold text-[#2F6FED] hover:bg-[#EDF3FF] transition-colors"
                      >
                        Hinzufügen
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {proposalData.services.length} im Angebot
              </span>
              <button
                onClick={() => setShowAddDrawer(false)}
                className="rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo toast for a deleted service */}
      {undo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-4 rounded-full bg-slate-900 px-5 py-3 text-sm text-white shadow-2xl [font-family:var(--font-manrope)]">
          <span className="truncate max-w-[240px]">
            <strong>{undo.service?.name}</strong> entfernt
          </span>
          <button
            onClick={undoDelete}
            className="font-bold text-[#7FB0FF] hover:text-white"
          >
            Rückgängig
          </button>
        </div>
      )}

      {/* Bullet Point Modal */}
      {showBulletModal && (
        <div className="fixed inset-0 bg-[#0E1218]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col [font-family:var(--font-manrope)]">
            {/* Modal Header */}
            <div className="px-6 pt-5 pb-4 border-b border-gray-200">
              <div className="text-[10px] font-semibold tracking-[0.18em] text-gray-400 uppercase mb-0.5">Beschreibung</div>
              <h3 className="text-lg font-bold text-gray-900">Aufzählungspunkte hinzufügen</h3>
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
                <div className="bg-[#F4F8FF] border border-[#2F6FED]/20 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-[#1D4CB0] mb-1">Beispiel:</p>
                  <pre className="text-[#2558C4] font-mono text-xs whitespace-pre-wrap">
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
                Jede Zeile wird ein eigener Aufzählungspunkt. Striche bestimmen die Verschachtelungsebene.
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
                className="px-5 py-2 text-gray-600 border border-gray-300 rounded-full hover:bg-gray-100 transition-colors text-sm font-semibold"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddBullets}
                className="px-5 py-2 bg-[#2F6FED] text-white rounded-full hover:bg-[#2558C4] transition-colors text-sm font-bold"
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

function autoSaveChipText(status: 'idle' | 'saving' | 'saved') {
  if (status === 'saving') return 'Speichern…';
  if (status === 'saved') return 'Gespeichert';
  return 'Automatisch gespeichert';
}

function autoSaveChipColor(status: 'idle' | 'saving' | 'saved') {
  if (status === 'saving') return 'bg-amber-300';
  if (status === 'saved') return 'bg-emerald-400';
  return 'bg-white/40';
}

function SheetLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 px-1 [font-family:var(--font-manrope)]" aria-hidden>
      <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-gray-500 whitespace-nowrap">
        {title}
      </span>
      <span className="flex-1 h-px bg-gray-300" />
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
