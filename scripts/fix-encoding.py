"""Fix UTF-8 corruption caused by repeated Latin-1 reads + UTF-8 writes.

Original  -> Round 1 corruption   -> Round 2 corruption
  ó (c3 b3) -> "Ã³" (c3 83 c2 b3) -> "ÃƒÂ³" (c3 83 c6 92 c3 82 c2 b3)
  ñ (c3 b1) -> "Ã±" (c3 83 c2 b1) -> "ÃƒÂ±" (c3 83 c6 92 c3 82 c2 b1)

We replace 2-round patterns first, then 1-round patterns.
"""
import os
import sys

# Map each corrupted pattern (bytes) to the correct UTF-8 bytes of the original char.
# Format: (corrupted_bytes, original_utf8_bytes)

# 2-round corruptions (most damaged, fix first)
PATTERNS_2 = [
    # ó: c3 83 c6 92 c3 82 c2 b3
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xb3', 'ó'.encode('utf-8')),
    # ñ: c3 83 c6 92 c3 82 c2 b1
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xb1', 'ñ'.encode('utf-8')),
    # á: c3 83 c6 92 c3 82 c2 a1
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xa1', 'á'.encode('utf-8')),
    # é: c3 83 c6 92 c3 82 c2 a9
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xa9', 'é'.encode('utf-8')),
    # í: c3 83 c6 92 c3 82 c2 ad
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xad', 'í'.encode('utf-8')),
    # ú: c3 83 c6 92 c3 82 c2 ba
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xba', 'ú'.encode('utf-8')),
    # Á: c3 83 c6 92 c3 82 c2 81
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x81', 'Á'.encode('utf-8')),
    # É: c3 83 c6 92 c3 82 c2 89
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x89', 'É'.encode('utf-8')),
    # Í: c3 83 c6 92 c3 82 c2 8d
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x8d', 'Í'.encode('utf-8')),
    # Ó: c3 83 c6 92 c3 82 c2 93
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x93', 'Ó'.encode('utf-8')),
    # Ú: c3 83 c6 92 c3 82 c2 9a
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x9a', 'Ú'.encode('utf-8')),
    # Ñ: c3 83 c6 92 c3 82 c2 91
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\x91', 'Ñ'.encode('utf-8')),
    # ¡: c3 83 c6 92 c3 82 c2 a1 (already in á)
    # ¿: c3 83 c6 92 c3 82 c2 bf
    (b'\xc3\x83\xc6\x92\xc3\x82\xc2\xbf', '¿'.encode('utf-8')),
]

# 1-round corruptions
PATTERNS_1 = [
    (b'\xc3\x83\xc2\xb3', 'ó'.encode('utf-8')),
    (b'\xc3\x83\xc2\xb1', 'ñ'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa1', 'á'.encode('utf-8')),
    (b'\xc3\x83\xc2\xa9', 'é'.encode('utf-8')),
    (b'\xc3\x83\xc2\xad', 'í'.encode('utf-8')),
    (b'\xc3\x83\xc2\xba', 'ú'.encode('utf-8')),
    (b'\xc3\x83\xc2\x81', 'Á'.encode('utf-8')),
    (b'\xc3\x83\xc2\x89', 'É'.encode('utf-8')),
    (b'\xc3\x83\xc2\x8d', 'Í'.encode('utf-8')),
    (b'\xc3\x83\xc2\x93', 'Ó'.encode('utf-8')),
    (b'\xc3\x83\xc2\x9a', 'Ú'.encode('utf-8')),
    (b'\xc3\x83\xc2\x91', 'Ñ'.encode('utf-8')),
    (b'\xc3\x83\xc2\xbf', '¿'.encode('utf-8')),
    # Also fix single byte '?' that PowerShell substituted for non-ASCII
    # (skip - too aggressive)
]

# Special-case corruptions (Windows editor mojibake — non-standard pattern)
# These are visual Latin-1 renderings of UTF-8 bytes that were re-saved
# as UTF-8 a second time. They show up as Ô£ô (was ✓) and ÔÅ│ (was ⏳).
PATTERNS_SPECIAL = [
    (b'\xc3\x94\xc2\xa3\xc3\xb4', '✓'.encode('utf-8')),  # U+2713 CHECK MARK
    (b'\xc3\x94\xc3\x85\xe2\x94\x82', '⏳'.encode('utf-8')),  # U+23F3 HOURGLASS
    # "Garbage box-drawing prefix" pattern: some editors insert ├ (U+251C,
    # 0xe2 0x94 0x9c) before accented characters. Strip the prefix and keep
    # the actual character. e.g. ├ô -> Ó, ├ì -> Í, ├ë -> É, ├▒ -> ñ.
    (b'\xe2\x94\x9c\xe2\x96\x92', 'ñ'.encode('utf-8')),
    (b'\xe2\x94\x9c\xc3\xb4', 'Ó'.encode('utf-8')),
    (b'\xe2\x94\x9c\xc3\xac', 'Í'.encode('utf-8')),
    (b'\xe2\x94\x9c\xc3\xab', 'É'.encode('utf-8')),
]

def fix_file(path: str) -> bool:
    """Fix UTF-8 corruption in a single file. Returns True if changed."""
    try:
        with open(path, 'rb') as f:
            original = f.read()
    except Exception as e:
        print(f'  ERR reading {path}: {e}')
        return False

    data = original
    # Apply 2-round first (longer patterns), then 1-round, then special cases
    for pattern, replacement in PATTERNS_2:
        data = data.replace(pattern, replacement)
    for pattern, replacement in PATTERNS_1:
        data = data.replace(pattern, replacement)
    for pattern, replacement in PATTERNS_SPECIAL:
        data = data.replace(pattern, replacement)

    if data == original:
        return False

    try:
        with open(path, 'wb') as f:
            f.write(data)
        return True
    except Exception as e:
        print(f'  ERR writing {path}: {e}')
        return False

def main():
    roots = [
        r'D:\projects\PERSONAL\afamar\afamar-frontend\src',
        r'D:\projects\PERSONAL\afamar\afamar-backend\app',
    ]
    fixed_count = 0
    file_count = 0

    for root in roots:
        if not os.path.isdir(root):
            continue
        for dirpath, dirs, files in os.walk(root):
            for f in files:
                if not f.endswith(('.tsx', '.ts', '.css', '.html', '.py')):
                    continue
                p = os.path.join(dirpath, f)
                file_count += 1
                if fix_file(p):
                    fixed_count += 1
                    print(f'Fixed: {p.replace(root, "")}')

    print(f'\n{fixed_count}/{file_count} files modified')

if __name__ == '__main__':
    main()
