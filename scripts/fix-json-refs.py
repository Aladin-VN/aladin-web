#!/usr/bin/env python3
"""Fix orphaned json. references that should be the adminFetch variable name."""

import re
import os

base = "/home/z/my-project"

# Files with orphaned json. references
FILES = [
    "src/components/promotions/promotion-detail-drawer.tsx",
    "src/components/promotions/promotion-form-dialog.tsx",
    "src/components/group-buy/deal-form-dialog.tsx",
    "src/components/group-buy/deal-detail-drawer.tsx",
    "src/components/shops/shop-detail-drawer.tsx",
    "src/components/orders/order-detail-drawer.tsx",
    "src/components/merchandising/audit-review-dialog.tsx",
    "src/components/shops/shop-edit-dialog.tsx",
    "src/components/orders/order-create-dialog.tsx",
]

for filepath in FILES:
    full = os.path.join(base, filepath)
    if not os.path.exists(full):
        print(f"MISSING: {filepath}")
        continue

    with open(full, 'r') as f:
        content = f.read()

    # Find all adminFetch variable names in order
    af_vars = []
    for m in re.finditer(r'(?:const|let)\s+(\w+)\s*=\s*await\s+adminFetch\(', content):
        af_vars.append((m.start(), m.end(), m.group(1)))

    if not af_vars:
        print(f"NO adminFetch: {filepath}")
        continue

    # For each json. reference, find the nearest preceding adminFetch variable
    # Simple approach: find all json.success/json.data/json.error and check context
    original = content
    
    # Find all json. references
    json_refs = list(re.finditer(r'\bjson\.(success|data|error)', content))
    if not json_refs:
        print(f"NO json refs: {filepath}")
        continue

    # For each json. ref, find the nearest adminFetch var above it
    replacements = []  # (start, end, replacement)
    for jr in json_refs:
        # Find nearest adminFetch before this position
        nearest_var = None
        nearest_pos = -1
        for start, end, var in af_vars:
            if start < jr.start() and start > nearest_pos:
                nearest_var = var
                nearest_pos = start
        
        if nearest_var:
            # Check there's no `const json = ` between the adminFetch and this reference
            between = content[nearest_pos:jr.start()]
            if re.search(r'(?:const|let)\s+json\s*=', between):
                # json was properly defined, skip
                continue
            replacements.append((jr.start(), jr.end(), f'{nearest_var}.{jr.group(1)}'))

    # Apply replacements in reverse order
    for start, end, replacement in reversed(replacements):
        content = content[:start] + replacement + content[end:]

    if content != original:
        with open(full, 'w') as f:
            f.write(content)
        print(f"FIXED ({len(replacements)} refs): {filepath}")
    else:
        print(f"NO CHANGE: {filepath}")