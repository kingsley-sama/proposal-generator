#!/usr/bin/env node
/**
 * Fix template placeholders in proposal-template.docx
 * 
 * This script fixes common typos in the template XML by doing string replacements
 * on the raw document.xml inside the docx (which is a ZIP file).
 * 
 * Usage: node templates/fix-template.js
 */

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'proposal-template.docx');
const content = fs.readFileSync(templatePath);
const zip = new PizZip(content);
let xml = zip.files['word/document.xml'].asText();

// Helper: extract concatenated text content from XML
function getTextContent(xmlStr) {
  const parts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xmlStr)) !== null) parts.push(m[1]);
  return parts.join('');
}

console.log('\n=== Before fixes ===');
const textBefore = getTextContent(xml);
const conditionalBefore = textBefore.substring(
  textBefore.indexOf('Lieferweg') || 0,
  (textBefore.indexOf('Mit freundlichen') || textBefore.length) + 20
);
console.log(conditionalBefore);

let fixCount = 0;

// ── Fix 1: childeren -> children ──
const f1 = (xml.match(/childeren/g) || []).length;
if (f1 > 0) {
  xml = xml.replace(/childeren/g, 'children');
  console.log(`✅ Fix 1: childeren → children (${f1} occurrences)`);
  fixCount++;
}

// ── Fix 2: hasSmallvalue -> hasSmallValue (case on 'value') ──
// The text "hasSmallvalue" is split across XML nodes as "hasSmall" + "value"
// So we search for the text node ">value</w:t>" that comes shortly after ">hasSmall</w:t>"
// and also handle the unsplit case
if (xml.includes('hasSmallvalue')) {
  xml = xml.replace(/hasSmallvalue/g, 'hasSmallValue');
  console.log('✅ Fix 2a: hasSmallvalue → hasSmallValue (unsplit)');
  fixCount++;
}
// Handle split case: <w:t>hasSmall</w:t>...<w:t>value</w:t>
const hsPos = xml.indexOf('>hasSmall</w:t>');
if (hsPos > 0) {
  // Find the next text node containing 'value' within 500 chars  
  const searchRegion = xml.substring(hsPos, hsPos + 500);
  const valMatch = searchRegion.match(/>value<\/w:t>/);
  if (valMatch) {
    const valIdx = hsPos + valMatch.index;
    xml = xml.substring(0, valIdx) + '>Value</w:t>' + xml.substring(valIdx + '>value</w:t>'.length);
    console.log('✅ Fix 2b: hasSmall + value → hasSmall + Value (split nodes)');
    fixCount++;
  }
}

// ── Fix 3: sutotaNet -> subtotalNet ──
if (xml.includes('sutotaNet')) {
  xml = xml.replace(/sutotaNet/g, 'subtotalNet');
  console.log('✅ Fix 3: sutotaNet → subtotalNet');
  fixCount++;
}

// ── Fix 4: totalCrossPrice -> totalGrossPrice ──
if (xml.includes('totalCrossPrice')) {
  xml = xml.replace(/totalCrossPrice/g, 'totalGrossPrice');
  console.log('✅ Fix 4: totalCrossPrice → totalGrossPrice');
  fixCount++;
}

// ── Fix 5: estimatedDeliverDay -> estimatedDeliveryDay ──
if (xml.includes('estimatedDeliverDay') && !xml.includes('estimatedDeliveryDay')) {
  xml = xml.replace(/estimatedDeliverDay/g, 'estimatedDeliveryDay');
  console.log('✅ Fix 5: estimatedDeliverDay → estimatedDeliveryDay');
  fixCount++;
}

// ── Fix 6: #{hasLargeValue} -> {#hasLargeValue} ──
// The '#' character sits OUTSIDE the braces in its own text node.
// We need to:
//   a) Remove the standalone '#' text node before the '{' of hasLargeValue
//   b) Change the '{' to '{#' so it becomes {#hasLargeValue}
//
// Also fix broken closing: {#/hasLargeValue} -> {/hasLargeValue}

// Fix any {#/ back to {/  (from previous bad fix attempts)
if (xml.includes('{#/')) {
  xml = xml.replace(/\{#\//g, '{/');
  console.log('✅ Fix 6a: {#/ → {/ (closing tag fix)');
  fixCount++;
}

// Now handle the opening: find text '#' before hasLargeValue that's NOT inside a {}  
// We look for the first occurrence of hasLargeValue and work backwards
const hlvPos = xml.indexOf('hasLargeValue');
if (hlvPos > 0) {
  const region = xml.substring(Math.max(0, hlvPos - 3000), hlvPos);
  
  // Find all <w:t> nodes in this region
  const tNodeRegex = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
  const tNodes = [];
  let tm;
  while ((tm = tNodeRegex.exec(region)) !== null) {
    tNodes.push({ attrs: tm[1], text: tm[2], index: tm.index, fullMatch: tm[0] });
  }
  
  // Check if the last few text nodes form the pattern: '#', '{', 'hasLargeValue'
  // or '#', '{#', 'hasLargeValue'  
  // We need to find standalone '#' that's not part of a proper {# tag
  for (let i = tNodes.length - 1; i >= Math.max(0, tNodes.length - 5); i--) {
    const node = tNodes[i];
    if (node.text === '#') {
      // This is the standalone '#' — remove it
      const absIdx = Math.max(0, hlvPos - 3000) + node.index;
      // Remove the entire <w:r>...</w:r> containing this text node if it only contains '#'
      // For safety, just empty the text content
      xml = xml.substring(0, absIdx) + node.fullMatch.replace('>#<', '><') + xml.substring(absIdx + node.fullMatch.length);
      console.log('✅ Fix 6b: Removed standalone # text node');
      fixCount++;
      break;
    }
  }
  
  // Now ensure the opening tag for hasLargeValue has '{#'
  // Re-find hasLargeValue position (may have shifted)
  const hlvPos2 = xml.indexOf('hasLargeValue');
  if (hlvPos2 > 0) {
    const nearBefore = xml.substring(Math.max(0, hlvPos2 - 300), hlvPos2);
    // Check if there's already a '{#' before hasLargeValue
    if (nearBefore.includes('>{#<') || nearBefore.includes('>{#</w:t>')) {
      console.log('ℹ️  hasLargeValue already has {# opening');
    } else {
      // Find the last '>{' or '>{<' before hasLargeValue 
      // and check it's just '{' (not '{/' or '{#')
      const lastBraceIdx = nearBefore.lastIndexOf('>{');
      if (lastBraceIdx >= 0) {
        const charAfterBrace = nearBefore[lastBraceIdx + 2];
        if (charAfterBrace === '<' || charAfterBrace === undefined) {
          // It's just '{' — insert '#' after it
          const absPos = Math.max(0, hlvPos2 - 300) + lastBraceIdx + 2; // right after '{'
          xml = xml.substring(0, absPos) + '#' + xml.substring(absPos);
          console.log('✅ Fix 6c: Inserted # into { → {# for hasLargeValue opening');
          fixCount++;
        }
      }
    }
  }
}

// ── Fix 7: Handle the second (closing) hasLargeValue ──
// If there's a second 'hasLargeValue' for closing, ensure it's {/hasLargeValue}
const hlvPositions = [];
let searchPos = 0;
while ((searchPos = xml.indexOf('hasLargeValue', searchPos)) !== -1) {
  hlvPositions.push(searchPos);
  searchPos++;
}
if (hlvPositions.length >= 2) {
  // Second occurrence should be closing tag  
  const closePos = hlvPositions[1];
  const nearClose = xml.substring(Math.max(0, closePos - 200), closePos);
  // Should have '{/' before it
  if (!nearClose.includes('>{/<') && !nearClose.includes('>/<')) {
    console.log('⚠️  Second hasLargeValue may need manual closing tag fix');
  }
}

// Write back
zip.file('word/document.xml', xml);
const output = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(templatePath, output);

console.log(`\n✅ Done! Applied ${fixCount} fixes.`);

// Verify
console.log('\n=== After fixes ===');
const xmlAfter = zip.files['word/document.xml'].asText();
const textAfter = getTextContent(xmlAfter);
const conditionalAfter = textAfter.substring(
  textAfter.indexOf('Lieferweg') || 0,
  (textAfter.indexOf('Mit freundlichen') || textAfter.length) + 20
);
console.log(conditionalAfter);

// Try parsing with docxtemplater
console.log('\n=== Validation ===');
try {
  const Docxtemplater = require('docxtemplater');
  const ImageModule = require('docxtemplater-image-module-free');
  const content2 = fs.readFileSync(templatePath);
  const zip2 = new PizZip(content2);
  const imgMod = new ImageModule({ centered: false, getImage: () => Buffer.alloc(0), getSize: () => [100, 100] });
  const doc = new Docxtemplater(zip2, { modules: [imgMod], paragraphLoop: true, linebreaks: true, delimiters: { start: '{', end: '}' } });
  console.log('✅ Template parses successfully!');
} catch (e) {
  if (e.properties && e.properties.errors) {
    console.log('❌ Remaining errors:');
    e.properties.errors.forEach(err => console.log('  -', err.properties.explanation || err.message));
  } else {
    console.log('❌ Error:', e.message);
  }
}
