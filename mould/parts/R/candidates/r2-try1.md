```ts
// BLOCK: apps/web/src/app/pages/workshop/job.component.ts | start=  async closePhase(){ | until=  wa(j: any){
  async closePhase(){ if (!this.photo() || this.busy()) return; this.busy.set(true);
    try { const j = this.job()!; const label = this.data.phaseNow(j)?.label; await this.data.completePhase(j.id, this.photo(), this.note); this.closeSheet(); this.data.toast(label + ' done. The customer can see it.'); }
    catch (e: any) { this.data.toast(e.message || 'Could not close the phase'); } finally { this.busy.set(false); } }
  async moveDate(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPromise(this.id(), new Date(this.newDate + 'T17:00:00').toISOString(), this.reason); this.closeSheet(); this.data.toast('Date moved. The customer sees why.'); } catch (e: any) { this.data.toast(e.message || 'Could not move the date'); } finally { this.busy.set(false); } }
  async ask(){ if (this.busy()) return; this.busy.set(true); try { await this.data.askApproval(this.id(), this.askTitle, this.askDetail, this.askAmount ? Number(this.askAmount) : undefined); this.closeSheet(); this.data.toast('Sent to the customer'); } catch (e: any) { this.data.toast(e.message || 'Could not send it to the customer'); } finally { this.busy.set(false); } }
  async savePickup(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setPickup(this.id(), this.pk.wanted ? { ...this.pk } : { wanted: false, status: 'none' }); this.closeSheet(); this.data.toast('Pickup saved'); } catch (e: any) { this.data.toast(e.message || 'Could not save the pickup'); } finally { this.busy.set(false); } }
  async deliver(){ if (this.busy()) return; this.busy.set(true); try { await this.data.deliver(this.id()); this.closeSheet(); this.data.toast('Delivered. The car moves to history.'); } catch (e: any) { this.data.toast(e.message || 'Could not deliver the car'); } finally { this.busy.set(false); } }
  async saveMoney(){ if (this.busy()) return; this.busy.set(true); try { await this.data.setMoney(this.id(), { estimate: +this.m.estimate || 0, approved: +this.m.approved || 0, paid: +this.m.paid || 0 }); this.closeSheet(); } catch (e: any) { this.data.toast(e.message || 'Could not save the money'); } finally { this.busy.set(false); } }
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
  async saveNote(){ if (this.busy()) return; this.busy.set(true); try { await this.data.addNote(this.id(), this.noteText); this.closeSheet(); } catch (e: any) { this.data.toast(e.message || 'Could not save the note'); } finally { this.busy.set(false); } }
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=<div class="stars"> | until=@if (j.rating) {
          <div class="stars">@for (s of [1,2,3,4,5]; track s) { <button type="button" [class.on]="(j.rating || 0) >= s" (click)="rateIt(j.id, s)" [attr.aria-label]="s + ' stars'"><bb-icon name="star"/></button> }</div>
// BLOCK: apps/web/src/app/pages/customer/job.component.ts | start=  async answer(a: Approval | until=  pair(j: Job){
  async answer(a: Approval, yes: boolean){ try { await this.data.answerApproval(this.id(), a.id, yes); this.data.toast(yes ? this.lang.t('Approve') + ': ' + a.title : this.lang.t('Decline') + ': ' + a.title); } catch (e: any) { this.data.toast(e.message || 'Could not send your answer'); } }
  async rateIt(jobId: string, stars: number){ try { await this.data.rate(jobId, stars); } catch (e: any) { this.data.toast(e.message || 'Could not save your rating'); } }
```