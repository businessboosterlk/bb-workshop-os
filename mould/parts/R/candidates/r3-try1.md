```ts
// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async drop(ev: CdkDragDrop<EnquiryStatus>){ | until=  toQuote(e: Enquiry){
  async drop(ev: CdkDragDrop<EnquiryStatus>){
    const e: Enquiry = ev.item.data; const to = ev.container.data; if (!e || e.status === to) return;
    if (to === 'lost') { this.openLost(e); return; }
    if (to === 'quoted') { if (e.quoteId) { try { await this.data.updateEnquiry(e.id, { status: 'quoted', lostReason: undefined }); this.data.toast('Moved to Quoted'); } catch (e2: any) { this.data.toast(e2.message || 'Could not move the enquiry'); } } else this.toQuote(e); return; }
    if (to === 'booked') { if (e.jobId) { try { await this.data.updateEnquiry(e.id, { status: 'booked' }); this.data.toast('Moved to Booked'); } catch (e2: any) { this.data.toast(e2.message || 'Could not move the enquiry'); } } else this.toBook(e); return; }
    if (to === 'new') { await this.reopen(e); }
  }
// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async reopen(e: Enquiry){ | until=  openAdd(){
  async reopen(e: Enquiry){ try { await this.data.updateEnquiry(e.id, { status: e.quoteId && e.status !== 'lost' ? 'quoted' : 'new', lostReason: undefined }); this.sel.set(null); this.data.toast('Back to New'); } catch (er: any) { this.data.toast(er.message || 'Could not reopen the enquiry'); } }
// BLOCK: apps/web/src/app/pages/workshop/enquiries.component.ts | start=  async lose(){ | until=}
  async lose(){ const e = this.losing(); if (!e) return; try { await this.data.loseEnquiry(e.id, this.reason); this.losing.set(null); this.data.toast('Marked lost'); } catch (er: any) { this.data.toast(er.message || 'Could not mark it lost'); } }
// BLOCK: apps/web/src/app/pages/workshop/quote.component.ts | start=  async sent(){ | until=  print(){
  async sent(){ if (this.q.id && this.q.status === 'draft') { try { const r = await this.data.setQuoteStatus(this.q.id, 'sent'); if (r) this.q = structuredClone(r); } catch (e: any) { this.data.toast(e.message || 'Could not mark the quote sent'); } } }
  async accept(){ if (!this.q.id) return; const saved = await this.save(); if (!saved) return; try { await this.data.setQuoteStatus(saved.id, 'accepted'); this.router.navigate(['/workshop/new'], { queryParams: { quote: saved.id } }); } catch (e: any) { this.data.toast(e.message || 'Could not mark the quote accepted'); } }
  async decline(){ if (!this.q.id) return; try { const r = await this.data.setQuoteStatus(this.q.id, 'declined'); if (r) this.q = structuredClone(r); this.data.toast('Quote declined. The enquiry is marked lost.'); } catch (e: any) { this.data.toast(e.message || 'Could not mark the quote declined'); } }
// BLOCK: apps/web/src/app/pages/workshop/customers.component.ts | start=  async save(){ const a = this.active(); | until=  openNew(){
  async save(){ const a = this.active(); if (!a || !this.pick) return; try { await this.data.markFollowup(a.job.id, a.f.key, this.pick, this.note); this.active.set(null);
    this.data.toast(this.pick === 'issue' ? 'Saved. A new enquiry is waiting in Enquiries.' : 'Follow-up saved', this.pick === 'issue' ? '/workshop/enquiries' : undefined, 'Open'); } catch (e: any) { this.data.toast(e.message || 'Could not save the follow-up'); } }
```