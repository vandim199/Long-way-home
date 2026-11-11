// Inlines src/logic.js + src/ui.js into src/template.html -> index.html (one self-contained page).
// Asset references written as {{asset:assets/...}} become base64 data URIs, so the page still opens from file://.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
const MIME = { '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const logic = src('logic.js').replace(/if \(typeof module !== 'undefined'\)[\s\S]*$/, '');
let html = src('template.html').replace('/*LOGIC*/', () => logic).replace('/*UI*/', () => src('ui.js'));
let n = 0;
html = html.replace(/\{\{asset:([^}]+)\}\}/g, (_, rel) => {
  const file = path.join(root, rel.trim());
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('Unknown asset type: ' + rel);
  n++;
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
});
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built index.html (${html.length} bytes, ${n} assets inlined)`);
