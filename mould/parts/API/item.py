# write one crew item line from a part brief:  python3 item.py A1 <brief.md> <items.jsonl>
import json, sys
ref, brief, out = sys.argv[1], sys.argv[2], sys.argv[3]
open(out, 'w').write(json.dumps({'ref': ref, 'text': open(brief).read()}) + '\n')
print(out, len(open(brief).read()), 'characters')
