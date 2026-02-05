# Unified State Management Architecture

## Overview

The proposal generator now uses a **unified state management system** with React Context that:

1. ✅ **Centralizes all proposal data** in one shared store (`ProposalContext`)
2. ✅ **Uses `service_description.js` as the source of truth** for service metadata
3. ✅ **Auto-calculates prices** based on quantity and service parameters
4. ✅ **Auto-calculates delivery time** based on selected services
5. ✅ **Keeps both pages in sync** (proposal form and preview)
6. ✅ **Auto-saves to localStorage** every 5 seconds
7. ✅ **Validates data** before generating proposals

## File Structure

```
contexts/
  └── ProposalContext.tsx          # Main state management
hooks/
  └── useServicePricing.ts         # Service pricing calculations
utils/
  └── deliveryTime.ts              # Delivery time calculations
lib/
  └── service_description.js       # Service metadata (source of truth)
app/
  ├── layout.tsx                   # Wraps app with ProposalProvider
  ├── proposal-form/page.tsx       # Main form (uses useProposal hook)
  └── preview/page.tsx             # Preview (uses useProposal hook)
```

## How It Works

### 1. ProposalContext (`contexts/ProposalContext.tsx`)

The main state container that holds ALL proposal data:

```typescript
interface ProposalState {
  clientInfo: ClientInfo;        // Client details
  projectInfo: ProjectInfo;      // Project details, delivery time
  services: ServiceData[];       // Selected services with pricing
  images: ImageData[];           // Uploaded images
  pricing: PricingData;          // Totals, discounts, VAT
  signature: SignatureData;      // Signature info
}
```

### 2. Service Descriptions (`lib/service_description.js`)

**Source of truth** for all service metadata:
- Service names
- Default descriptions (bullet points)
- Default prices
- Pricing tiers
- Reference links

### 3. Automatic Calculations

#### Price Calculation
- When you add a service, its price is automatically calculated
- Prices update when quantity or parameters (building type, etc.) change
- Uses complex pricing logic (tiers, quantity discounts)

#### Delivery Time Calculation
- Automatically calculated based on ALL selected services
- Each service has a time estimate
- Result shows range (e.g., "12-15 Werktage")

## Usage

### In Any Component

```typescript
import { useProposal } from '@/contexts/ProposalContext';

function MyComponent() {
  const {
    state,                    // Current proposal state
    addService,               // Add a service
    updateService,            // Update service details
    removeService,            // Remove a service
    updateClientInfo,         // Update client info
    updateProjectInfo,        // Update project info
    recalculatePricing,       // Manually recalculate totals
    isValid,                  // Check if proposal is valid
    getValidationErrors,      // Get validation errors
    autoSaveStatus            // 'idle' | 'saving' | 'saved'
  } = useProposal();

  // Use state
  console.log(state.services);
  console.log(state.pricing.totalGrossPrice);
  console.log(state.projectInfo.deliveryTime);

  // Add a service
  const handleAddService = () => {
    addService('exterior-ground');
    // Service is automatically added with:
    // - Default price from service_description.js
    // - Default description
    // - Quantity = 1
  };

  // Update service
  const handleUpdateQuantity = (serviceId: string, qty: number) => {
    updateService(serviceId, { quantity: qty });
    // Price and delivery time automatically recalculate!
  };

  // Update building type (affects price)
  const handleUpdateBuildingType = (serviceId: string, type: string) => {
    updateService(serviceId, { buildingType: type });
    // Price automatically recalculates based on building type!
  };

  return <div>...</div>;
}
```

### Example: Proposal Form Page

```typescript
'use client';

import { useProposal } from '@/contexts/ProposalContext';
import { ALL_SERVICES } from '@/lib/services';

export default function ProposalFormPage() {
  const {
    state,
    addService,
    removeService,
    updateService,
    isServiceActive,
    updateClientInfo,
    autoSaveStatus
  } = useProposal();

  return (
    <div>
      <h1>Create Proposal</h1>
      
      {/* Auto-save indicator */}
      <div>{autoSaveStatus === 'saved' ? '✅ Saved' : '💾 Saving...'}</div>

      {/* Client Info */}
      <input
        value={state.clientInfo.companyName}
        onChange={(e) => updateClientInfo({ companyName: e.target.value })}
        placeholder="Company Name"
      />

      {/* Service Selection */}
      {ALL_SERVICES.map(service => (
        <div key={service.id}>
          <label>
            <input
              type="checkbox"
              checked={isServiceActive(service.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  addService(service.id);
                } else {
                  removeService(service.id);
                }
              }}
            />
            {service.name}
          </label>
        </div>
      ))}

      {/* Selected Services */}
      {state.services.map(service => (
        <div key={service.id}>
          <h3>{service.name}</h3>
          <input
            type="number"
            value={service.quantity}
            onChange={(e) => updateService(service.id, {
              quantity: parseInt(e.target.value) || 1
            })}
          />
          <div>Unit Price: {service.unitPrice}€</div>
          <div>Total: {service.totalPrice}€</div>
        </div>
      ))}

      {/* Totals (automatically calculated) */}
      <div>
        <div>Subtotal: {state.pricing.subtotalNet}€</div>
        <div>VAT: {state.pricing.totalVat}€</div>
        <div>Total: {state.pricing.totalGrossPrice}€</div>
      </div>

      {/* Delivery Time (automatically calculated) */}
      <div>Delivery: {state.projectInfo.deliveryTime}</div>
    </div>
  );
}
```

### Example: Preview Page

```typescript
'use client';

import { useProposal } from '@/contexts/ProposalContext';

export default function PreviewPage() {
  const { state, updateService, isValid, getValidationErrors } = useProposal();

  const handleGenerate = async () => {
    if (!isValid()) {
      alert('Errors: ' + getValidationErrors().join(', '));
      return;
    }

    // Generate proposal
    const response = await fetch('/api/generate-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  };

  return (
    <div>
      <h1>Preview</h1>

      {/* All data is already in state - no need to load from localStorage! */}
      <div>Client: {state.clientInfo.companyName}</div>
      <div>Project: {state.projectInfo.projectName}</div>

      {/* Edit service quantities in preview */}
      {state.services.map(service => (
        <div key={service.id}>
          <input
            type="number"
            value={service.quantity}
            onChange={(e) => updateService(service.id, {
              quantity: parseInt(e.target.value) || 1
            })}
          />
          {/* Price updates automatically! */}
          <span>{service.totalPrice}€</span>
        </div>
      ))}

      <button onClick={handleGenerate}>Generate Proposal</button>
    </div>
  );
}
```

## Benefits

### Before (Old System)
- ❌ State scattered across multiple files
- ❌ Manual localStorage management
- ❌ Duplicate code for calculations
- ❌ Preview page loads from localStorage (not in sync)
- ❌ Hard to maintain and debug

### After (New System)
- ✅ Single source of truth for all data
- ✅ Automatic calculations (price, delivery time)
- ✅ Auto-save every 5 seconds
- ✅ Both pages always in sync (share same state)
- ✅ Easy to add new features
- ✅ Type-safe with TypeScript
- ✅ Validation built-in

## Data Flow

```
User Action (Add Service)
        ↓
useProposal().addService()
        ↓
ProposalContext.addService()
        ↓
1. Gets service info from service_description.js
2. Calculates default price
3. Adds to state.services
        ↓
useEffect detects state.services changed
        ↓
Automatically triggers:
  - recalculatePricing()
  - updateDeliveryTime()
        ↓
State updated with new totals and delivery time
        ↓
Auto-save to localStorage (5 sec delay)
        ↓
UI re-renders with new data
```

## Migration Guide

To migrate existing pages to use the new system:

1. **Replace useState with useProposal:**
```typescript
// OLD
const [services, setServices] = useState([]);

// NEW
const { state, addService, updateService } = useProposal();
// Use: state.services
```

2. **Remove manual localStorage code:**
```typescript
// OLD
useEffect(() => {
  localStorage.setItem('data', JSON.stringify(data));
}, [data]);

// NEW
// Auto-save happens automatically!
```

3. **Replace manual calculations:**
```typescript
// OLD
const total = services.reduce((sum, s) => sum + s.price * s.quantity, 0);

// NEW
const total = state.pricing.totalGrossPrice;
// Automatically calculated!
```

## Advanced Features

### Custom Pricing Hook

For complex pricing calculations:

```typescript
import { useServicePricing } from '@/hooks/useServicePricing';

const { calculateServicePrice, getUnitPrice } = useServicePricing();

const price = calculateServicePrice('exterior-ground', 3, {
  buildingType: 'mfh'
});
```

### Validation

```typescript
const { isValid, getValidationErrors } = useProposal();

if (!isValid()) {
  const errors = getValidationErrors();
  // ["Client company name is required", "At least one service must be selected"]
}
```

## Testing

The new architecture is easier to test:

```typescript
// Wrap test component with ProposalProvider
<ProposalProvider>
  <YourComponent />
</ProposalProvider>
```

## Future Enhancements

- [ ] Add undo/redo functionality
- [ ] Add proposal templates
- [ ] Add collaborative editing (multi-user)
- [ ] Add version history
- [ ] Export/import proposals
