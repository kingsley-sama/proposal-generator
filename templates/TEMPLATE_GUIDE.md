# Word Template Guide

This guide explains how to set up placeholders in your Word template (`proposal-template.docx`) for automatic data population.

## Basic Placeholders

Replace text in your Word document with these placeholders (use curly braces):

### Client Information
- `{companyName}` - Client company name
- `{street}` - Street address
- `{postalCode}` - Postal code
- `{city}` - City name
- `{country}` - Country (default: Deutschland)

### Project Information
- `{offerNumber}` - Auto-generated offer number
- `{date}` - Current date (DD.MM.YYYY)
- `{offerValidUntil}` - Offer expiration date
- `{deliveryTime}` - Delivery time (e.g., "14-21 Werktage")
- `{projectName}` - Project name (optional)
- `{projectNumber}` - Project number (optional)

### Pricing
- `{subtotalNet}` - Subtotal (net)
- `{totalNetPrice}` - Total net price
- `{totalVat}` - VAT amount (19%)
- `{totalGrossPrice}` - Total gross price

### Discount (conditional)
- `{hasDiscount}` - Boolean flag
- `{discountDescription}` - Discount description
- `{discountAmount}` - Discount amount
- `{discountType}` - % or €

### Signature
- `{signatureName}` - Name of person signing

### Company Footer
- `{companyName_footer}` - ExposeProfi.de
- `{companyLegal}` - EPCS GmbH
- `{companyManager}` - Manager name
- `{companyAddress}` - Company address
- `{companyRegister}` - Company registration
- `{companyTaxId}` - Tax ID
- `{companyVatId}` - VAT ID
- `{bankName}` - Bank name
- `{bankIban}` - IBAN
- `{contactEmail}` - Email
- `{contactWeb}` - Website
- `{contactPhone}` - Phone

## Loops (for repeating sections)

### Services Table
```
{#services}
{quantity}  {name}  {description}  {unitPrice} €
{/services}
```

Use `{#services}{/services}` to loop through all services. Include these placeholders inside:
- `{quantity}` - Number of units
- `{name}` - Service name
- `{description}` - Formatted service description with bullet points
- `{unitPrice}` - Unit price in EUR format (1.234,56)

### Images Section
```
{#images}
{title}
{description}
{/images}
```

Use `{#images}{/images}` to loop through all images:
- `{title}` - Image title
- `{description}` - Image description
- `{hasImage}` - Boolean flag if image data exists

## Conditional Sections

Use conditions to show/hide content:

```
{#hasDiscount}
Rabatt: {discountDescription}
- {discountAmount} {discountType}
{/hasDiscount}
```

Available conditions:
- `{#hasDiscount}{/hasDiscount}` - Show only if discount exists
- `{#hasServices}{/hasServices}` - Show only if services exist
- `{#hasImages}{/hasImages}` - Show only if images exist

## Example Template Structure

```
ExposeProfi Logo

Angebot für {companyName}
{street}
{postalCode} {city}
{country}

Angebot Nr. {offerNumber}
Datum: {date}

Sehr geehrte Damen und Herren,

[Your introduction text here]

Leistungen:
{#services}
{quantity}x {name}
{description}
Preis: {unitPrice} €
{/services}

Zusammenfassung:
Zwischensumme (Netto): {subtotalNet} €
{#hasDiscount}
Rabatt ({discountDescription}): -{discountAmount} {discountType}
{/hasDiscount}
Summe (Netto): {totalNetPrice} €
MwSt. (19%): {totalVat} €
Gesamtbruttopreis: {totalGrossPrice} €

Gültig bis: {offerValidUntil}
Lieferzeit: {deliveryTime}

Mit freundlichen Grüßen
{signatureName}

---
Footer:
{companyName_footer}
{companyLegal}
{bankName}
{bankIban}
{contactEmail} | {contactWeb} | {contactPhone}
```

## Tips for Template Creation

1. **Use styles**: Apply Word styles (Heading 1, Heading 2, etc.) for consistent formatting
2. **Tables**: Services work best in a table format
3. **Line breaks**: Use Shift+Enter within placeholders if needed
4. **Test**: After editing, test by generating a proposal to ensure all placeholders work
5. **Backup**: Keep a backup of your template before making major changes

## Formatting Notes

- Prices are automatically formatted as: 1.234,56 €
- Dates are formatted as: DD.MM.YYYY
- Service descriptions include bullet points (• for main, ○ for sub-bullets)
- Empty/null values show as empty strings

## Troubleshooting

If placeholders don't work:
1. Check spelling (case-sensitive)
2. Ensure proper syntax: `{placeholder}` not `{{placeholder}}`
3. For loops, ensure opening `{#loop}` and closing `{/loop}` tags match
4. Check server logs for detailed error messages
