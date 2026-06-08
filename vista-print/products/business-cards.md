# Business Cards — Product Reference

## VistaPrint Structure

### Standard Business Cards
**Confirmed price:** $10 for 50 cards (entry-level promo pricing)
**Rating:** 4.4 stars

**Sizes:**
- 3.5"×2" Standard (most popular)
- 3.5"×1.75" Slim
- 2.5"×2.5" Square
- 2"×3.5" Portrait

**Paper (6+ options):**
- Standard 100lb (default)
- Premium Matte 130lb
- Glossy 130lb
- Ultra-Thick 18pt
- Soft-Touch 18pt
- Kraft/Recycled

**Thickness:**
- 14pt (standard)
- 16pt
- 18pt

**Finish:**
- Matte
- Glossy
- Soft-Touch
- Raised UV (spot)
- Foil (Gold, Silver, Rose Gold)
- Letterpress (premium)
- Edge Painting

**Corners:**
- Square (standard)
- Rounded

**Sides:**
- 1-sided
- 2-sided

**Quantity tiers:** 50, 100, 250, 500, 1000, 2500, 5000

---

### Ultra Thick Business Cards ⭐ (875 reviews, 4.4 stars)
**URL:** vistaprint.com/business-cards/ultra-thick

**Thickness:** 32pt (≈ credit card thickness; 2× standard)
**Size:** 3.5"×2" only
**Finish:** UV Glossy front / Matte back (only option)
**Corners:** Square only
**Note:** Rounded corners NOT available; Foil NOT available

**Key Message:** "As thick as a credit card. More than double our standard card."
**Part of:** VistaPrint's "Better by Design" sustainability collection

---

### Premium Business Cards
Die-cut shapes, foil, spot UV, letterpress options.

---

## Ctrl+P Implementation

### DB Products (category: print)
| Slug                        | Name                       | Base Price | Status   |
|-----------------------------|----------------------------|-----------|----------|
| business-cards              | Business Cards             | $29.00    | active   |
| ultra-thick-business-cards  | Ultra Thick Business Cards | $47.05    | active   |
| die-cut-business-cards      | Die-Cut Business Cards     | $52.95    | active   |

### Configurator Flow (VistaPrint pattern)
1. Quantity selector (50, 100, 250, 500, 1000, 2500, 5000)
2. Size selector (visual cards showing each size)
3. Paper/material selector (with thickness callout)
4. Finish selector (visual swatches)
5. Corners (square vs. rounded)
6. Sides (1-sided / 2-sided)
7. Effects (foil, spot UV — shown as premium upgrades)
8. Price updates live

### Key Selling Points
- Same-day rush available (standard sizes only)
- Free shipping on orders over $75
- Local Chandler, AZ production
- Premium specialty finishes: foil, raised UV, letterpress
- Matching designs across products (cards → flyers → banners)

### File Requirements
- Accepted: PDF, JPG, PNG, AI
- Resolution: 300 DPI at final size
- Color: CMYK recommended; RGB accepted
- Bleed: 0.125" (0.0625" minimum)
- Safety margin: 0.125" from trim edge
- Font size: 7pt minimum for readability
