```css
// BLOCK: apps/web/src/styles.css | start=.toast{position:fixed;left:50% | until=.toast button{margin-left:10px
.toast{position:fixed;left:50%;bottom:calc(84px + var(--sab));transform:translateX(-50%) translateY(8px);background:var(--ink);color:var(--bg);
  padding:11px 16px;border-radius:12px;font-size:13.5px;width:max-content;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;text-align:center;overflow-wrap:anywhere;opacity:0;pointer-events:none;z-index:100;box-shadow:var(--sh-lg);
  transition:opacity var(--dur) var(--ease),transform var(--dur) var(--ease)}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
// BLOCK: apps/web/src/styles.css | start=@media (min-width:1020px){.toast{left: | until=body.sheet-open{position:fixed
@media (min-width:1020px){body:has(.rail) .toast{left:calc(50% + var(--side-w)/2)}}
```