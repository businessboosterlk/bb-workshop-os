#!/usr/bin/env node
/* Serves the built app for the runners that take an address. node scripts/serve.mjs  (prints the address) */
import { serve } from './lib/world.mjs';
const { base } = serve(); console.log(base); setInterval(() => {}, 1 << 30);
