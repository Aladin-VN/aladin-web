const pptxgen = require('pptxgenjs');
const html2pptx = require('/home/z/my-project/skills/ppt/scripts/html2pptx');
const path = require('path');

const SLIDES_DIR = path.join(__dirname, 'slides');
const OUTPUT = '/home/z/my-project/download/ALADIN_B2B_Mobile_PWA_Summary.pptx';

const slideFiles = [
  'slide01-cover.html',
  'slide02-toc.html',
  'slide03-overview.html',
  'slide04-architecture.html',
  'slide05-sprint12.html',
  'slide06-sprint34.html',
  'slide07-sprint56.html',
  'slide08-sprint78.html',
  'slide09-database.html',
  'slide10-pwa.html',
  'slide11-structure.html',
  'slide12-metrics.html',
  'slide13-closing.html',
];

async function main() {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'ALADIN Team';
  pptx.title = 'ALADIN B2B Mobile PWA - Project Summary';

  const fontConfig = { cjk: 'Microsoft YaHei', latin: 'Corbel' };
  const allWarnings = [];

  for (const file of slideFiles) {
    const htmlPath = path.join(SLIDES_DIR, file);
    console.log(`Processing: ${file}`);
    const { slide, warnings } = await html2pptx(htmlPath, pptx, { fontConfig });
    if (warnings.length > 0) {
      console.warn(`  Warnings (${warnings.length}):`, warnings.join('; '));
    }
    allWarnings.push(...warnings);
  }

  await pptx.writeFile(OUTPUT);
  console.log(`\nDone! Saved to: ${OUTPUT}`);
  console.log(`Total warnings: ${allWarnings.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
