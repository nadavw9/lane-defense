# Lane Defense — 3D Model Assets

> **Current runtime note (2026-08-31):** normal cars are rendered by `Car3D` as designed PNG
> sprite billboards on flat planes. The car GLBs listed below are legacy assets and are not the
> active car renderer. Environment GLBs remain available to `Environment3D`.

All models are CC0 (public domain) from [Kenney.nl](https://kenney.nl).
No attribution required.

## Texture requirement (CRITICAL)

All Kenney Car Kit and Nature Kit GLBs reference a shared external texture:

  `Textures/colormap.png`  (relative to the GLB file)

This file **must** ship alongside the GLBs or every model will fail to load.
It is placed in 4 locations to cover all relative-path resolutions:

| Path | Covers |
|------|--------|
| `public/models/cars/Textures/colormap.png` | legacy car GLBs |
| `public/models/environment/Textures/colormap.png` | env GLBs |
| `public/models/Textures/colormap.png` | root-relative fallback |
| `public/Textures/colormap.png` | absolute-path fallback |

Source: `Car Kit/Models/GLB format/Textures/colormap.png` (12 KB, palette PNG)

## Legacy cars/

| File | Source (Kenney Car Kit) | Maps to CarType |
|------|------------------------|-----------------|
| bike.glb | race.glb | small (Motorbike) |
| hatch.glb | hatchback-sports.glb | — (reserved) |
| sedan.glb | sedan.glb | big (Sedan) |
| van.glb | van.glb | jeep (Van) |
| truck.glb | truck.glb | truck (Truck) |
| bigrig.glb | garbage-truck.glb | bigrig (Big Rig) |
| *(tank)* | *no Kenney 3D tank exists* | legacy procedural mapping; active tank visuals are billboard/canvas based |

The Kenney "Tanks" pack (https://kenney.nl/assets/tanks) is **2D sprites only** — no GLB. The
old procedural `Car3D._buildTank()` mapping is historical; active tank visuals are billboard or
canvas based.

Download: https://kenney.nl/assets/car-kit

## environment/

| File | Source (Kenney Nature Kit) |
|------|---------------------------|
| tree-pine.glb | tree_pineDefaultA.glb |
| tree-oak.glb | tree_oak.glb |
| rock-large.glb | rock_largeA.glb |
| rock-small.glb | rock_smallA.glb |
| bush.glb | plant_bushLarge.glb |
| grass-clump.glb | grass_large.glb |

Download: https://kenney.nl/assets/nature-kit

## Total payload
- cars GLBs: ~1.1 MB
- environment GLBs: ~67 KB
- colormap.png (×4 copies): ~48 KB
- **total: ~1.3 MB**

The payload is retained for environment and legacy compatibility. Removing unused car preloads is
a separate cleanup task and must not be confused with the current billboard renderer.
