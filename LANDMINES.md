
## L-WOS-020 (15 Oct 2026): the second workshop showed the first one's people
**Symptom:** the demo garage (Blue Bay Motors) signed its quotes and notes "Miflal", numbered quotes AM-Q, printed "Demo
seats: Miflal 1111 · Nuwan 2222 · Kasun 3333" on its door and told staff "Ask Miflal to quote this one". A saved Auto
Museum seat also opened Auto Museum's floor under `?c=demo-garage`, and a month old demo floor read "716 h over".
**Root cause:** the seed, the door hint and one toast were written for the first workshop with its names typed in; the
demo cast lived only in the build folder that `npm run casts` wipes, so the live link fell back to Auto Museum.
**Block:** every name and the quote prefix come from the cast (seed.ts, login, enquiries); a link naming another
workshop signs the old seat out (session restore); the local demo reseeds after 12 hours; casts/demo-garage.json is the
source. Manual sweep that found it, to repeat for every new cast: open every route of the new cast and grep the page
text for the other casts' names, owners, branches and quote prefixes.
