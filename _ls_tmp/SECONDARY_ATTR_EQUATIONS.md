# Secondary attribute equations (fit 2026-07-22)

Sources: naked Warrior L25, Light Practice / Beefury isolates, Kek Build A (`FareverTracker.json`).

## Rating → % (linear)

`percent = rating / (K * 100)`

| Stat | K | Evidence |
|------|---|----------|
| Critical Chance | **19** | Light Practice +57 Crit → +3.0% |
| Armor / Magic Pen | **35/4.6 ≈ 7.6087** | Beefury +35 → 4.6%; Kek AP/MP match |
| Fervor | **19** (was 15) | Kek Fer rating 169 → 8.89% ≈ game **8.9%** |

## Crit chance (hybrid)

```
critChance = 0.002 + 0.001*(Dex+Int) + rating/19/100 + flatUpgrade%
```

Kek: 0.2% + 5.6% + 2.68% (Crit rating 51 after non-stacking Fanatism −9) + 3% (Worldsplitter ★3+) = **11.48% ≈ 11.5%**.

Note: identical augment **negative Critical** does not stack across slots (second Fanatism −9 ignored).

## Crit bonus (soft-cap on Str+Faith)

Linear `150% + 0.02pp*(Str+Faith)` overshoots Kek (153.4% vs 152.6%). Soft-cap fits B1 + Kek:

```
S = Strength + Faith
criticalBonus = 1.5 + 0.0576 * S / (S + 205.4)
```

| S | Pred | Game |
|---|------|------|
| 79 (Practice) | 151.6% | 151.6% |
| 169 (Kek) | 152.6% | 152.6% |

## Health regen (soft-cap on Vitality)

Linear `1.1 + 0.015625*(Vit-38)` predicts 3.15 at Vit 169 vs game **2.6**. Soft-cap:

```
healthRegen = 0.301 + 5.047 * Vit / (Vit + 202)
```

| Vit | Pred | Game |
|-----|------|------|
| 38 | 1.10 | 1.1 |
| 70 | 1.60 | 1.6 |
| 169 | 2.60 | 2.6 |

## Fervor ratings (Kek reconcile)

Sum 169: rings 48×2, pendant 11, chest 14, back 8, hands 11, waist 11, arsenal broken 18. No phantom head Fer. Overshoot was **K=15**, not fake rating.
