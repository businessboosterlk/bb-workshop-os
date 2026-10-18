# Merge a crew answer into the worktree. Claude's merge tool, 17 Oct 2026 (PB copy: trailing empty lines of a BLOCK dropped).
#   python3 apply.py <job> <candidate-out.md>
# Reads the newest run of <job> in bb-crew/crew/out, saves the whole answer to <candidate-out.md>, then applies every
# part by its header line (one fenced block may hold several parts):
#   // FILE: <path>                                   the block replaces the whole file (path from the repo root)
#   // BLOCK: <path> | start=<text> | until=<text>     the block replaces target from the line holding start up to,
#                                                      not including, the next line holding until
import json, re, glob, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
job, cand = sys.argv[1], sys.argv[2]
txt = ''
if job == '--from': txt = open(cand).read()   # re-apply a saved answer (python3 apply.py --from <candidate.md>)
else:
    f = sorted(glob.glob(f'/Users/thulaibhassen/bb-systems/bb-crew/crew/out/{job}/run-2*.jsonl'))[-1]
    for l in open(f):
        r = json.loads(l); txt = r.get('out') or r.get('answer') or r.get('reply') or txt
    open(cand, 'w').write(txt)
blocks = re.findall(r'```[a-z]*\n(.*?)```', txt, re.S)
if not blocks: sys.exit('no code block in the answer')
# one fenced block may hold several parts, each opened by a header line: split on the headers
# [ \t]* not \s*: \s* let the split start on the empty line BEFORE a header and threw that line away (SPLIT S3, 18 Oct)
parts = re.split(r'(?m)^(?=[ \t]*//[ \t]*(?:FILE|BLOCK):)', '\n'.join(blocks))
for b in [x for x in parts if x.strip()]:
    head, _, code = b.partition('\n')
    m = re.match(r'\s*//\s*FILE:\s*(\S+)\s*$', head)
    if m:
        p = os.path.join(ROOT, m.group(1)); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w').write(code); print('file', m.group(1), len(code)); continue
    m = re.match(r'\s*//\s*BLOCK:\s*(\S+)\s*\|\s*start=(.*?)\s*\|\s*until=(.*?)\s*$', head)
    if m:
        p = os.path.join(ROOT, m.group(1)); src = open(p).read(); lines = src.split('\n')
        st, un = m.group(2).rstrip('`'), m.group(3).rstrip('`')   # a stray markdown backtick on a marker (b4 try 2)
        i = next(k for k, x in enumerate(lines) if st in x); j = next(k for k in range(i + 1, len(lines)) if un in lines[k])
        # drop only the one newline that ends the part: rstrip ate a block's own empty last line (SPLIT S3, 18 Oct)
        new = (code[:-1] if code.endswith('\n') else code).split('\n')
        # PB, 18 Oct: the crew leaves one empty line between parts; it belongs to no part, so trailing empty lines are dropped
        while len(new) > 1 and new[-1].strip() == '' and lines[j - 1].strip() != '': new.pop()
        out = lines[:i] + new + lines[j:]
        open(p, 'w').write('\n'.join(out)); print('block', m.group(1), 'lines', i + 1, 'to', j, 'replaced by', len(new)); continue
    print('SKIPPED a block with first line:', head[:120])
