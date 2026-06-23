#!/usr/bin/env python3
"""Thorough fix for adminFetch double-parse bug."""

import re
import os

base = "/home/z/my-project"

# Find ALL tsx/ts files that have both adminFetch and .json()
result = os.popen(f"cd {base} && rg -l 'adminFetch\\(' src/ --type ts").read().strip().split('\n')

total_fixed = 0
for filepath in result:
    filepath = filepath.strip()
    if not filepath:
        continue
    full = os.path.join(base, filepath)
    if not os.path.exists(full):
        continue

    with open(full, 'r') as f:
        lines = f.readlines()

    # Find all: const <var> = await adminFetch(
    # Then find any: const/let <var2> = await <var>.json()
    # Also: if (await <var>.json()) patterns
    # Also: any standalone await <var>.json() line

    # Track which lines to remove
    lines_to_remove = set()
    # Track variable renames: if `const data = await res.json()` -> rename `data` to `res` in subsequent code
    var_renames = {}  # json_var -> adminFetch_var

    i = 0
    while i < len(lines):
        line = lines[i]
        # Pattern: const X = await adminFetch(
        m = re.match(r'\s*(?:const|let)\s+(\w+)\s*=\s*await\s+adminFetch\(', line)
        if m:
            af_var = m.group(1)
            # Look ahead for .json() usage on this variable
            j = i + 1
            while j < len(lines) and j < i + 10:  # look within 10 lines
                # Pattern 1: const X2 = await af_var.json();
                m2 = re.match(r'\s*(?:const|let)\s+(\w+)\s*=\s*await\s+' + re.escape(af_var) + r'\.json\(\);\s*\n', lines[j])
                if m2:
                    json_var = m2.group(1)
                    var_renames[json_var] = af_var
                    lines_to_remove.add(j)
                    break
                # Pattern 2: if (await af_var.json()) - inline
                m3 = re.search(r'await\s+' + re.escape(af_var) + r'\.json\(\)', lines[j])
                if m3:
                    # Replace inline: await X.json() -> X
                    lines[j] = re.sub(
                        r'await\s+' + re.escape(af_var) + r'\.json\(\)',
                        af_var,
                        lines[j]
                    )
                j += 1
        i += 1

    if not lines_to_remove and not var_renames:
        # Check for inline .json() patterns that weren't caught
        has_inline = False
        for i, line in enumerate(lines):
            if re.search(r'await\s+\w+\.json\(\)', line):
                # Verify it's after an adminFetch
                # Look backwards for the variable
                for k in range(max(0, i-5), i):
                    m = re.search(r'(?:const|let)\s+(\w+)\s*=\s*await\s+adminFetch\(', lines[k])
                    if m:
                        var = m.group(1)
                        if re.search(r'await\s+' + re.escape(var) + r'\.json\(\)', line):
                            lines[i] = re.sub(
                                r'await\s+' + re.escape(var) + r'\.json\(\)',
                                var,
                                line
                            )
                            has_inline = True
        if not has_inline:
            continue
        # Re-read modified lines
        with open(full, 'r') as f:
            content = f.read()
        # Apply inline fixes
        lines = content.split('\n')
        lines = [line + '\n' for line in lines[:-1]] + [lines[-1]]

    if lines_to_remove or var_renames:
        # Remove marked lines
        new_lines = []
        for i, line in enumerate(lines):
            if i not in lines_to_remove:
                # Apply variable renames in remaining lines
                modified = line
                for json_var, af_var in var_renames.items():
                    # Replace json_var. with af_var. (but not json_var itself as standalone in other contexts)
                    # Be careful: only replace where json_var is used as the parsed result
                    modified = re.sub(r'\b' + re.escape(json_var) + r'\b', af_var, modified)
                new_lines.append(modified)

        with open(full, 'w') as f:
            f.writelines(new_lines)

        removed = len(lines_to_remove)
        renamed = len(var_renames)
        total_fixed += 1
        print(f"FIXED: {filepath} (removed={removed}, renamed={renamed})")

print(f"\nTotal files fixed: {total_fixed}")