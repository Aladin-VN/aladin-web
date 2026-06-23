#!/usr/bin/env python3
"""Properly fix all distributor pages to work with the shared layout.
Each page should return either:
  - <AdminHeader /> followed by content (if single root)
  - <> wrapper with <AdminHeader /> + content (if multiple roots like Dialogs)
"""

import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content

    # Remove any remaining </SidebarInset> tags
    content = re.sub(r'\s*</SidebarInset>\s*', '\n', content)
    
    # Fix the return statement pattern
    # Pattern: return (\n    <AdminHeader />\n or return (\n    <>\n    <AdminHeader />
    # Need to ensure proper JSX structure
    
    # Check if the page has Dialog/Sheet/Drawer components that need a Fragment wrapper
    has_dialog = bool(re.search(r'<Dialog\b|<Sheet\b|<Drawer\b|<AlertDialog\b', content))
    
    # Fix "return (\n    <AdminHeader />\n" pattern - wrap in Fragment if needed
    if has_dialog:
        # Ensure Fragment wrapper exists
        content = re.sub(
            r'  return \(\n    <AdminHeader />',
            '  return (\n    <>\n      <AdminHeader />',
            content
        )
        # Fix closing - change bare ");" to "</>  \n  );" before the final closing
        # The pattern is: last ");" or "  );" at end of function
        # We need to add </> before the closing
        
        # Find the last "  );" which is the return closing
        lines = content.split('\n')
        # Find the line with just ");" that closes the return
        for i in range(len(lines) - 1, -1, -1):
            if lines[i].strip() == ');' and i > 0:
                # Check if there's already a </> before it
                if i > 0 and '</>' not in lines[i-1]:
                    lines.insert(i, '    </>')
                break
        content = '\n'.join(lines)
    
    # Fix indentation: AdminHeader should have same indent as surrounding content
    # Remove extra indentation from the main content div
    # The content after <AdminHeader /> should be at the same level
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'  Updated: {filepath}')
        return True
    else:
        print(f'  No changes: {filepath}')
        return False

files = [
    'src/app/distributor/page.tsx',
    'src/app/distributor/inventory/page.tsx',
    'src/app/distributor/orders/page.tsx',
    'src/app/distributor/analytics/page.tsx',
    'src/app/distributor/ar-ledger/page.tsx',
    'src/app/distributor/settlements/page.tsx',
    'src/app/distributor/ai-assistant/page.tsx',
    'src/app/distributor/pos/page.tsx',
    'src/app/distributor/pos/reconciliation/page.tsx',
    'src/app/distributor/orders/[id]/page.tsx',
]

changed = 0
for f in files:
    if fix_file(f):
        changed += 1

print(f'\nTotal files changed: {changed}/{len(files)}')