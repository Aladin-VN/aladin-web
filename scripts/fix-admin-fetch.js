#!/usr/bin/env node
// Fix all adminFetch callers that do `const json = await res.json()` pattern
// Since adminFetch now returns parsed JSON directly, we need to inline it.

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'app');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Pattern 1: const res = await adminFetch(...);\n      const json = await res.json();
  // Replace with: const json = await adminFetch(...);
  const pattern1 = /const (res|json|data|result) = await adminFetch\(([^)]*)\);\s*\n(\s*)const (\w+) = await \1\.json\(\);/g;
  if (pattern1.test(content)) {
    content = content.replace(pattern1, (match, var1, args, indent, var2) => {
      return `const ${var2} = await adminFetch(${args});`;
    });
    changed = true;
  }

  // Pattern 2: When the first var is used for status check like `if (!res.ok)` before `.json()`
  // const res = await adminFetch(...);\n      if (!res.ok) ...\n      const json = await res.json();
  // This is trickier - for now skip these
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('Done!');