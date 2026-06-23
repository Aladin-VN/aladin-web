#!/usr/bin/env python3
"""Refactor distributor pages to use the shared layout.
- Remove <>...</> wrapper
- Remove <AdminSidebar />
- Remove <SidebarInset>...</SidebarInset>
- Keep <AdminHeader /> and inner content
- Remove unused imports
"""

import re

def refactor_page(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content

    # For pages with a single main return (most pages):
    # Pattern: return (\n    <>\n      <AdminSidebar />\n      <SidebarInset>\n        <AdminHeader />\n
    #   ... content ...
    #       </SidebarInset>\n    </>\n  )
    
    # We need to handle the case where <AdminHeader /> is on same line as <SidebarInset>
    # or on next line
    
    # Pattern 1: <AdminSidebar /><SidebarInset><AdminHeader /> (same line - POS pages)
    content = re.sub(
        r'    <>\n      <AdminSidebar /><SidebarInset><AdminHeader />',
        '    <AdminHeader />',
        content
    )
    
    # Pattern 2: <AdminSidebar />\n      <SidebarInset>\n        <AdminHeader />
    content = re.sub(
        r'    <>\n      <AdminSidebar />\n      <SidebarInset>\n        <AdminHeader />',
        '    <AdminHeader />',
        content
    )
    
    # Remove closing </SidebarInset>\n    </>
    content = re.sub(
        r'      </SidebarInset>\n    </>',
        '',
        content
    )
    
    # Also handle case where </SidebarInset> has different indentation
    content = re.sub(
        r'    </SidebarInset>\n  </>',
        '',
        content
    )
    
    # For orders/[id]/page.tsx which has loading/error/main states all with the wrapper:
    # Remove all instances of <AdminSidebar /> and <SidebarInset>...</SidebarInset> wrappers
    # that are inside <>...</> fragments used as return values
    
    # Handle remaining <> wrapper with AdminSidebar/SidebarInset pattern
    content = re.sub(
        r'    <>\n        <AdminSidebar />\n        <SidebarInset>\n',
        '    ',
        content
    )
    content = re.sub(
        r'        </SidebarInset>\n      </>',
        '',
        content
    )
    
    # Remove unused imports
    content = re.sub(r"import \{ AdminSidebar \} from '@/components/layout/admin-sidebar';\n", '', content)
    content = re.sub(r"import \{ SidebarInset \} from '@/components/ui/sidebar';\n", '', content)
    
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
    if refactor_page(f):
        changed += 1

print(f'\nTotal files changed: {changed}/{len(files)}')