// A stand in for @angular/core so data.service.ts runs in plain node for the checks (signals as plain getters, inject from a table).
export function signal(v){ const f = () => v; f.set = x => { v = x; }; f.update = fn => { v = fn(v); }; return f; }
export function computed(fn){ return () => fn(); }
export function Injectable(){ return c => c; }
export function inject(cls){ return globalThis.__wosInject ? globalThis.__wosInject(cls) : {}; }
