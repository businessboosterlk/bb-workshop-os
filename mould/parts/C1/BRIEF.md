Write the COMPLETE new contents of the existing file apps/web/src/app/pages/customer/job.component.ts, given at the end, with ONE
addition. Output ONLY one ```ts code block. Keep everything else exactly as it is, byte for byte where you can.

{{COMMON}}

THE ADDITION (part C1, 16 Oct 2026): the customer's car page gets a BEFORE AND AFTER card, the first photo of the job against the
latest, with a handle to drag. It goes right AFTER the <section class="tl card"> ... </section> block (the phases timeline) and
only when the job has at least two photos.

THE COMPONENT IT USES, already built: import { CompareComponent } from '../../ui/compare.component';  selector 'bb-compare',
  inputs: before: string (a data url), after: string, beforeLabel: string, afterLabel: string. Add CompareComponent to imports.
THE TYPES, FIELD BY FIELD:
  Photo { id: string; jobId: string; phaseKey: string; dataUrl: string; by: string; createdAt: string; updatedAt: string; }
  Job fields you may read: id: string; phases: { key: string; label: string }[]
  data.photosOf(jobId: string): Photo[]      (already injected as data; order not guaranteed, sort by createdAt yourself)
  lang.t(key: string): string                (already injected as lang; wrap the words "Before and after" and "Drag the handle")
ADD to the class, exactly:
  pair(j: Job){ const ph = [...this.data.photosOf(j.id)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); if (ph.length < 2) return null;
    const label = (k: string) => j.phases.find(p => p.key === k)?.label || 'Photo';
    return { before: ph[0], after: ph[ph.length - 1], beforeLabel: label(ph[0].phaseKey), afterLabel: label(ph[ph.length - 1].phaseKey) }; }
  (If Job is not already imported in this file, import it from '../../core/models'. Import only what the code uses.)
ADD to the template, after the timeline section:
  @if (pair(j); as pr) {
    <section class="card ba">
      <div class="sec-head"><h3>{{ lang.t('Before and after') }}</h3><span>{{ lang.t('Drag the handle') }}</span></div>
      <bb-compare [before]="pr.before.dataUrl" [after]="pr.after.dataUrl" [beforeLabel]="pr.beforeLabel" [afterLabel]="pr.afterLabel"/>
    </section>
  }
ADD to the styles: .ba{padding:16px}.ba bb-compare{margin-top:12px}
Nothing else changes. A TEMPLATE SEES ONLY CLASS MEMBERS; signals are written with .set; the check compiles with noUnusedLocals.

THE EXISTING FILE:
{{FILE}}
