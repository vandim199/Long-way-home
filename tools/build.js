// Inlines src/logic.js + src/ui.js into src/template.html -> index.html (one self-contained page).
const fs = require('fs');
const path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const logic = src('logic.js').replace(/if \(typeof module !== 'undefined'\)[\s\S]*$/, '');
const html = src('template.html').replace('/*LOGIC*/', () => logic).replace('/*UI*/', () => src('ui.js'));
fs.writeFileSync(path.join(__dirname, '..', 'index.html'), html);
console.log('Built index.html (' + html.length + ' bytes)');
