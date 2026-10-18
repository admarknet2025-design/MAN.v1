#!/usr/bin/env python3
"""Stamp every /assets/*.css and /assets/*.js reference in the HTML pages with a hash of the file's contents
(?v=<hash>). CSS and JS are served with a one-year immutable cache, so run this after editing any of them:

    python3 tools/stamp-assets.py
"""
import glob, hashlib, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = re.compile(r'(/assets/[A-Za-z0-9_./-]+\.(?:css|js))(?:\?v=[A-Za-z0-9._-]*)?(?=["\'])')

def stamp(match):
    path = match.group(1)
    full = os.path.join(ROOT, path.lstrip('/'))
    if not os.path.exists(full):
        raise SystemExit('missing asset: ' + path)
    return '%s?v=%s' % (path, hashlib.sha1(open(full, 'rb').read()).hexdigest()[:8])

changed = 0
for page in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    src = open(page, encoding='utf-8').read()
    out = REF.sub(stamp, src)
    if out != src:
        open(page, 'w', encoding='utf-8').write(out)
        changed += 1
print('stamped %d page(s)' % changed)
