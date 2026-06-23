#!/usr/bin/env python3
"""Fix adminFetch double-parse bug: remove redundant .json() calls after adminFetch().

adminFetch now returns parsed JSON directly. Files that do:
  const res = await adminFetch(...);
  const data = await res.json();  // BUG: res is already parsed
Need to be changed to just use `res` directly.
"""

import re
import os

# Files reported by the scan
FILES = [
    "src/app/group-buy/page.tsx",
    "src/app/products/categories/page.tsx",
    "src/app/products/page.tsx",
    "src/app/settings/page.tsx",
    "src/app/settings/users/page.tsx",
    "src/app/settlements/page.tsx",
    "src/app/supply-chain/distributors/page.tsx",
    "src/components/brokers/broker-detail-drawer.tsx",
    "src/components/brokers/broker-form-dialog.tsx",
    "src/components/credit/credit-adjust-dialog.tsx",
    "src/components/credit/repayment-dialog.tsx",
    "src/components/credit/transaction-ledger-dialog.tsx",
    "src/components/group-buy/deal-detail-drawer.tsx",
    "src/components/group-buy/deal-form-dialog.tsx",
    "src/components/merchandising/audit-review-dialog.tsx",
    "src/components/orders/order-create-dialog.tsx",
    "src/components/orders/order-detail-drawer.tsx",
    "src/components/promotions/promotion-form-dialog.tsx",
    "src/components/settings/user-detail-drawer.tsx",
    "src/components/shipments/shipment-create-dialog.tsx",
    "src/components/shipments/shipment-detail-drawer.tsx",
    "src/components/shops/shop-detail-drawer.tsx",
    "src/components/shops/shop-edit-dialog.tsx",
]

base = "/home/z/my-project"
fixed_count = 0
error_count = 0

for filepath in FILES:
    full = os.path.join(base, filepath)
    if not os.path.exists(full):
        print(f"MISSING: {filepath}")
        error_count += 1
        continue

    with open(full, 'r') as f:
        content = f.read()

    original = content

    # Pattern 1: const data = await res.json();
    # Where res was assigned from adminFetch
    content = re.sub(
        r'(const\s+(\w+)\s*=\s*await\s+adminFetch\([^)]*\);)\s*\n\s*(const\s+\w+\s*=\s*await\s+\2\.json\(\);)',
        r'\1',  # Remove the .json() line entirely
        content
    )

    # Pattern 2: direct chaining like (await adminFetch(...)).json()
    content = re.sub(
        r'\(await\s+adminFetch\(([^)]*)\)\)\s*\.json\(\)',
        r'await adminFetch(\1)',
        content
    )

    # Pattern 3: res = await adminFetch(...); ... json = await res.json();
    # More generic: any line with "await <var>.json()" where <var> was from adminFetch
    # Use a two-step approach: find the variable name, then remove the .json line
    # This is already handled by Pattern 1 for most cases

    if content != original:
        with open(full, 'w') as f:
            f.write(content)
        # Count how many .json() lines were removed
        removed = len(re.findall(r'\.json\(\)', original)) - len(re.findall(r'\.json\(\)', content))
        fixed_count += 1
        print(f"FIXED ({removed} .json() removed): {filepath}")
    else:
        # Try a more aggressive approach - search for any remaining pattern
        # Look for lines that have adminFetch and then later .json() on the same variable
        lines = content.split('\n')
        admin_vars = set()
        for i, line in enumerate(lines):
            m = re.search(r'const\s+(\w+)\s*=\s*await\s+adminFetch\(', line)
            if m:
                admin_vars.add(m.group(1))

        json_lines = []
        for i, line in enumerate(lines):
            for var in admin_vars:
                if f'await {var}.json()' in line:
                    json_lines.append((i, var))

        if json_lines:
            # Remove the .json() lines
            new_lines = []
            removed = 0
            for i, line in enumerate(lines):
                skip = False
                for li, var in json_lines:
                    if i == li:
                        skip = True
                        removed += 1
                        break
                if not skip:
                    new_lines.append(line)

            if removed > 0:
                with open(full, 'w') as f:
                    f.write('\n'.join(new_lines))
                fixed_count += 1
                print(f"FIXED ({removed} .json() removed, aggressive): {filepath}")
            else:
                print(f"NO CHANGE: {filepath}")
        else:
            print(f"NO CHANGE: {filepath}")

print(f"\nTotal: {fixed_count} fixed, {error_count} missing")