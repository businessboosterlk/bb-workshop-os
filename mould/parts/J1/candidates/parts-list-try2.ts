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
          <span class="pl-n">
            @if (orderedCount() > 0) {
              {{ orderedCount() }} still to arrive
            } @else if (parts().length > 0) {
              All in
            } @else {
              None yet
            }
          </span>
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
              <span class="pl-sub">
                @if (p.supplier) {
                  {{ p.supplier }} ·
                }
                @if (p.status === 'ordered') {
                  Ordered {{ niceWhen(p.orderedAt) }}
                } @else if (p.status === 'arrived') {
                  Arrived {{ niceWhen(p.arrivedAt) }}
                } @else {
                  Fitted {{ niceWhen(p.fittedAt) }}
                }
              </span>
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
          <bb-icon name="check" />
          {{ sheet() === 'edit' ? 'Save changes' : 'Add the part' }}
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
      .pl-acts .pl-edit:only-child {
        grid-column: 1 / -1;
      }
      .pl-empty {
        font-size: 13px;
        color: var(--muted);
        margin-top: 8px;
      }
      .err {
        font-size: 13px;
        color: var(--red);
        font-weight: 600;
        margin-top: 12px;
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

  orderedCount(): number {
    return this.parts().filter((p) => p.status === 'ordered').length;
  }

  openAdd(): void {
    this.name = '';
    this.supplier = '';
    this.err.set('');
    this.editing.set(null);
    this.sheet.set('add');
  }

  openEdit(p: PartLine): void {
    this.name = p.name;
    this.supplier = p.supplier ?? '';
    this.err.set('');
    this.editing.set(p);
    this.sheet.set('edit');
  }

  close(): void {
    this.sheet.set('');
    this.editing.set(null);
    this.err.set('');
  }

  async save(): Promise<void> {
    if (!this.name.trim()) {
      this.err.set('Add the part name');
      return;
    }
    this.busy.set(true);
    this.err.set('');
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
      this.err.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async arrived(p: PartLine): Promise<void> {
    const wasHeld = this.job.hold === 'parts';
    const id = this.job.id;
    const plate = this.job.plate;
    this.busy.set(true);
    try {
      await this.data.partArrived(id, p.id);
      const after = this.data.job(id);
      if (wasHeld && after && !after.hold) {
        this.data.toast(
          after.spaceKey ? 'Last part in. ' + plate + ' is back at work' : 'Last part in. ' + plate + ' is waiting for a space'
        );
      } else {
        this.data.toast(p.name + ' arrived');
      }
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }

  async fitted(p: PartLine): Promise<void> {
    this.busy.set(true);
    try {
      await this.data.partFitted(this.job.id, p.id);
      this.data.toast(p.name + ' fitted');
    } catch (e) {
      this.data.toast(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy.set(false);
    }
  }
}
