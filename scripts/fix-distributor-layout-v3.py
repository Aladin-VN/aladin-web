#!/usr/bin/env python3
"""Final fix for all distributor pages.
Properly wraps content with <> where needed and fixes indentation.
"""

import re
import os

def find_main_return_range(lines):
    """Find the main component's return statement range."""
    # Find the last '  return (' at indent level 2 (main component, not sub-components)
    # Sub-components have '    return (' at indent 4
    last_main_return = None
    for i, line in enumerate(lines):
        if re.match(r'^  return \($', line):
            last_main_return = i
    
    if last_main_return is None:
        return None, None
    
    # Find the matching closing ');'
    # Count parentheses from the return statement
    depth = 0
    in_jsx = False
    for i in range(last_main_return, len(lines)):
        line = lines[i]
        # Count ( and ) but not inside strings
        in_string = False
        string_char = None
        for ch in line:
            if in_string:
                if ch == string_char and (i == 0 or line[i-1] != '\\'):
                    in_string = False
                continue
            if ch in ('"', "'", '`'):
                in_string = True
                string_char = ch
                continue
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
        
        if depth == 0 and i > last_main_return:
            return last_main_return, i
    
    return last_main_return, len(lines) - 1


def fix_page(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    lines = content.split('\n')
    
    # Check if page has Dialog/Sheet/Drawer components
    has_dialog = bool(re.search(r'<Dialog[\s/>]|<Sheet[\s/>]|<Drawer[\s/>]|<AlertDialog[\s/>]', content))
    
    # Find the main return statement
    start, end = find_main_return_range(lines)
    if start is None:
        print(f'  SKIP (no main return): {filepath}')
        return False
    
    # Extract the return body (between 'return (' and closing ')')
    return_body = lines[start+1:end]  # Lines between return ( and closing )
    
    # Check if it starts with <>
    starts_with_fragment = any(l.strip().startswith('<>') or l.strip().startswith('<AdminHeader') for l in return_body[:3])
    
    # Remove any existing <> and </> wrappers, AdminHeader should be preserved
    # Find AdminHeader line
    admin_header_idx = None
    for i, line in enumerate(return_body):
        if '<AdminHeader' in line:
            admin_header_idx = i
            break
    
    if admin_header_idx is None:
        print(f'  SKIP (no AdminHeader): {filepath}')
        return False
    
    # Extract everything from AdminHeader onwards
    content_lines = return_body[admin_header_idx:]
    
    # Clean up: remove any stray </SidebarInset>, </> at start/end
    cleaned = []
    for line in content_lines:
        if '</SidebarInset>' in line:
            continue
        cleaned.append(line)
    
    # Remove trailing </> if present (we'll add our own)
    while cleaned and cleaned[-1].strip() == '</>':
        cleaned.pop()
    
    # Remove leading <> if present
    if cleaned and cleaned[0].strip() == '<>':
        cleaned.pop(0)
    
    # Remove leading <> that's combined with AdminHeader
    # e.g., '<>    <AdminHeader />' - unlikely but handle
    
    # Re-indent: AdminHeader at 4 spaces, content at 4 spaces
    # Since these are inside return ( ), they should be at 4-space indent
    reindented = []
    for i, line in enumerate(cleaned):
        stripped = line.strip()
        if not stripped:
            reindented.append('')
            continue
        
        # Preserve JSX content but normalize indent
        # Remove leading whitespace and re-add at 4 spaces
        if i == 0:
            # AdminHeader line
            reindented.append(f'    {stripped}')
        else:
            # Calculate relative indent from original
            orig_indent = len(line) - len(line.lstrip())
            # The original content was at various indents; normalize to 4 + relative
            # For the first content line after AdminHeader, it was at indent 8 (2 tabs of 4)
            # Let's just dedent everything by finding the minimum indent
            pass
    
    # Actually, simpler approach: just dedent the content by the minimum indent
    # and re-indent at 4 spaces
    non_empty = [l for l in cleaned if l.strip()]
    if non_empty:
        min_indent = min(len(l) - len(l.lstrip()) for l in non_empty)
    else:
        min_indent = 0
    
    dedented = []
    for line in cleaned:
        if not line.strip():
            dedented.append('')
        else:
            dedented.append(line[min_indent:])
    
    # Re-indent at 4 spaces
    reindented = []
    for line in dedented:
        if not line.strip():
            reindented.append('')
        else:
            reindented.append('    ' + line)
    
    # Build the new return block
    if has_dialog:
        new_return = [
            '  return (',
            '    <>',
            *reindented,
            '    </>',
            '  );',
        ]
    else:
        # For pages without dialogs, check if there are multiple top-level elements
        # Count top-level elements (lines that start with < at indent 4)
        top_level = [l for l in reindented if l.strip().startswith('<') and not l.strip().startswith('</')]
        if len(top_level) <= 2:  # AdminHeader + one content div
            # Can use a single wrapper div or just let them be siblings
            # Actually in JSX you need a single root. Let's check if there's a wrapping div
            # Most pages have: AdminHeader + div.flex.flex-1.flex-col as siblings
            # These need a Fragment
            new_return = [
                '  return (',
                '    <>',
                *reindented,
                '    </>',
                '  );',
            ]
        else:
            new_return = [
                '  return (',
                '    <>',
                *reindented,
                '    </>',
                '  );',
            ]
    
    # Rebuild the file
    new_lines = lines[:start] + new_return + [''] + (lines[end+1:] if end+1 < len(lines) else [])
    new_content = '\n'.join(new_lines)
    
    if new_content != original:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f'  Fixed: {filepath}')
        return True
    else:
        print(f'  No change: {filepath}')
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
    try:
        if fix_page(f):
            changed += 1
    except Exception as e:
        print(f'  ERROR: {f}: {e}')

print(f'\nTotal files changed: {changed}/{len(files)}')