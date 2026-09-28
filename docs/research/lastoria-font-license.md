# La Storia ("Lastoria") Bold: can it be used for the portfolio signature?

Researched 2026-09-28. All URLs accessed 2026-09-28. This summarizes what the license texts say and lists practical options. It is not legal advice.

## TL;DR

- **Designer:** Abo Daniel Studio (Cilacap, Indonesia). The authoritative listing is the studio's own shop, [abodaniel.com/product/la-storia](https://abodaniel.com/product/la-storia/). It is also sold on MyFonts and Creative Fabrica. The only free version is a demo marked "PERSONAL USE ONLY" on [dafont](https://www.dafont.com/la-storia.font).
- **The file from Componentry is not the free demo.** It is the retail **"La storia Bold"**: 362 glyphs, with ligatures, swashes and PUA characters. The dafont demo is `La storia Demo.otf` with 135 glyphs. Componentry's repo is MIT-licensed, but it says nothing about the font, and the MIT grant covers only Componentry's own code. **Nothing we found gives anyone a license to use this copy.**
- **Current use as-is is not covered by any license we can find.** No license has been bought, and Componentry grants none.
- **Abo Daniel's own $19 Desktop license would not cover it either.** It forbids "Logo usage/logotype" and "Web, web app, app, or game", and requires fonts to be "used in rasterized form". Our signature is a vector SVG on a website.
- **Routes the license texts do support:**
  1. **MyFonts Desktop license: $15 for Bold alone, $19 for the family.** MyFonts says to buy a Desktop license when the font "is used in a static graphic image such as a logo". Its EULA allows static graphics as long as the glyphs aren't individually addressed by a website to render them.
  2. **Abo Daniel Professional license: $500.** It explicitly includes logo use and one website.
  3. **Ask the studio in writing** (contact@abodaniel.com) for a custom license or permission.
  4. **Switch to an OFL script font** such as Ms Madi, Mrs Saint Delafield or Herr Von Muellerhoff. This costs nothing and has no license ambiguity.
- **Status (2026-09-28):** `src/data/signature.ts` (added in commit `436291e`) has been pushed to the public repo on branch `lc/signature-portfolio-placement-87864d` for PR review. No license has been bought yet, so one of the routes above is needed before merging or deploying.

## Findings

### 1. Designer and authoritative listing

| Fact | Source |
|---|---|
| Embedded copyright (name ID 0): `Typeface © Abo Daniel 2019. All Rights Reserved`. Trademark and designer (IDs 7, 9): `Abo Daniel 2019`. Version (ID 5): `Version 1.00;November 6, 2019;FontCreator 11.5.0.2430 64-bit`. | Font file name table, parsed locally (see "Font file" below) |
| **Name IDs 11, 12, 13 and 14 are absent.** The file has no vendor URL, designer URL, license description or license URL. OS/2 vendor ID is `HL  ` (the FontCreator default) and fsType is `0`. | Same |
| The studio's own product page offers "Regular" and "Bold", 89 ligatures, swash and PUA encoding, from $19. | https://abodaniel.com/product/la-storia/ |
| The dafont listing is by "Abo Daniel Studio" and links to abodaniel.com. Its file is `La storia Demo.otf` with 135 glyphs. Author's note: "This demo font is for PERSONAL USE ONLY!" | https://www.dafont.com/la-storia.font |
| MyFonts lists both styles by Abo Daniel: $15 per style, $19 for the family of 2. | https://www.myfonts.com/collections/la-storia-font-abo-daniel |
| Creative Fabrica also sells it. The dafont note links there for commercial licenses. The page returned 403 to automated fetches and was not verified. | https://www.creativefabrica.com/product/la-storia/ |

**Font file.** `LastoriaBoldRegular.otf` was fetched from componentry.dev. It is 177,816 bytes with SHA-256 `ea10671a…62b4`. It is byte-identical (git blob `62ca15a`) to `apps/web/public/LastoriaBoldRegular.otf` in https://github.com/harshjdhv/componentry, which was added in commit `ad350eb` (2026-03-18). The file has 362 glyphs, 150 of them PUA code points, and GSUB features `liga,swsh,titl`.

**Inference:** it is the full commercial Bold weight, not the free demo. The family name has no "Demo", and the glyph count and feature set match the paid product description rather than the 135-glyph demo.

### 2. Licenses on offer

These are the author's own terms, from the [license page](https://abodaniel.com/license/) and [license PDF](https://abodaniel.com/wp-content/uploads/2021/04/Abodaniel.com-License.pdf). Prices come from the product page's variation data:

| License | Price | Relevant terms |
|---|---|---|
| Desktop | $19 | Allows "Unlimited personal projects" and "Blog: unlimited usage". **Forbids** "Embedding fonts. Must always be used in rasterized form", "Logo usage/logotype" and "Web, web app, app, or game". |
| Webfont | $50 | 1 website, "Embedding fonts using @font-face". Forbids web app, app or game. Says nothing about logos or outlines. |
| E-Pub | $300 | 1 ebook or printed title. |
| App/Game | $350 | 1 app title, embedded but not extractable. |
| Professional | $500 | "Logo usage/logotype" (the license page adds "unlimited"), "Unlimited personal & Commercial project", "1 Licensed website", @font-face. |
| National / Worldwide Corporate | $1,200 / $3,000 | Unlimited use. |

Clauses that apply to every license ([license page](https://abodaniel.com/license/)):

- **Redistribution:** "You cannot sell and redistribute it to any third party."
- **Conversion:** "Converting products into different formats without written permission from us."
- **Duplication:** "You may not duplicate/copy the product to anyone without our permission."
- **Unlicensed use:** "If you use without a purchase in advance will be charged a fee of 10x the license fee".
- **Custom terms:** the page invites buyers to "contact us for a custom license".

The license page, the product page and the 2021 PDF give different numeric limits. For example, the Professional license covers 4, 5 or 10 users and 10 or 30 commercial projects depending on which one you read. The allow and forbid lists are the same in all three.

MyFonts has its own EULA for this family. Desktop is [eula_2275](https://www.myfonts.com/pages/license-agreement?id=eula_2275), which is Monotype's standard text, not Abo Daniel's:

- It allows distributing materials if "the materials do not contain the Font Software embedded". Any "static graphic image" must not correspond to glyphs "individually addressed by software, a website".
- It forbids modifying the font "to create, directly or indirectly, Derivative Works".
- The [family page](https://www.myfonts.com/collections/la-storia-font-abo-daniel) lists "Logos" and "Brand identity" as Desktop uses. It also says that if the font is only in "a static graphic image such as a logo", you "should purchase a Desktop license instead" of a webfont license.

Creative Fabrica's own help pages say static images are allowed on websites and webfont embedding is not ([search summary of creativefabrica.com help pages](https://help.creativefabrica.com/hc/en-us/categories/360002784280-License)). The license page itself returned 403, so this is unverified.

### 3. Personal vs commercial, and outlines

- **None of the texts defines "personal" or "commercial".** None mentions portfolios either. Whether a job-seeking portfolio counts as personal use **cannot be determined from primary sources.** Inference: it is safer to treat it as commercial self-promotion.
- **Under Abo Daniel's own licenses, outlines on a website fall outside Desktop.** The Desktop license says "rasterized form" only and bans logotypes and web use. A vector SVG wordmark on a site is none of the allowed things. The Convert clause ("different formats without written permission") arguably also reaches pre-computed glyph path data. **The Professional license ($500) is the tier that names logo use and a website.**
- **Under MyFonts, the Desktop license is the intended route for a static logo.** The EULA's condition is about glyphs being individually addressed to render them. Inference: `src/data/signature.ts` stores the whole word as one `fill` path, which is a static graphic, so it appears to meet that condition.
- **Open point under the MyFonts EULA:** the `strokes` in `src/data/signature.ts` are centrelines traced from the glyph skeleton. The EULA does not say whether data traced from rendered glyphs counts as a "Derivative Work" of the font software. Inference: it is data derived from a rendered image, not modified font software, but the text doesn't settle it.

### 4. Outline data in a public GitHub repo

- No license text addresses glyph outlines kept in source code.
- Abo Daniel's redistribution, duplication and conversion bans apply to "the product", meaning the font. A single word's outline is not the font file. Its "rasterized form" rule, though, suggests the studio does not expect vector glyph data to leave the buyer's machine.
- The MyFonts EULA allows distributing "materials" that don't contain embedded font software, so a static graphic in a repo looks like distributed material.
- Inference: the repo adds little exposure beyond the live site, because the site already sends the same SVG path to every visitor. Whatever license covers showing the SVG on the site would cover it in the repo too.
- **Status:** the data is now on a public branch for review (see TL;DR).

## Options

| Option | Cost | What the text supports | Notes |
|---|---|---|---|
| A. **MyFonts Desktop, La storia Bold, 1 user** | $15 ($19 for the family) | MyFonts names logos as a Desktop use, and the EULA allows a static graphic whose glyphs aren't individually addressed. | Regenerate `signature.ts` from the purchased file, not the Componentry copy. The open point about the traced strokes still applies. |
| B. **Abo Daniel Professional** | $500 | Explicitly lists "Logo usage/logotype" and "1 Licensed website". | Clearest match under the author's own terms. The Convert clause may still call for written confirmation that SVG outlines are fine. |
| C. **Written permission or custom license from the studio** | Unknown | The license page invites "contact us for a custom license". | Contact: contact@abodaniel.com (from the license PDF). Ask specifically about a static SVG outline of one word on a personal portfolio. |
| D. **Switch to an OFL script font** | Free | OFL FAQ 1.1 says the fonts can be used "for any kind of design work". FAQ 1.1.1 says you remain the copyright holder of the graphic you create ([OFL FAQ](https://openfontlicense.org/ofl-faq/)). | Regenerate the paths with the same pipeline. No license ambiguity at all. |
| E. Keep as-is | n/a | **Not supported by any text found.** | The author's page threatens a 10x fee for unlicensed use. |

OFL alternatives with a similar fine-tip signature feel. Each was confirmed as `license: "OFL"` in the Google Fonts repo's `METADATA.pb`, with an `OFL.txt` present:

- **Ms Madi** (Robert Leuschke). Google describes it as "a monoline hand written script". It is the closest to La Storia's monoline stroke. https://github.com/google/fonts/tree/main/ofl/msmadi
- **Mrs Saint Delafield** (Sudtipos). A revival of the Bluemlein scripts, which were built from collected signatures. https://github.com/google/fonts/tree/main/ofl/mrssaintdelafield
- **Herr Von Muellerhoff** (Sudtipos). From the same Bluemlein collection, with a looser, signature-like slant. https://github.com/google/fonts/tree/main/ofl/herrvonmuellerhoff
- Also OFL, with more contrast and less of a monoline look: Whisper, Allura and Hurricane, all by Robert Leuschke (same repo, `ofl/<name>`).

Which of these reads best as "Lawrence" is a visual call that this research doesn't settle.
