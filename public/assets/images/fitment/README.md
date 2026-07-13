# Fitment images — make logos & model photos

These images feed the home "Shop by My Truck" picker cards
(`src/components/fitment/TruckPickerCards.jsx`). Drop a correctly named file
here and it appears automatically — no code changes. Missing files fall back
gracefully (make monogram / truck icon), so partial coverage is fine.

## Specs

- **Format:** PNG with transparent background (cutout, no white box).
- **They render on a DARK panel (#1d1d1f):** use light/white or full-color
  logo versions — a black logo will disappear.
- **Logo canvas (uniform):** 600x450 px (4:3), logo centered filling ~85% of
  the width. The card renders it at ~200x150 px max (measured), so 600x450 is
  crisp 3x on retina. SAME canvas for all 8 logos = uniform optical size.
- **Model photo canvas (uniform):** 600x450 px (4:3), PNG transparent cutout.
  Truck fills ~90% of the width, same facing direction for all (front-3/4
  toward the left), wheels resting on a consistent baseline (~5% from the
  bottom edge) so every truck sits at the same height. Keep under ~150KB.
- **Model photos:** front or front-3/4 view of the truck, cutout preferred.

## Naming convention

- Make logo: `makes/{make-slug}.png`
- Model photo: `models/{make-slug}-{model-slug}.png`
- Slug rule: lowercase, anything non-alphanumeric becomes `-` (e.g.
  "Chevrolet & GMC" -> `chevrolet-gmc`, "Fl 60 70 80 112" -> `fl-60-70-80-112`).

## Make logos (8)

- [ ] `makes/chevrolet-gmc.png` — Chevrolet & GMC
- [ ] `makes/ford.png` — Ford
- [ ] `makes/freightliner.png` — Freightliner
- [ ] `makes/international.png` — International
- [ ] `makes/kenworth.png` — Kenworth
- [ ] `makes/mack.png` — Mack
- [ ] `makes/peterbilt.png` — Peterbilt
- [ ] `makes/volvo.png` — Volvo

## Model photos (as currently in the database)

> **Warning — known data issue (2026-07-10):** `truck_models` has models
> cross-assigned to the wrong makes (e.g. W900 under Chevrolet, Cascadia
> under Peterbilt) from the Compatible-Trucks ETL parse. Produce photos for
> REAL make/model combos first; bogus combos just fall back to the icon.
> If the fitment data gets cleaned, regenerate this list.

### Chevrolet & GMC (11)

- [ ] `models/chevrolet-gmc-359.png` — 359
- [ ] `models/chevrolet-gmc-362.png` — 362
- [ ] `models/chevrolet-gmc-379.png` — 379
- [ ] `models/chevrolet-gmc-c500.png` — C500
- [ ] `models/chevrolet-gmc-century.png` — Century
- [ ] `models/chevrolet-gmc-coronado.png` — Coronado
- [ ] `models/chevrolet-gmc-fld.png` — Fld
- [ ] `models/chevrolet-gmc-t2000.png` — T2000
- [ ] `models/chevrolet-gmc-t600.png` — T600
- [ ] `models/chevrolet-gmc-t800.png` — T800
- [ ] `models/chevrolet-gmc-w900.png` — W900

### Ford (4)

- [ ] `models/ford-359.png` — 359
- [ ] `models/ford-century.png` — Century
- [ ] `models/ford-coronado.png` — Coronado
- [ ] `models/ford-t2000.png` — T2000

### Freightliner (33)

- [ ] `models/freightliner-359.png` — 359
- [ ] `models/freightliner-362.png` — 362
- [ ] `models/freightliner-379.png` — 379
- [ ] `models/freightliner-384.png` — 384
- [ ] `models/freightliner-386.png` — 386
- [ ] `models/freightliner-387.png` — 387
- [ ] `models/freightliner-388.png` — 388
- [ ] `models/freightliner-389.png` — 389
- [ ] `models/freightliner-567.png` — 567
- [ ] `models/freightliner-579.png` — 579
- [ ] `models/freightliner-587.png` — 587
- [ ] `models/freightliner-589.png` — 589
- [ ] `models/freightliner-c500.png` — C500
- [ ] `models/freightliner-cascadia.png` — Cascadia
- [ ] `models/freightliner-century.png` — Century
- [ ] `models/freightliner-classic.png` — Classic
- [ ] `models/freightliner-columbia.png` — Columbia
- [ ] `models/freightliner-coronado.png` — Coronado
- [ ] `models/freightliner-fl-60-70-80-112.png` — Fl 60 70 80 112
- [ ] `models/freightliner-fld.png` — Fld
- [ ] `models/freightliner-lt.png` — Lt
- [ ] `models/freightliner-m2.png` — M2
- [ ] `models/freightliner-prostar.png` — Prostar
- [ ] `models/freightliner-t2000.png` — T2000
- [ ] `models/freightliner-t600.png` — T600
- [ ] `models/freightliner-t660.png` — T660
- [ ] `models/freightliner-t680.png` — T680
- [ ] `models/freightliner-t700.png` — T700
- [ ] `models/freightliner-t800.png` — T800
- [ ] `models/freightliner-t880.png` — T880
- [ ] `models/freightliner-vnl.png` — Vnl
- [ ] `models/freightliner-w900.png` — W900
- [ ] `models/freightliner-w990.png` — W990

### International (31)

- [ ] `models/international-359.png` — 359
- [ ] `models/international-379.png` — 379
- [ ] `models/international-384.png` — 384
- [ ] `models/international-386.png` — 386
- [ ] `models/international-387.png` — 387
- [ ] `models/international-388.png` — 388
- [ ] `models/international-389.png` — 389
- [ ] `models/international-4100.png` — 4100
- [ ] `models/international-4200.png` — 4200
- [ ] `models/international-4300.png` — 4300
- [ ] `models/international-4400.png` — 4400
- [ ] `models/international-567.png` — 567
- [ ] `models/international-579.png` — 579
- [ ] `models/international-587.png` — 587
- [ ] `models/international-589.png` — 589
- [ ] `models/international-8600.png` — 8600
- [ ] `models/international-cascadia.png` — Cascadia
- [ ] `models/international-century.png` — Century
- [ ] `models/international-classic.png` — Classic
- [ ] `models/international-columbia.png` — Columbia
- [ ] `models/international-coronado.png` — Coronado
- [ ] `models/international-durastar.png` — Durastar
- [ ] `models/international-fl-60-70-80-112.png` — Fl 60 70 80 112
- [ ] `models/international-fld.png` — Fld
- [ ] `models/international-lt.png` — Lt
- [ ] `models/international-m2.png` — M2
- [ ] `models/international-prostar.png` — Prostar
- [ ] `models/international-t2000.png` — T2000
- [ ] `models/international-t660.png` — T660
- [ ] `models/international-t680.png` — T680
- [ ] `models/international-vnl.png` — Vnl

### Kenworth (33)

- [ ] `models/kenworth-359.png` — 359
- [ ] `models/kenworth-362.png` — 362
- [ ] `models/kenworth-379.png` — 379
- [ ] `models/kenworth-384.png` — 384
- [ ] `models/kenworth-386.png` — 386
- [ ] `models/kenworth-387.png` — 387
- [ ] `models/kenworth-388.png` — 388
- [ ] `models/kenworth-389.png` — 389
- [ ] `models/kenworth-567.png` — 567
- [ ] `models/kenworth-579.png` — 579
- [ ] `models/kenworth-587.png` — 587
- [ ] `models/kenworth-589.png` — 589
- [ ] `models/kenworth-c500.png` — C500
- [ ] `models/kenworth-cascadia.png` — Cascadia
- [ ] `models/kenworth-century.png` — Century
- [ ] `models/kenworth-classic.png` — Classic
- [ ] `models/kenworth-columbia.png` — Columbia
- [ ] `models/kenworth-coronado.png` — Coronado
- [ ] `models/kenworth-fl-60-70-80-112.png` — Fl 60 70 80 112
- [ ] `models/kenworth-fld.png` — Fld
- [ ] `models/kenworth-lt.png` — Lt
- [ ] `models/kenworth-m2.png` — M2
- [ ] `models/kenworth-prostar.png` — Prostar
- [ ] `models/kenworth-t2000.png` — T2000
- [ ] `models/kenworth-t600.png` — T600
- [ ] `models/kenworth-t660.png` — T660
- [ ] `models/kenworth-t680.png` — T680
- [ ] `models/kenworth-t700.png` — T700
- [ ] `models/kenworth-t800.png` — T800
- [ ] `models/kenworth-t880.png` — T880
- [ ] `models/kenworth-vnl.png` — Vnl
- [ ] `models/kenworth-w900.png` — W900
- [ ] `models/kenworth-w990.png` — W990

### Mack (11)

- [ ] `models/mack-359.png` — 359
- [ ] `models/mack-cascadia.png` — Cascadia
- [ ] `models/mack-century.png` — Century
- [ ] `models/mack-classic.png` — Classic
- [ ] `models/mack-columbia.png` — Columbia
- [ ] `models/mack-coronado.png` — Coronado
- [ ] `models/mack-fl-60-70-80-112.png` — Fl 60 70 80 112
- [ ] `models/mack-fld.png` — Fld
- [ ] `models/mack-m2.png` — M2
- [ ] `models/mack-vn.png` — Vn
- [ ] `models/mack-vnl.png` — Vnl

### Peterbilt (33)

- [ ] `models/peterbilt-359.png` — 359
- [ ] `models/peterbilt-362.png` — 362
- [ ] `models/peterbilt-379.png` — 379
- [ ] `models/peterbilt-384.png` — 384
- [ ] `models/peterbilt-386.png` — 386
- [ ] `models/peterbilt-387.png` — 387
- [ ] `models/peterbilt-388.png` — 388
- [ ] `models/peterbilt-389.png` — 389
- [ ] `models/peterbilt-567.png` — 567
- [ ] `models/peterbilt-579.png` — 579
- [ ] `models/peterbilt-587.png` — 587
- [ ] `models/peterbilt-589.png` — 589
- [ ] `models/peterbilt-c500.png` — C500
- [ ] `models/peterbilt-cascadia.png` — Cascadia
- [ ] `models/peterbilt-century.png` — Century
- [ ] `models/peterbilt-classic.png` — Classic
- [ ] `models/peterbilt-columbia.png` — Columbia
- [ ] `models/peterbilt-coronado.png` — Coronado
- [ ] `models/peterbilt-fl-60-70-80-112.png` — Fl 60 70 80 112
- [ ] `models/peterbilt-fld.png` — Fld
- [ ] `models/peterbilt-lt.png` — Lt
- [ ] `models/peterbilt-m2.png` — M2
- [ ] `models/peterbilt-prostar.png` — Prostar
- [ ] `models/peterbilt-t2000.png` — T2000
- [ ] `models/peterbilt-t600.png` — T600
- [ ] `models/peterbilt-t660.png` — T660
- [ ] `models/peterbilt-t680.png` — T680
- [ ] `models/peterbilt-t700.png` — T700
- [ ] `models/peterbilt-t800.png` — T800
- [ ] `models/peterbilt-t880.png` — T880
- [ ] `models/peterbilt-vnl.png` — Vnl
- [ ] `models/peterbilt-w900.png` — W900
- [ ] `models/peterbilt-w990.png` — W990

### Volvo (9)

- [ ] `models/volvo-579.png` — 579
- [ ] `models/volvo-587.png` — 587
- [ ] `models/volvo-cascadia.png` — Cascadia
- [ ] `models/volvo-lt.png` — Lt
- [ ] `models/volvo-prostar.png` — Prostar
- [ ] `models/volvo-t660.png` — T660
- [ ] `models/volvo-t680.png` — T680
- [ ] `models/volvo-vn.png` — Vn
- [ ] `models/volvo-vnl.png` — Vnl

