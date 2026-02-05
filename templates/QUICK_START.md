# 🎯 QUICK START: Edit Your Word Template

## Step 1: Open Your Template
Open `templates/proposal-template.docx` in Microsoft Word

## Step 2: Find Text to Replace
Look for text in your template that should be dynamic, for example:
- Company names
- Dates
- Prices
- Service lists

## Step 3: Replace with Placeholders

### Simple Text
Replace static text with placeholders in curly braces:

**Before:**
```
Firma Mustermann GmbH
Musterstraße 123
12345 München
```

**After:**
```
{companyName}
{street}
{postalCode} {city}
```

### Numbers/Prices
**Before:**
```
Gesamtpreis: 1.234,56 €
```

**After:**
```
Gesamtpreis: {totalGrossPrice} €
```

### Services Table
For repeating services, use a loop:

**Before (static):**
```
2x 3D Visualisierung - 399,00 €
1x Grundriss - 69,00 €
```

**After (dynamic):**
```
{#services}
{quantity}x {name} - {unitPrice} €
{/services}
```

### Optional Sections (like discounts)
**Before:**
```
Rabatt: Mengenrabatt - 50,00 €
```

**After:**
```
{#hasDiscount}
Rabatt: {discountDescription} - {discountAmount} {discountType}
{/hasDiscount}
```

## Step 4: Common Placeholders

Copy and paste these into your template:

### Header Section
```
{companyName}
{street}
{postalCode} {city}
{country}
```

### Offer Info
```
Angebot Nr: {offerNumber}
Datum: {date}
Gültig bis: {offerValidUntil}
Lieferzeit: {deliveryTime}
```

### Services Section (in a table)
```
| Anzahl | Bezeichnung | Beschreibung | Stückpreis |
|--------|-------------|--------------|------------|
{#services}
| {quantity} | {name} | {description} | {unitPrice} € |
{/services}
```

### Pricing Section
```
Zwischensumme (Netto): {subtotalNet} €

{#hasDiscount}
Rabatt ({discountDescription}): -{discountAmount} {discountType}
{/hasDiscount}

Summe (Netto): {totalNetPrice} €
MwSt. (19%): {totalVat} €
───────────────────────────────────
Gesamtbruttopreis: {totalGrossPrice} €
```

### Footer
```
{companyName_footer}
{companyLegal} | {companyManager}
{companyAddress}
{companyRegister} | {companyTaxId} | {companyVatId}

Bankverbindung:
{bankName} | {bankIban}

Kontakt:
{contactEmail} | {contactWeb} | {contactPhone}
```

## Step 5: Save and Test

1. **Save** your template (Ctrl+S)
2. **Go to** http://localhost:3000
3. **Fill out** the form
4. **Click** "Preview Proposal"
5. **Click** "Generate DOCX"
6. **Check** the generated file in `output/` folder

## 🎨 Design Tips

### Use Word Styles
- Select text → Styles → Heading 1, Heading 2, etc.
- This keeps formatting consistent

### Tables for Services
- Insert → Table → Create table
- Put service loop inside table rows
- Makes data look organized

### Bold Important Text
- **Bold** section headers
- **Bold** totals and prices
- Makes key info stand out

## ⚠️ Common Mistakes

❌ **Wrong**: `{{companyName}}` (double braces)
✅ **Correct**: `{companyName}` (single braces)

❌ **Wrong**: Placeholder split across multiple text runs
✅ **Correct**: Retype the placeholder in one go

❌ **Wrong**: Loop without closing tag
```
{#services}
{name}
```
✅ **Correct**: Always close loops
```
{#services}
{name}
{/services}
```

## 📋 Complete Placeholder List

Run this to see all available placeholders:
```bash
node templates/show-data-structure.js
```

Or check `templates/TEMPLATE_GUIDE.md` for the complete reference.

## 🆘 Need Help?

1. **Check the logs**: When you generate a document, check the terminal for error messages
2. **Read the guide**: `templates/TEMPLATE_GUIDE.md` has detailed explanations
3. **Test incrementally**: Add a few placeholders, test, add more
4. **Keep a backup**: Save a copy before making major changes

## 🎉 You're Ready!

Your Word template already has good structure and design. Just replace the static text with these placeholders and you'll have dynamic proposal generation!

---

**Pro Tip**: Start simple - replace just the company name and offer number first, test it, then add more placeholders gradually.
