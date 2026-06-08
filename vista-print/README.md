# Vista Print — Product Structure Reference

This folder contains product structure, pricing, and layout references based on VistaPrint's catalog, mapped to Ctrl+P's product lineup.

## Purpose
Use this reference to:
- Structure product pages (options, variations, pricing tiers)
- Set competitive retail prices
- Define product descriptions, specs, and feature callouts
- Design product configurator flows

## Folder Structure
```
vista-print/
├── README.md               (this file)
├── pricing-model.md        (margin tiers, pricing formulas, quantity discounts)
├── products/
│   ├── business-cards.md   (BC structure, options, VistaPrint comparison)
│   ├── banners.md          (all banner types: vinyl, mesh, fabric, step-repeat)
│   ├── displays.md         (retractable, tension fabric, X-stand, tabletop, pop-up)
│   ├── signs.md            (yard signs, foam board, rigid signs, A-frame)
│   └── flags.md            (feather flags, teardrop, pole banners)
```

## VistaPrint Product Hierarchy (as reference)
```
VistaPrint
├── Business Cards
│   ├── Standard
│   ├── Premium (raised UV, rounded corners)
│   └── Ultra Thick (32pt)
├── Signs & Posters
│   ├── Banners
│   │   ├── Vinyl Banners ⭐ (bestseller, 19,919 reviews)
│   │   ├── Mesh Banners
│   │   ├── Fabric Banners
│   │   ├── Retractable Banners
│   │   ├── Step & Repeat Banners
│   │   ├── X-Banners
│   │   ├── Tension Fabric Displays
│   │   ├── SEG Fabric Stands
│   │   ├── Pop-Up Displays
│   │   ├── Pennant Banners
│   │   └── Pole Banners
│   ├── Yard Signs ⭐ (10,306 reviews)
│   ├── Foam Board Signs
│   ├── Metal Signs
│   ├── Window Clings
│   └── Stickers & Labels
└── Marketing Materials
    ├── Flyers
    ├── Postcards
    └── Brochures
```

## Ctrl+P Product Mapping
| VistaPrint Product          | Ctrl+P Slug                  | DB Category  |
|-----------------------------|------------------------------|--------------|
| Vinyl Banners               | vinyl-banners                | banners      |
| Mesh Banners                | mesh-banners                 | banners      |
| Step & Repeat Banners       | step-repeat-banner           | banners      |
| Retractable Banner Stands   | retractable-banner-stands    | displays     |
| Tension Fabric Display      | tension-fabric-display       | displays     |
| X-Banners                   | x-stand-banner               | displays     |
| Pole Banner Set             | pole-banner-set              | displays     |
| Tabletop Display            | tabletop-display             | displays     |
| Pop-Up Display              | pop-up-display               | displays     |
| Yard Signs                  | yard-signs                   | signage      |
| Foam Board Signs            | foam-board-signs             | signage      |
| Rigid Signs (Coroplast)     | rigid-signs                  | signage      |
| A-Frame Signs               | a-frame-signs                | signage      |
| Standard Business Cards     | business-cards               | print        |
| Ultra Thick Business Cards  | ultra-thick-business-cards   | print        |
| Die-Cut Business Cards      | die-cut-business-cards       | print        |
| Flags (Feather/Teardrop)    | flags                        | flags        |
| Wall Art / Framed Prints    | wall-art                     | wall-art     |
