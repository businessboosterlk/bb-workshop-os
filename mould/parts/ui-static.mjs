// THE STATIC CHECK FOR EVERY UI PART, written by Claude before any builder ran.
// node ui-static.mjs <candidate.ts> <selector> <ClassName> [--keep-motion]   -> PASS n/n or the failures
import { readFileSync } from 'node:fs';
const [src, sel, cls, ...fl] = process.argv.slice(2); const code = readFileSync(src, 'utf8'); const faults = []; let n = 0;
const t = (name, ok) => { n++; if (!ok) faults.push('FAILED: ' + name); };
const styles = (code.match(/styles:\s*\[\s*`([\s\S]*?)`\s*\]/) || [, ''])[1];
const tpl = (code.match(/template:\s*`([\s\S]*?)`\s*,\s*(styles|host|changeDetection|\})/) || [, ''])[1];
t('selector ' + sel, code.includes(`selector: '${sel}'`));
t('class ' + cls + ' exported', new RegExp(`export class ${cls}\\b`).test(code));
t('standalone', /standalone:\s*true/.test(code));
t('no svg typed by hand', !/<svg/i.test(code));
t('no em or en dash', !/[—–]/.test(code));
if (!fl.includes('--keep-colour')) t('no hex, rgb or named colour in styles', !/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black|red|green|blue|grey|gray)\b/.test(styles));
t('no box-shadow, no gradient', !/box-shadow|gradient\(/.test(styles));
t('no text-transform uppercase', !/uppercase/.test(styles));
if (!fl.includes('--keep-motion')) t('no animation loops or keyframes', !/@keyframes|animation\s*:/.test(styles));
t('no `any`', !/:\s*any\b|as any\b|<any>/.test(code));
t('no Date.now or new Date()', !/Date\.now\(\)|new Date\(\)/.test(code));
t('new control flow only (no NgIf, NgFor, CommonModule)', !/NgIf|NgFor|CommonModule|\*ngIf|\*ngFor/.test(code));
t('icons through bb-icon', !/<img[^>]+icon/i.test(tpl));
t('no comma before and/or in the words', !/,\s+(and|or|but|nor)\b/.test(tpl.replace(/\{\{[\s\S]*?\}\}/g, '')));
t('no font-family set', !/font-family/.test(styles));
console.log(faults.length ? 'FAIL ' + (n - faults.length) + '/' + n + '\n  ' + faults.join('\n  ') : 'PASS ' + n + '/' + n);
process.exit(faults.length ? 1 : 0);
