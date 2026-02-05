# Proposal Generator - Next.js Application

A modern web application for generating professional German-language proposal documents (Angebote) using **Word templates**.

## 🎯 Overview

This application allows you to:
- Fill out a comprehensive proposal form with client info, services, pricing
- Preview proposals in a web interface with inline editing
- Generate professional Word documents using your custom template
- Auto-save form data to prevent data loss
- Manage discounts, images, and multiple service types

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### 3. Set Up Your Word Template

Your Word template (`Angebot Deutschland 1.docx`) is already in the `templates/` folder!

**To customize it:**
1. Read the guide: `templates/README.md`
2. See available data: `node templates/show-data-structure.js`
3. Edit `templates/proposal-template.docx` in Microsoft Word
4. Add placeholders like `{companyName}`, `{offerNumber}`, etc.

**Example placeholders:**
```
Company: {companyName}
Offer: {offerNumber}
Total: {totalGrossPrice} €

{#services}
  {quantity}x {name} - {unitPrice} €
{/services}
```

See `templates/TEMPLATE_GUIDE.md` for complete documentation.

## 📁 Project Structure

```
├── app/
│   ├── page.tsx                      # Main proposal form
│   ├── preview/page.tsx              # Proposal preview with editing
│   └── api/
│       ├── generate-proposal/        # DOCX generation endpoint
│       └── client-lookup/            # Client database lookup
├── components/
│   ├── ServiceItem.tsx               # Service selection component
│   ├── ImageUploadSection.tsx       # Image upload component
│   └── Summary.tsx                   # Pricing summary
├── lib/
│   ├── template-docx-generator.js   # 🆕 Template-based generator
│   ├── pure-docx-generator.js       # Legacy code generator
│   ├── utils.js                      # Database utilities
│   └── services.ts                   # Service definitions
├── templates/                         # 📄 Word templates
│   ├── proposal-template.docx        # Your main template
│   ├── README.md                     # Template setup guide
│   ├── TEMPLATE_GUIDE.md            # Placeholder reference
│   └── show-data-structure.js       # Data preview tool
└── output/                           # Generated documents

```

## 🎨 Features

### Form Features
- **14 Service Types** with dynamic pricing
- **Auto-save** every 5 seconds
- **Client lookup** from database
- **Image upload** with preview
- **Discount management** (percentage or fixed)
- **Delivery time** auto-calculation
- **Dark text** for excellent readability

### Preview Features
- **Inline editing** of all text fields
- **Bullet point management** (add/delete)
- **Real-time calculations** when editing
- **4-page document** preview
- **Print-ready layout** (A4 format)

### Document Generation
- **Template-based** - Easy to maintain
- **Word format** (.docx)
- **Auto-formatting** of prices and dates
- **Service loops** for multiple services
- **Conditional sections** (discounts, images)
- **Company branding** in footer

## ⚙️ Configuration

### Supabase (Optional)
For client database lookup, add credentials to `.env.local`:
```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_KEY=your-service-key
```

Without Supabase, the app works with mock data.

### Word Template
Your template is at `templates/proposal-template.docx`. To customize:
1. Open in Microsoft Word
2. Add placeholders (see `templates/README.md`)
3. Save and test by generating a proposal

## 🔧 Development

### Key Technologies
- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **docxtemplater** - Word template engine
- **Supabase** - Optional database

### Important Files
- **Form logic**: `app/page.tsx` (~1000 lines)
- **Preview logic**: `app/preview/page.tsx` (~780 lines)
- **Template generator**: `lib/template-docx-generator.js` (~200 lines) ✅ Simple!
- **Legacy generator**: `lib/pure-docx-generator.js` (~1730 lines) ❌ Complex

### Why Template-Based?

**Before (pure-docx-generator.js):**
- 1730 lines of code
- Hard to maintain formatting
- Developers needed for design changes
- Complex table/paragraph generation

**After (template-docx-generator.js):**
- 200 lines of code
- Edit in Word WYSIWYG
- Non-developers can update design
- Simple placeholder replacement

## 📝 Usage Flow

1. **Fill Form** → Enter client info, select services, add images
2. **Preview** → Click "Preview Proposal" to see formatted document
3. **Edit** → Click any text in preview to edit inline
4. **Generate** → Click "Generate DOCX" to create Word file
5. **Download** → File saved to `output/[client]/[filename].docx`

## 🐛 Troubleshooting

**Placeholders not working?**
- Check `templates/README.md` for placeholder syntax
- Run `node templates/show-data-structure.js` to see available data
- Check server console for detailed errors

**Supabase errors?**
- The app works without Supabase (uses mock data)
- Add credentials to `.env.local` for real database features

**Generated document looks wrong?**
- Edit `templates/proposal-template.docx` in Word
- Use Word styles (Heading 1, 2, etc.) for formatting
- Test changes by generating a new proposal

## 📚 Documentation

- **Template Setup**: `templates/README.md`
- **Placeholder Guide**: `templates/TEMPLATE_GUIDE.md`
- **Data Structure**: Run `node templates/show-data-structure.js`
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

## 🚢 Deployment

```bash
npm run build
npm run start
```

Or deploy to Vercel:
```bash
vercel
```

## 📄 License

This project is for internal use.
