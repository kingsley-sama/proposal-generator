# Dynamic Service Descriptions - XXX Field System

## Overview

Service descriptions in `lib/service_description.js` contain **dynamic placeholders** (XXX, xx, ○ xxx) that get replaced with actual project data or allow custom user input.

## Types of Placeholders

### 1. Quantity Placeholders (XXX, XX)

**Purpose:** Automatically replaced with service quantity

**Example:**
```javascript
'Geliefert werden XXX gerenderte Außenansichten'
// If quantity = 3, becomes:
'Geliefert werden 3 gerenderte Außenansichten'
```

**Usage in service_description.js:**
- `XXX` - Multi-character quantity (e.g., "100")
- `XX` - Two-digit quantity (e.g., "10")

### 2. Project Name Placeholders ("XXX")

**Purpose:** Replaced with actual project name

**Example:**
```javascript
'des Objektes „XXX"'
// If projectName = "Villa Sonnenschein", becomes:
'des Objektes „Villa Sonnenschein"'
```

### 3. Custom Detail Placeholders (○ xxx, ○ …)

**Purpose:** Editable fields where users enter project-specific details

**Example:**
```javascript
description: [
  'Geliefert werden XXX gerenderte Außenansichten aus folgenden Perspektiven:',
  '○ xxx',  // User fills in: "Südseite vom Garten"
  '○ xxx',  // User fills in: "Haupteingang"
  'Fotorealistische Qualität'
]
```

## Implementation

### File Structure

```typescript
// utils/descriptionHelpers.ts
interface BulletPoint {
  text: string;              // The bullet content
  isEditable: boolean;       // Can user edit this?
  isPlaceholder: boolean;    // Is this a XXX placeholder?
  children?: BulletPoint[];  // Sub-bullets
}
```

### Automatic Detection

The system automatically identifies placeholders:

```typescript
const isPlaceholder = 
  text.includes('XXX') ||     // Quantity placeholder
  text.includes('xxx') ||     // Custom detail
  text.includes('○ …') ||     // Empty bullet
  text === '○ xxx';           // Editable bullet
```

### Parsing Service Descriptions

When a service is added:

```typescript
// In ProposalContext.addService()
const serviceInfo = serviceDescriptions[serviceId];

// Parse description into structured bullet points
const parsedDescription = parseServiceDescription(serviceInfo.description);
// Returns BulletPoint[] with editable fields marked

newService.customDescription = parsedDescription;
```

### User Editing

Users can:

1. **Edit placeholder fields** - Click yellow highlighted items
2. **Add custom bullets** - Add project-specific details
3. **Remove placeholders** - Delete unnecessary bullets
4. **Add sub-bullets** - Create nested details

```typescript
// Update a bullet point
updateServiceDescription(serviceId, [
  { text: 'Geliefert werden 3 Visualisierungen', isEditable: false },
  { text: '○ Südseite vom Garten', isEditable: true },
  { text: '○ Haupteingang', isEditable: true }
]);
```

### Generating Final Document

Before document generation, placeholders are replaced:

```typescript
// Get formatted description with all XXX replaced
const formatted = getFormattedDescription(serviceId);

// Returns array with:
// - XXX replaced with service.quantity
// - "XXX" replaced with projectInfo.projectName
// - User-edited custom details included
```

## Component Usage

### In Forms (Edit Mode)

```tsx
import { DynamicDescriptionEditor } from '@/components/DynamicDescriptionEditor';

<DynamicDescriptionEditor
  description={service.customDescription}
  onChange={(newDescription) => {
    updateServiceDescription(service.id, newDescription);
  }}
/>
```

**Features:**
- Yellow highlights for empty placeholders
- Click to edit
- Add/remove bullets
- Hover actions

### In Preview (Read-Only)

```tsx
import { ServiceDescriptionPreview } from '@/components/DynamicDescriptionEditor';

<ServiceDescriptionPreview
  description={service.customDescription}
  quantity={service.quantity}
  projectName={projectInfo.projectName}
/>
```

## Examples

### Example 1: Exterior Visualization

**service_description.js:**
```javascript
'exterior-ground': {
  description: [
    'Geliefert werden XXX gerenderte Außenansichten des Objektes „XXX" aus den folgenden Bodenperspektiven (siehe rote Pfeile):',
    '○ xxx',
    'Fotorealistische Qualität',
    'Format: 2.500 x 1.500 px (300 DPI)'
  ]
}
```

**User Input:**
- Quantity: 3
- Project name: "Villa Sonnenschein"
- Custom bullet: "Südseite vom Garten"

**Final Output:**
```
• Geliefert werden 3 gerenderte Außenansichten des Objektes „Villa Sonnenschein" aus den folgenden Bodenperspektiven (siehe rote Pfeile):
  ○ Südseite vom Garten
• Fotorealistische Qualität
• Format: 2.500 x 1.500 px (300 DPI)
```

### Example 2: Interior Visualization

**service_description.js:**
```javascript
'interior': {
  description: [
    'Geliefert werden XX gerenderte Innenansichten der Räume:',
    '○ …',
    'Fotorealistische Qualität',
    'Format: 2.500 x 1.500 px (300 DPI)'
  ]
}
```

**User Input:**
- Quantity: 5
- Custom bullets:
  - "Wohnzimmer"
  - "Küche"
  - "Schlafzimmer"
  - "Bad"
  - "Flur"

**Final Output:**
```
• Geliefert werden 5 gerenderte Innenansichten der Räume:
  ○ Wohnzimmer
  ○ Küche
  ○ Schlafzimmer
  ○ Bad
  ○ Flur
• Fotorealistische Qualität
• Format: 2.500 x 1.500 px (300 DPI)
```

## API Reference

### parseServiceDescription()

Converts raw description array into structured bullet points.

```typescript
parseServiceDescription(description: any[]): BulletPoint[]
```

### formatForTemplate()

Converts bullet points to template format with XXX replaced.

```typescript
formatForTemplate(
  bulletPoints: BulletPoint[],
  data: {
    quantity?: number;
    projectName?: string;
  }
): any[]
```

### shouldHighlightForEditing()

Checks if a bullet should be highlighted as needing input.

```typescript
shouldHighlightForEditing(text: string): boolean
```

### addCustomBulletPoint()

Adds a new editable bullet point.

```typescript
addCustomBulletPoint(
  description: BulletPoint[],
  afterIndex: number,
  isSubBullet?: boolean
): BulletPoint[]
```

### updateBulletPoint()

Updates text of a bullet point.

```typescript
updateBulletPoint(
  description: BulletPoint[],
  index: number,
  newText: string
): BulletPoint[]
```

## Validation

Before generating document, validate that all required fields are filled:

```typescript
import { validateServiceDescription } from '@/utils/descriptionHelpers';

const { isValid, errors } = validateServiceDescription(service.customDescription);

if (!isValid) {
  alert('Please fill in: ' + errors.join(', '));
}
```

## Best Practices

### 1. In service_description.js

```javascript
// ✅ Good - Clear placeholders
description: [
  'Geliefert werden XXX Visualisierungen',  // Clear quantity placeholder
  '○ xxx',                                    // Clear custom field
  'Fotorealistische Qualität'                // Static text
]

// ❌ Bad - Ambiguous
description: [
  'Geliefert werden X Visualisierungen',    // Use XXX not X
  'Details',                                 // No placeholder
  'Qualität'
]
```

### 2. When Creating Services

Always parse descriptions:

```typescript
// ✅ Good
const parsedDescription = parseServiceDescription(serviceInfo.description);
service.customDescription = parsedDescription;

// ❌ Bad
service.customDescription = serviceInfo.description; // Not parsed!
```

### 3. Before Document Generation

Always format descriptions:

```typescript
// ✅ Good
const formatted = getFormattedDescription(serviceId);
documentData.services = services.map(s => ({
  ...s,
  description: formatted
}));

// ❌ Bad
// Don't send raw customDescription with XXX placeholders!
```

## Troubleshooting

### Issue: XXX not being replaced

**Cause:** Description not formatted before sending to template.

**Solution:**
```typescript
const formatted = getFormattedDescription(serviceId);
```

### Issue: Yellow highlights not showing

**Cause:** Description not parsed when service added.

**Solution:**
```typescript
const parsed = parseServiceDescription(serviceInfo.description);
```

### Issue: Can't edit bullet points

**Cause:** Component not using DynamicDescriptionEditor.

**Solution:**
```tsx
<DynamicDescriptionEditor
  description={service.customDescription}
  onChange={(newDesc) => updateServiceDescription(serviceId, newDesc)}
/>
```

## Testing

Visit the example page:
```
http://localhost:3000/description-example
```

Try:
1. Adding services
2. Editing yellow highlighted fields
3. Adding custom bullets
4. Changing quantity (watch XXX update)
5. Preview final output

## Summary

- ✅ **XXX/XX** - Auto-replaced with quantity
- ✅ **"XXX"** - Auto-replaced with project name
- ✅ **○ xxx** - User fills in custom details
- ✅ **Yellow highlight** - Needs user input
- ✅ **Click to edit** - Modify any editable field
- ✅ **Add bullets** - Insert custom details
- ✅ **Preview** - See final output before generating
