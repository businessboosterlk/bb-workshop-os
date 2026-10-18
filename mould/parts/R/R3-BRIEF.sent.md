PART R3 of the Workshop OS (a garage system). Web: Angular 19 TypeScript, standalone components, signals.

THE JOB. When the server refuses a save, the data service (`this.data`, a DataService) throws an Error whose `message` is plain words the person can read and whose `.status` is the HTTP code. Every screen that saves must catch that error and show the words. On three screens some save methods have no try at all, so a refused save shows nothing and the screen carries on as if it worked.

THE HOUSE PATTERN (copy it, do not invent another): a tap that saves shows a refusal as a toast:
`catch (e: any) { this.data.toast(e.message || '<fallback words>'); }`
`this.data.toast(text)` shows a toast for 3.2 seconds. Whatever ran after the await on success (closing a sheet, a success toast, navigating) stays INSIDE the try, after the await, so a refused save never closes the sheet or navigates.

FILE 1: apps/web/src/app/pages/workshop/enquiries.component.ts (methods of class WorkshopEnquiriesComponent, indented two spaces).
CURRENT LINES 238 to 244:
```ts
  async drop(ev: CdkDragDrop<EnquiryStatus>){
    const e: Enquiry = ev.item.data; const to = ev.container.data; if (!e || e.status === to) return;
    if (to === 'lost') { this.openLost(e); return; }
    if (to === 'quoted') { if (e.quoteId) { await this.data.updateEnquiry(e.id, { status: 'quoted', lostReason: undefined }); this.data.toast('Moved to Quoted'); } else this.toQuote(e); return; }
    if (to === 'booked') { if (e.jobId) { await this.data.updateEnquiry(e.id, { status: 'booked' }); this.data.toast('Moved to Booked'); } else this.toBook(e); return; }
    if (to === 'new') { await this.reopen(e); }
  }
```
CURRENT LINE 251:
```ts
  async reopen(e: Enquiry){ await this.data.updateEnquiry(e.id, { status: e.quoteId && e.status !== 'lost' ? 'quoted' : 'new', lostReason: undefined }); this.sel.set(null); this.data.toast('Back to New'); }
```
CURRENT LINES 265 to 266 (the last method and the class's closing brace):
```ts
  async lose(){ const e = this.losing(); if (!e) return; await this.data.loseEnquiry(e.id, this.reason); this.losing.set(null); this.data.toast('Marked lost'); }
}
```

FILE 2: apps/web/src/app/pages/workshop/quote.component.ts. CURRENT LINES 128 to 130 (methods of class WorkshopQuoteComponent):
```ts
  async sent(){ if (this.q.id && this.q.status === 'draft') { const r = await this.data.setQuoteStatus(this.q.id, 'sent'); if (r) this.q = structuredClone(r); } }
  async accept(){ if (!this.q.id) return; const saved = await this.save(); if (!saved) return; await this.data.setQuoteStatus(saved.id, 'accepted'); this.router.navigate(['/workshop/new'], { queryParams: { quote: saved.id } }); }
  async decline(){ if (!this.q.id) return; const r = await this.data.setQuoteStatus(this.q.id, 'declined'); if (r) this.q = structuredClone(r); this.data.toast('Quote declined. The enquiry is marked lost.'); }
```
Fact: `this.save()` already catches its own refusal (it shows it in the page's `err` signal and returns null). Leave the `const saved = await this.save(); if (!saved) return;` part as it is.

FILE 3: apps/web/src/app/pages/workshop/customers.component.ts. CURRENT LINES 173 to 174 (a method of class WorkshopCustomersComponent):
```ts
  async save(){ const a = this.active(); if (!a || !this.pick) return; await this.data.markFollowup(a.job.id, a.f.key, this.pick, this.note); this.active.set(null);
    this.data.toast(this.pick === 'issue' ? 'Saved. A new enquiry is waiting in Enquiries.' : 'Follow-up saved', this.pick === 'issue' ? '/workshop/enquiries' : undefined, 'Open'); }
```

WHAT TO WRITE. Return ONE ```ts code block holding five parts, each opened by its header line exactly as shown, in this order. Nothing between parts but the next header. Keep each method's line layout (one or two lines) like the original.

Part 1 header line: `// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async drop(ev: CdkDragDrop<EnquiryStatus>){ | until=  toQuote(e: Enquiry){`
The `drop` method (lines 238 to 244). Only the two `if (e.quoteId) { ... }` and `if (e.jobId) { ... }` branches change: each `await this.data.updateEnquiry(...); this.data.toast('Moved to ...');` pair goes inside `try { ... } catch (e2: any) { this.data.toast(e2.message || 'Could not move the enquiry'); }`. Name the catch variable `e2` because `e` is already the enquiry. Every other line of drop stays exactly as it is.

Part 2 header line: `// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async reopen(e: Enquiry){ | until=  openAdd(){`
The `reopen` method on one line: its three statements inside `try { ... }` followed by `catch (er: any) { this.data.toast(er.message || 'Could not reopen the enquiry'); }`.

Part 3 header line: `// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async lose(){ | until=}`
The `lose` method on one line: keep `const e = this.losing(); if (!e) return;` first, then the save, `this.losing.set(null);` and the success toast inside `try { ... }` followed by `catch (er: any) { this.data.toast(er.message || 'Could not mark it lost'); }`. Do NOT write the class's closing brace: the part ends with the lose method's own last brace.

Part 4 header line: `// BLOCK: apps/web/src/app/pages/workshop/quote.component.ts | start=  async sent(){ | until=  print(){`
The three methods, one line each:
- `sent`: the same guard; inside it `try { const r = await this.data.setQuoteStatus(this.q.id, 'sent'); if (r) this.q = structuredClone(r); } catch (e: any) { this.data.toast(e.message || 'Could not mark the quote sent'); }`.
- `accept`: the same first two statements; then `try { await this.data.setQuoteStatus(saved.id, 'accepted'); this.router.navigate(...the same arguments...); } catch (e: any) { this.data.toast(e.message || 'Could not mark the quote accepted'); }`.
- `decline`: the same guard; the rest inside `try { ... }` with `catch (e: any) { this.data.toast(e.message || 'Could not mark the quote declined'); }`.

Part 5 header line: `// BLOCK: apps/web/src/app/pages/workshop/customers.component.ts | start=  async save(){ const a = this.active(); | until=  openNew(){`
The `save` method on two lines like the original: keep `const a = this.active(); if (!a || !this.pick) return;` first; then `try {` the markFollowup await, `this.active.set(null);` and the whole success toast call exactly as written today `} catch (e: any) { this.data.toast(e.message || 'Could not save the follow-up'); } }`.

TRAPS.
- Never call a `this.data.<save>(` method outside a try whose catch shows the catch variable's `.message`.
- Do not add busy flags, signals, imports or template changes. Do not change any other line, style or wording.
- Fallback words exactly as given: British English, no em or en dash, no comma before and, or, but, nor.
