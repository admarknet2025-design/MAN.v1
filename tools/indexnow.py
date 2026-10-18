#!/usr/bin/env python3
"""Tell Bing, Yandex and other IndexNow engines that pages changed (run after a deploy is live):

    python3 tools/indexnow.py                # every URL in sitemap.xml
    python3 tools/indexnow.py /dmc-2026 /    # just these paths

The key file bc4aec3cea68a7dee88d5fab257dd49b.txt must be live at https://mangh.org/bc4aec3cea68a7dee88d5fab257dd49b.txt first.
"""
import json, re, sys, urllib.request

HOST = 'mangh.org'
KEY = 'bc4aec3cea68a7dee88d5fab257dd49b'

if len(sys.argv) > 1:
    urls = ['https://%s%s' % (HOST, p if p.startswith('/') else '/' + p) for p in sys.argv[1:]]
else:
    urls = re.findall(r'<loc>([^<]+)</loc>', open('sitemap.xml', encoding='utf-8').read())

body = json.dumps({'host': HOST, 'key': KEY, 'keyLocation': 'https://%s/%s.txt' % (HOST, KEY), 'urlList': urls}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', body, {'Content-Type': 'application/json; charset=utf-8'})
with urllib.request.urlopen(req) as r:
    print('IndexNow accepted %d URL(s): HTTP %d' % (len(urls), r.status))
