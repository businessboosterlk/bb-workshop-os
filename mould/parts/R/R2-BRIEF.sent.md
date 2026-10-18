PART R2 of the Workshop OS (a garage system). Web: Angular 19 TypeScript, standalone components, signals.

THE JOB. When the server refuses a save, the data service (`this.data`, a DataService) now throws an Error whose `message` is plain words the person can read and whose `.status` is the HTTP code. Every screen that saves must catch that error and show the words. Today several save methods on two screens have a `try { ... } finally { ... }` with no catch, or no try at all, so a refused save shows nothing; and the customer page calls `data.rate(...)` straight from its template, where nothing can catch it.

THE HOUSE PATTERN (copy it, do not invent another):
- a tap that saves: `catch (e: any) { this.data.toast(e.message || '<fallback words>'); }`
- `this.data.toast(text)` shows a toast for 3.2 seconds.
- a busy flag set before a save is cleared in `finally { this.busy.set(false); }` (already there on the job card; keep it).

FILE 1: apps/web/src/app/pages/workshop/job.component.ts. CURRENT LINES 238 to 256 (methods of class WorkshopJobComponent, indented two spaces):
```ts
  async closePhase(){ if (!this.photo() || this.busy()) return; this.busy.set(true);
    try { const j = this.job()!; const label = this.data.phaseNow(j)?.label; await this.data.completePhase(j.id, this.photo(), this.note); this.closeSheet(); this.data.toast(label + ' done. The customer can see it.'); }
    catch (e: any) { this.data.toast(e.message || 'Could not close the phase'); } finally { this.busy.set(false); } }
  async moveDate(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPromise(this.id(), new Date(this.newDate + 'T17:00:00').toISOString(), this.reason); this.closeSheet(); this.data.toast('Date moved. The customer sees why.'); } finally { this.busy.set(false); } }
  async ask(){ if (this.busy()) return; this.busy.set(true); try { await this.data.askApproval(this.id(), this.askTitle, this.askDetail, this.askAmount ? Number(this.askAmount) : undefined); this.closeSheet(); this.data.toast('Sent to the customer'); } finally { this.busy.set(false); } }
  async savePickup(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPickup(this.id(), this.pk.wanted ? { ...this.pk } : { wanted: false, status: 'none' }); this.closeSheet(); this.data.toast('Pickup saved'); } finally { this.busy.set(false); } }
  async deliver(){ if (this.busy()) return; this.busy.set(true); try { await this.data.deliver(this.id()); this.closeSheet(); this.data.toast('Delivered. The car moves to history.'); } catch (e: any) { this.data.toast(e.message); } finally { this.busy.set(false); } }
  async saveMoney(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setMoney(this.id(), { estimate: +this.m.estimate || 0, approved: +this.m.approved || 0, paid: +this.m.paid || 0 }); this.closeSheet(); } finally { this.busy.set(false); } }
  /* the car's own fields on the job; the customer's name and phone through the customer, so the login follows */
  async saveEdit(){ if (this.busy()) return; this.err.set(''); const j = this.job(); if (!j) return;
    const phone = normalise(this.ex.phone); if (!phone) { this.err.set('The phone needs to be a Sri Lankan mobile, 07X XXX XXXX.'); return; }
    this.busy.set(true);
    try {
      const cu = this.data.customers().find(c => c.id === j.customerId);
      if (cu && (cu.name !== this.ex.name.trim() || cu.phone !== phone)) await this.data.saveCustomer({ id: cu.id, name: this.ex.name, phone, vehicles: cu.vehicles.map(v => ({ ...v, was: v.plate })) });
      await this.data.editJob(j.id, { plate: this.ex.plate, make: this.ex.make, model: this.ex.model, colour: this.ex.colour, branch: this.ex.branch, insurer: this.ex.insurer, notes: this.ex.notes });
      this.closeSheet(); this.data.toast('Changes saved');
    } catch (e: any) { this.err.set(e.message); } finally { this.busy.set(false); } }
  async saveNote(){ if (this.busy()) return; this.busy.set(true); try { await this.data.addNote(this.id(), this.noteText); this.closeSheet(); } finally { this.busy.set(false); } }
```

FILE 2: apps/web/src/app/pages/customer/job.component.ts. CURRENT LINE 67 (inside the component template):
```html
          <div class="stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="(j.rating || 0) >= s" (click)="data.rate(j.id, s)" [attr.aria-label]="s + ' stars'"><bb-icon name="star"/></button> }</div>
```
CURRENT LINE 118 (a method of class CustomerJobComponent, indented two spaces):
```ts
  async answer(a: Approval, yes: boolean){ await this.data.answerApproval(this.id(), a.id, yes); this.data.toast(yes ? this.lang.t('Approve') + ': ' + a.title : this.lang.t('Decline') + ': ' + a.title); }
```

WHAT TO WRITE. Return ONE ```ts code block holding three parts, each opened by its header line exactly as shown, in this order. Nothing between parts but the next header.

Part 1 header line: `// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  async closePhase(){ | until=  wa(j: any){`
Lines 238 to 256 again, indented the same, with exactly these changes and nothing else:
- `moveDate`: add `catch (e: any) { this.data.toast(e.message || 'Could not move the date'); }` between its try block and its finally.
- `ask`: add `catch (e: any) { this.data.toast(e.message || 'Could not send it to the customer'); }` the same way.
- `savePickup`: add `catch (e: any) { this.data.toast(e.message || 'Could not save the pickup'); }` the same way.
- `saveMoney`: add `catch (e: any) { this.data.toast(e.message || 'Could not save the money'); }` the same way.
- `saveNote`: add `catch (e: any) { this.data.toast(e.message || 'Could not save the note'); }` the same way.
- `deliver`: its catch becomes `catch (e: any) { this.data.toast(e.message || 'Could not deliver the car'); }`.
- `closePhase`, `saveEdit` and the comment line above saveEdit stay exactly as they are (saveEdit shows the error in its sheet through `this.err.set(e.message)`).
- On success every method still does exactly what it does today, in the same order. Every finally stays.

Part 2 header line: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=<div class="stars"> | until=@if (j.rating) {`
Line 67 again, indented the same, with ONE change: `(click)="data.rate(j.id, s)"` becomes `(click)="rateIt(j.id, s)"`. Everything else on the line stays.

Part 3 header line: `// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=  async answer(a: Approval | until=  pair(j: Job){`
Two methods, indented two spaces, each on one line like the file:
- `answer`: the same body inside `try { ... }` followed by `catch (e: any) { this.data.toast(e.message || 'Could not send your answer'); }`. The success toast stays exactly as it is, inside the try after the await.
- a new method `async rateIt(jobId: string, stars: number){ try { await this.data.rate(jobId, stars); } catch (e: any) { this.data.toast(e.message || 'Could not save your rating'); } }`

TRAPS.
- Never call a `this.data.<save>(` method outside a try whose catch shows `e.message`.
- Do not add a busy flag to the customer page; do not change any other line, style or wording.
- Fallback words exactly as given: British English, no em or en dash, no comma before and, or, but, nor.
