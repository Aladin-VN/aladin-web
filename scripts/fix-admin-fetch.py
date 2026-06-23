#!/usr/bin/env python3
"""Fix remaining adminFetch + .json() patterns robustly."""
import re, os, glob

pattern = re.compile(
    r'(const\s+(res|json|data|result)\s*=\s*await\s+adminFetch\([^)]*\);)\s*\n(\s*)(const\s+\w+\s*=\s*await\s+\2\.json\(\);)',
    re.MULTILINE
)

count = 0
for f in glob.glob('src/app/**/*.tsx', recursive=True) + glob.glob('src/app/**/*.ts', recursive=True):
    with open(f, 'r') as fh:
        content = fh.read()
    new_content = pattern.sub(r'\3\4', content)
    if new_content != content:
        with open(f, 'w') as fh:
            fh.write(new_content)
        count += 1
        print(f'Fixed: {f}')

print(f'\nTotal files fixed: {count}')