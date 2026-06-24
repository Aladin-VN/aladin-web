"""Fix all empty catch {} blocks in distributor pages and replace alert/confirm/prompt with toast/dialog."""
import re
import os

BASE = '/home/z/my-project/src/app/distributor'

# Files and their catch {} locations (line numbers from grep)
files_to_fix = {
    'analytics/page.tsx': [],
    'orders/[id]/page.tsx': [],
    'orders/page.tsx': [],
    'ar-ledger/page.tsx': [],
    'settlements/page.tsx': [],
    'inventory/page.tsx': [],
    'page.tsx': [],
    'ai-assistant/page.tsx': [],
    'pos/page.tsx': [],
    'pos/reconciliation/page.tsx': [],
}

def fix_empty_catch(filepath):
    """Replace empty catch {} with console.error + setLoading(false) where applicable."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Replace empty catch {} with proper error logging
    # Pattern 1: standalone catch {} on its own line
    content = re.sub(
        r'\} catch \{\}',
        '} catch (e) { console.error("[FETCH ERROR]", e); }',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        count = content.count('catch (e) { console.error') - original.count('catch (e) { console.error')
        print(f"  Fixed {count} empty catch blocks in {filepath}")
        return count
    return 0

def fix_alert_calls(filepath):
    """Replace alert() with toast from sonner."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Check if sonner toast is already imported
    has_toast_import = 'import { toast }' in content
    
    # Add toast import if needed and if there are alert calls
    if not has_toast_import and 'alert(' in content:
        # Add import after the first 'use client' line or at top
        if "'use client'" in content:
            content = content.replace(
                "'use client';",
                "'use client';\nimport { toast } from 'sonner';",
                1
            )
        else:
            content = "import { toast } from 'sonner';\n" + content
        has_toast_import = True
    
    # Replace alert(res.error?.message || ...) with toast.error(...)
    # Pattern: alert(res.error?.message || t('X', 'Y'))
    content = re.sub(
        r"alert\(res\.error\?\.message \|\| t\('([^']+)',\s*'([^']+)'\)\)",
        r'toast.error(res.error?.message || t("\1", "\2"))',
        content
    )
    
    # Pattern: alert(e.message || t('X', 'Y'))
    content = re.sub(
        r"alert\(e\.message \|\| t\('([^']+)',\s*'([^']+)'\)\)",
        r'toast.error(e.message || t("\1", "\2"))',
        content
    )
    
    # Pattern: alert(t('X', 'Y'))
    content = re.sub(
        r"alert\(t\('([^']+)',\s*'([^']+)'\)\)",
        r'toast.success(t("\1", "\2"))',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  Fixed alert() calls in {filepath}")
        return True
    return False

# Process all files
total_catches = 0
for rel_path in files_to_fix:
    filepath = os.path.join(BASE, rel_path)
    if os.path.exists(filepath):
        total_catches += fix_empty_catch(filepath)
        fix_alert_calls(filepath)

print(f"\nTotal empty catch blocks fixed: {total_catches}")