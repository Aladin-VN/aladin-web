const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const bin = path.join(ROOT, 'node_modules', '.bin', 'prisma');

console.log('Generating Prisma client for PostgreSQL...');
try {
  const out = execSync(`"${bin}" generate`, { 
    cwd: ROOT, 
    timeout: 180000, 
    stdio: 'inherit',
  });
  console.log('Prisma client generated');
} catch(e) {
  console.log('Generate failed (non-fatal)');
}

console.log('\nPushing schema to Neon PostgreSQL...');
try {
  const out2 = execSync(`"${bin}" db push --accept-data-loss`, { 
    cwd: ROOT, 
    timeout: 180000, 
    stdio: 'inherit',
  });
  console.log('Schema pushed!');
} catch(e) {
  console.log('Push failed');
}