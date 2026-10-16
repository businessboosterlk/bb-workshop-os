# Where the cars on the floor come from (16 Oct 2026)
Source: Kenney, Racing Pack, https://opengameart.org/content/racing-pack (racing-pack.zip, 2.5 MB, fetched 16 Oct 2026).
Licence: CC0 1.0 Universal (public domain dedication), stated in the pack's License.txt. No attribution required; we name it anyway.
What was taken: the five black cars in Vector/vector_objects.svg, a flat export with no names. Each car was found by the bounding
box of its paths (scratch script extract-cars.mjs, 16 Oct) and written to kenney/cars/obj-NN.svg unchanged, Kenney's paint and all.
scripts/build-vehicles.mjs turns each nose-right, swaps the paint for the app's colour tokens and writes
apps/web/src/app/ui/vehicles.generated.ts. Nobody edits a car by hand.
Also fetched and NOT used: five top-down icons by Delapouite from game-icons.net (CC BY 3.0); judged too gamey on a sheet
and deleted the same hour. No attribution owed.
Not in the set: a van or a minibus. A van is drawn as the largest car until a licensed van shape is sourced; said on screen nowhere, said here.
