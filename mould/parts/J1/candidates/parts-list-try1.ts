import { Component, Input, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Job, PartLine } from '../core/models';
import { DataService, niceWhen } from '../core/data.service';
import { DrawerComponent } from './drawer.component';
import { IconComponent } from './icon.component';

@Component({
  selector: 'bb-parts-list',
  standalone: true,
  imports: [FormsModule, IconComponent, DrawerComponent],
  template: `
    <div class="card pl">
      <div class="pl-h">
        <div>
          <h3>Parts</h3>
          <span class="pl-n">{{ summary() }}</span>
        </div>
        @if (job.status === 'open') {
          <button type="button" class="btn ghost sm pl-add" (click)="openAdd()">
            <bb-icon name="plus" /> Add a part
          </button>
        }
      </div>

      @if (parts().length > 0) {
        <ul class="pl-list">
          @for (p of parts(); track p.id) {
            <li class="pl-row" [attr.data-part]="p.id" [attr.data-status]="p.status">
              <div class="pl-line1">
                <strong class="pl-name">{{ p.name }}</strong>
                @if (p.status === 'ordered') {
                  <span class="pill quoted">Ordered</span>
                } @else if (p.status === 'arrived') {
                  <span class="pill new">Arrived</span>
                } @else {
                  <span class="pill won">Fitted</span>
                }
              </div>
              <span class="pl-sub">{{ subText(p) }}</span>
              <div class="pl-acts">
                @if (p.status === 'ordered') {
                  <button type="button" class="btn ghost pl-arrived" [disabled]="busy()" (click)="arrived(p)">
                    <bb-icon name="check" /> It arrived
                  </button>
                  <button type="button" class="btn ghost pl-edit" [disabled]="busy()" (click)="openEdit(p)">
                    <bb-icon name="edit" /> Edit
                  </button>
                } @else if (p.status === 'arrived') {
                  <button type="button" class="btn ghost pl-fitted" [disabled]="busy()" (click)="fitted(p)">
                    <bb-icon name="wrench" /> Fitted
                  </button>
                  <button type="button" class="btn ghost pl-edit" [disabled]="busy()" (click)="openEdit(p)">
                    <bb-icon name="edit" /> Edit
                  </button>
                } @else {
                  <button type="button" class="btn ghost pl-edit" [disabled]="busy()" (click)="openEdit(p)">
                    <bb-icon name="edit" /> Edit
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="pl-empty">No parts on this job. Add one when you order it.</p>
      }
    </div>

    <bb-drawer [title]="sheet() === 'edit' ? 'Edit part' : 'Add a part'" [open]="sheet() !== ''" (closed)="close()">
      <div class="form-grid">
        <div class="field span">
          <label for="pl-name">Part</label>
          <input id="pl-name" [(ngModel)]="name" placeholder="Left front door shell" />
        </div>
        <div class="field span">
          <label for="pl-sup">Supplier (optional)</label>
          <input id="pl-sup" [(ngModel)]="supplier" placeholder="Lanka Auto Parts" />
        </div>
      </div>
      @if (err()) {
        <p class="err">{{ err() }}</p>
      }
      <div foot>
        <button type="button" class="btn pl-save" [disabled]="busy()" (click)="save()">
          <bb-icon name="check" /> {{ sheet() === 'edit' ? 'Save changes' : 'Add the part' }}
        </button>
        <button type="button" class="btn quiet" (click)="close()">Cancel</button>
      </div>
    </bb-drawer>
  `,
  styles: [
    `
      .pl {
        padding: 14px 16px;
      }
      .pl-h {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .pl-h h3 {
        font-size: 14px;
        font-weight: 700;
        margin: 0;
      }
      .pl-n {
        font-size: 12px;
        color: var(--muted);
        display: block;
        margin-top: 2px;
      }
      .pl-add {
        min-height: 40px;
      }
      .pl-list {
        list-style: none;
        padding: 0;
        margin: 8px 0 0;
      }
      .pl-row {
        padding: 12px 0;
        border-top: 1px solid var(--line);
      }
      .pl-row:first-child {
        border-top: none;
      }
      .pl-line1 {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .pl-name {
        flex: 1;
        min-width: 0;
        font-size: 14px;
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pl-sub {
        display: block;
        font-size: 12.5px;
        color: var(--muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 4px;
      }
      .pl-acts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }
      .pl-acts button {
        width: 100%;
        min-height: 44px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .pl-acts button:last-child:only-child {
        grid-column: 1 / -1;
      }
      .pl-empty {
        font-size: 13px;
        color: var(--muted);
        margin: 8px 0 0;
      }
      .err {
        font-size: 13px;
        color: var(--red);
        font-weight: 600;
        margin-top: 12px;
      }
      .pl-save {
        min-height: 44px;
      }
    `,
  ],
})
export class PartsListComponent {
  @Input({ required: true }) job!: Job;
  data = inject(DataService);
  sheet = signal<'' | 'add' | 'edit'>('');
  editing = signal<PartLine | null>(null);
  busy = signal(false);
  err = signal('');
  name = '';
  supplier = '';

  parts(): PartLine[] {
    return this.job.parts ?? [];
  }

  summary(): string {
    const parts = this.parts();
    if (parts.length === 0) return 'None yet';
    const ordered = parts.filter((p) => p.status === 'ordered').length;
    if (ordered > 0) return ordered + ' still to arrive';
    return 'All in';
  }

  subText(p: PartLine): string {
    const parts: string[] = [];
    if (p.supplier) parts.push(p.supplier);
    if (p.status === 'ordered') parts.push('Ordered ' + niceWhen(p.orderedAt));
    else if (p.status === 'arrived') parts.push('Arrived ' + niceWhen(p.arrivedAt));
    else parts.push('Fitted ' + niceWhen(p.fittedAt));
    return parts.join(' · ');
  }

  openAdd(): void {
    this.name = '';
    this.supplier = '';
    this.err('');
    this.editing(null);
    this.sheet('add');
  }

  openEdit(p: PartLine): void {
    this.name = p.name;
    this.supplier = p.supplier ?? '';
    this.err('');
    this.editing(p);
    this.sheet('edit');
  }

  close(): void {
    this.sheet('');
    this.editing(null);
    this.err('');
  }

  async save(): Promise<void> {
    if (!this.name.trim()) {
      this.err('Add the part name');
      return;
    }
    this.busy(true);
    this.err('');
    try {
      const editing = this.editing();
      if (editing) {
        await this.data.editPart(this.job.id, editing.id, this.name, this.supplier);
        this.data.toast('Part saved');
      } else {
        await this.data.addPart(this.job.id, this.name, this.supplier);
        this.data.toast('Part ordered: ' + this.name.trim());
      }
      this.close();
    } catch (e) {
      this.err(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy(false);
    }
  }

  async arrived(p: PartLine): Promise<void> {
    const wasHeld = this.job.hold === 'parts';
    const id = this.job.id;
    const plate = this.job.plate;
    this.busy(true);
    try {
      await this.data.partArrived(id, p.id);
      const after = this.data.job(id);
      if (wasHeld && after && !after.hold) {
        this.data.toast(after.spaceKey ? 'Last part in. ' + plate + ' is back at work' : 'Last part in. ' + plate + ' is waiting for a space');
      } else {
        this.data.toast(p.name + ' arrived');
      }
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy(false);
    }
  }

  async fitted(p: PartLine): Promise<void> {
    this.busy(true);
    try {
      await this.data.partFitted(this.job.id, p.id);
      this.data.toast(p.name + ' fitted');
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy(false);
    }
  }
}
