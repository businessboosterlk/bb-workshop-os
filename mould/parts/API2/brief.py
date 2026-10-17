# Expand a part brief template into the crew item line.   python3 brief.py <REF> <TEMPLATE.md> <items.jsonl>
# {{file:<path from repo root>}} pastes that file whole; {{lines:<path>:<from>:<to>}} pastes those lines (1 based).
# The expanded brief is saved next to the template as <TEMPLATE>.sent.md so the record shows exactly what the crew read.
import json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ref, tpl, out = sys.argv[1], sys.argv[2], sys.argv[3]
def rep(m):
    kind, arg = m.group(1), m.group(2)
    if kind == 'file': return open(os.path.join(ROOT, arg)).read().rstrip('\n')
    p, a, b = arg.rsplit(':', 2); return '\n'.join(open(os.path.join(ROOT, p)).read().split('\n')[int(a) - 1:int(b)])
text = re.sub(r'\{\{(file|lines):([^}]+)\}\}', rep, open(tpl).read())
open(tpl.replace('.md', '.sent.md'), 'w').write(text)
open(out, 'w').write(json.dumps({'ref': ref, 'text': text}) + '\n')
print(out, len(text), 'characters')
