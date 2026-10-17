# strip the ```js fence pull.py leaves on (its regex knows ts only), then optionally splice the code into a file
# between a start marker line and an end marker line (both inclusive are replaced).
#   python3 splice.py <candidate.js>                              strip the fence in place
#   python3 splice.py <candidate.js> <target> <start> <end|EOF>   also replace that block of target
import re, sys
c = sys.argv[1]; txt = open(c).read()
m = re.search(r'```(?:js|javascript|ts)?\n(.*?)```', txt, re.S)
code = m.group(1) if m else txt
open(c, 'w').write(code)
if len(sys.argv) > 2:
    tgt, start, end = sys.argv[2], sys.argv[3], sys.argv[4]
    src = open(tgt).read(); i = src.index(start)
    j = len(src) if end == 'EOF' else src.index(end, i) + len(end)
    open(tgt, 'w').write(src[:i] + code.rstrip('\n') + ('\n' if end == 'EOF' else '') + src[j:])
    print('spliced', len(code), 'characters into', tgt)
else:
    print('stripped', c, len(code))
