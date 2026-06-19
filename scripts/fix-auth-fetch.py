#!/usr/bin/env python3
"""Fix all admin page/component fetch calls to use adminFetch with auth token."""

import os
import re

BASE = '/home/z/my-project/src'

# Files to EXCLUDE (login/register pages that don't need auth)
EXCLUDE_PATTERNS = [
    'src/app/auth/login/page.tsx',
    'src/app/m/login/page.tsx',
    'src/app/m/register/page.tsx',
    'src/app/m/demo/page.tsx',
    'src/lib/admin-fetch.ts',
    'src/lib/mobile/api.ts',  # already has its own auth
]

# Collect all files to fix
files_to_fix = []

for root, dirs, files in os.walk(BASE):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            full = os.path.join(root, f)
            rel = os.path.relpath(full, '/home/z/my-project')
            if any(rel.startswith(ex) or rel == ex for ex in EXCLUDE_PATTERNS):
                continue
            # Check if file has fetch calls to /api/
            try:
                with open(full, 'r') as fh:
                    content = fh.read()
                if "fetch('" in content or 'fetch(`' in content or 'fetch("/' in content:
                    if '/api/' in content:
                        files_to_fix.append(full)
            except:
                pass

print(f"Found {len(files_to_fix)} files to fix")

for filepath in sorted(files_to_fix):
    rel = os.path.relpath(filepath, '/home/z/my-project')
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Check if already imports adminFetch
    has_import = "adminFetch" in content and "from '@/lib/admin-fetch'" in content

    # Add import after 'use client' or at the top
    if not has_import:
        if "'use client'" in content:
            content = content.replace(
                "'use client';",
                "'use client';\nimport { adminFetch } from '@/lib/admin-fetch';",
                1
            )
        elif '"use client"' in content:
            content = content.replace(
                '"use client";',
                '"use client";\nimport { adminFetch } from \'@/lib/admin-fetch\';',
                1
            )
        else:
            # Add at top
            content = "import { adminFetch } from '@/lib/admin-fetch';\n" + content

    # Replace fetch calls that go to /api/
    # Pattern: await fetch(`.../api/...) or await fetch('.../api/...) etc.
    # We need to replace 'await fetch(' with 'await adminFetch(' only for /api/ calls
    
    # Replace `await fetch(\`/api/...` patterns
    content = re.sub(r'await fetch\(`/api/', 'await adminFetch(`/api/', content)
    # Replace `await fetch('/api/...` patterns
    content = re.sub(r"await fetch\('/api/", "await adminFetch('/api/", content)
    # Replace `await fetch("/api/...` patterns
    content = re.sub(r'await fetch\("/api/', 'await adminFetch("/api/', content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        # Count changes
        changes = len(re.findall(r'await adminFetch\(', content)) - len(re.findall(r'await adminFetch\(', original))
        if has_import:
            changes_str = f"replaced {changes} fetch calls"
        else:
            changes_str = f"added import + replaced {changes} fetch calls"
        print(f"  ✓ {rel}: {changes_str}")
    else:
        # Check if there are /api/ fetch calls we missed
        if '/api/' in original and 'await fetch(' in original:
            print(f"  ? {rel}: has /api/ fetch but no changes made (check manually)")
        else:
            print(f"  - {rel}: skipped (no /api/ fetch calls)")

print("\nDone!")