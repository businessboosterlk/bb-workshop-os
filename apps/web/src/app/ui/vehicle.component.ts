import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { VEHICLES, VEHICLE_BOX, VehicleBody } from './vehicles.generated';

/* A CAR SEEN FROM ABOVE, nose to the right, one of the licensed shapes in vehicles.generated.ts (Kenney Racing Pack, CC0,
   through scripts/build-vehicles.mjs). Every car has the same box, so every car on the floor is the same size. The body
   takes the current colour; the roof and the glass come from two tokens, so a car reads right by day and by night, and a
   faint car (class ghost) means an empty bay. Status is never the car's paint: a blocked bay carries a badge. */
@Component({
  selector: 'bb-vehicle',
  standalone: true,
  template: `<svg [attr.viewBox]="'0 0 ' + box.w + ' ' + box.h" aria-hidden="true" focusable="false" [innerHTML]="svg"></svg>`,
  styles: [`
    :host{display:block;line-height:0;color:var(--ink);--vehicle-roof:color-mix(in srgb, var(--ink) 78%, var(--bg));--vehicle-glass:color-mix(in srgb, var(--bg) 82%, var(--ink));--vehicle-glass-2:color-mix(in srgb, var(--bg) 70%, var(--ink))}
    svg{width:100%;height:100%;display:block}
    :host(.ghost){opacity:.28}`]
})
export class VehicleComponent {
  private san = inject(DomSanitizer);
  private static cache = new Map<string, SafeHtml>();
  @Input() body: VehicleBody = 'sedan';
  box = VEHICLE_BOX;
  get svg(): SafeHtml {
    const k = this.body in VEHICLES ? this.body : 'sedan'; const C = VehicleComponent.cache;
    if (!C.has(k)) C.set(k, this.san.bypassSecurityTrustHtml(VEHICLES[k as VehicleBody]));
    return C.get(k)!;
  }
}
