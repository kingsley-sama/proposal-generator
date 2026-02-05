# Word Template Setup

## 📁 Files in this folder:

- **`proposal-template.docx`** - Your main Word template (the "Angebot Deutschland 1.docx" file)
- **`TEMPLATE_GUIDE.md`** - Complete guide on how to add placeholders to your template
- **`show-data-structure.js`** - Helper script to see what data is available

## 🚀 Quick Start

### 1. Understand the available data
```bash
node templates/show-data-structure.js
```

This shows you all the placeholders you can use in your Word template.

### 2. Edit your Word template

Open `proposal-template.docx` in Microsoft Word and add placeholders:

**Simple placeholders:**
```
Company: {companyName}
Offer Number: {offerNumber}
Total: {totalGrossPrice} €
```

**Loop through services:**
```
{#services}
{quantity}x {name}
Description: {description}
Price: {unitPrice} €
{/services}
```

**Conditional sections:**
```
{#hasDiscount}
Discount: {discountDescription} - {discountAmount} {discountType}
{/hasDiscount}
```

### 3. Test your template

1. Fill out the form at http://localhost:3000
2. Click "Preview Proposal"
3. Click "Generate DOCX"
4. Check the generated file in the `output/` folder

## 📋 Common Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{companyName}` | Client company name | Mustermann GmbH |
| `{offerNumber}` | Offer number | 2026-01-29-8 |
| `{date}` | Current date | 29.01.2026 |
| `{totalGrossPrice}` | Total price | 1.234,56 |
| `{services}` | Array of services | Use with loop |
| `{images}` | Array of images | Use with loop |

See `TEMPLATE_GUIDE.md` for the complete list!

## 🎨 Design Tips

1. **Use Word Styles** - Apply Heading 1, Heading 2, etc. for consistent formatting
2. **Tables for Services** - Put service loops inside a table for better layout
3. **Headers/Footers** - Add company info in the footer with placeholders
4. **Images** - Leave space for images or use conditional sections
5. **Page Breaks** - Add page breaks where you want new pages

## ⚙️ How it works

1. You fill out the web form
2. Form data is sent to the API
3. API loads `proposal-template.docx`
4. Placeholders are replaced with actual data
5. New DOCX file is generated with all data filled in

## 🔧 Technical Details

- **Library used**: docxtemplater + pizzip
- **Template location**: `templates/proposal-template.docx`
- **Generator code**: `lib/template-docx-generator.js`
- **API endpoint**: `app/api/generate-proposal/route.ts`

## 📝 Example Template Structure

```
[Logo]

ANGEBOT

Kunde: {companyName}
{street}
{postalCode} {city}, {country}

Angebot-Nr: {offerNumber}
Datum: {date}
Gültig bis: {offerValidUntil}

LEISTUNGSÜBERSICHT

{#services}
┌────────────────────────────────────────────┐
│ {quantity}x {name}                         │
│ {description}                              │
│ Preis: {unitPrice} €                       │
└────────────────────────────────────────────┘
{/services}

PREISÜBERSICHT

Zwischensumme (Netto):     {subtotalNet} €
{#hasDiscount}
Rabatt ({discountDescription}): -{discountAmount} {discountType}
{/hasDiscount}
Summe (Netto):             {totalNetPrice} €
MwSt. (19%):               {totalVat} €
──────────────────────────────────────────
GESAMT (Brutto):           {totalGrossPrice} €

Lieferzeit: {deliveryTime}

Mit freundlichen Grüßen,
{signatureName}

──────────────────────────────────────────
{companyName_footer} | {companyLegal}
{contactEmail} | {contactWeb} | {contactPhone}
{bankName} | {bankIban}
```

## 🐛 Troubleshooting

**Placeholders not replaced?**
- Check spelling (case-sensitive!)
- Ensure format: `{placeholder}` not `{{placeholder}}`
- Check server logs for errors

**Loops not working?**
- Verify opening `{#services}` and closing `{/services}` tags
- Ensure they're on separate lines in the template

**Formatting looks wrong?**
- Use Word styles instead of manual formatting
- Check if placeholder is breaking across multiple text runs (retype it)

## 📚 More Help

- Full guide: `TEMPLATE_GUIDE.md`
- Data structure: Run `node templates/show-data-structure.js`
- Docxtemplater docs: https://docxtemplater.com/docs/get-started/

---

**Need help?** Check the console logs when generating proposals - they'll show detailed error messages if something goes wrong.
