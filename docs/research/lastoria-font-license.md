# La Storia ("Lastoria") Bold: can it be used for the portfolio signature?

Researched 2026-09-28. All URLs accessed 2026-09-28. The candidates and resolution sections were added 2026-10-07. This summarizes what the license texts say and lists practical options. It is not legal advice.

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
- **Status (2026-10-07): resolved by route 4.** The signature is now set in Mrs Saint Delafield (SIL OFL 1.1). See [Resolution](#resolution-2026-10-07). The La Storia outlines first committed in `436291e` are gone from the working tree but remain in git history.

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
- **Status:** resolved; the La Storia data has been replaced. See [Resolution](#resolution-2026-10-07).

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

## Free replacement candidates (verified 2026-10-07)

Every Google Fonts file below was read at google/fonts commit [`5e8a3ba`](https://github.com/google/fonts/tree/5e8a3ba899557829a76cfdac30fa512bda91d7ca), which was `main` at 2026-10-07T13:48:24Z. Web pages were accessed 2026-10-07. For each family, the license file in its directory was compared with the canonical [OFL 1.1 text](https://openfontlicense.org/documents/OFL.txt) or [Apache 2.0 text](https://www.apache.org/licenses/LICENSE-2.0.txt), ignoring whitespace, line endings, curly quotes and dash rules. `METADATA.pb` was read for name, designer, license, `date_added` and `source { repository_url }`. The TTF name table was parsed for IDs 0 (copyright) and 5 (version). The GitHub commits API gave the last commit touching the directory at the pinned SHA. The local copies' git blob hashes match the pinned directory listings. **All 22 `OFL.txt` files contain the unaltered OFL 1.1 text, and both `LICENSE.txt` files contain the unaltered Apache 2.0 text**; only the copyright headers differ. **Every last directory commit touched only metadata** (`METADATA.pb`, `upstream_info.md`, or Sacramento's `config.yaml`), never a font or license file. "Version" is name ID 5 without its ttfautohint or gftools suffix. "Copyright / RFN" comes from the license file's header, with the TTF's name ID 0 noted where it differs; "No RFN" means the header declares no Reserved Font Name.

| Font | Designer | License (dir) | Version | Last dir commit | Copyright / RFN | Upstream source |
|---|---|---|---|---|---|---|
| Ms Madi (added 2022-03-24) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/msmadi/OFL.txt) (`ofl/msmadi`) | 1.010 | [`8b0a1d0`](https://github.com/google/fonts/commit/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5), 2026-03-12 | Copyright 2018 The Ms Madi Project Authors. No RFN. | [googlefonts/ms-madi](https://github.com/googlefonts/ms-madi) |
| Mrs Saint Delafield (added 2012-01-11) | Sudtipos | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/mrssaintdelafield/OFL.txt) (`ofl/mrssaintdelafield`) | 1.001 | [`b8ef75d`](https://github.com/google/fonts/commit/b8ef75dffbb06d16c7d59c1831e40d7f8f0d482d), 2026-10-05 | (c) 2011 Alejandro Paul. RFN "Mrs Saint Delafield". TTF and METADATA say 2004. | [googlefonts/mrssaintdelafield](https://github.com/googlefonts/mrssaintdelafield) |
| Herr Von Muellerhoff (added 2011-11-30) | Sudtipos | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/herrvonmuellerhoff/OFL.txt) (`ofl/herrvonmuellerhoff`) | 1.000 | [`eac69e3`](https://github.com/google/fonts/commit/eac69e3635cfa4b9befbbe110df5e693cdd61b8b), 2026-10-05 | (c) 2011 Alejandro Paul. RFN "Herr Von Muellerhoff". **TTF and METADATA say 2004 and RFN "Herr Von Mullerhoff"** (google/fonts' own [`upstream_info.md`](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/herrvonmuellerhoff/upstream_info.md) notes the misspelling). | [googlefonts/herrvonmuellerhoff](https://github.com/googlefonts/herrvonmuellerhoff) |
| Mr Dafoe (added 2011-11-30) | Sudtipos | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/mrdafoe/OFL.txt) (`ofl/mrdafoe`) | 1.000 | [`39a9115`](https://github.com/google/fonts/commit/39a91153e2a80f4ce4c42ffe59f969809f506e4f), 2026-10-05 | (c) 2011 Alejandro Paul. RFN "Mr Dafoe". TTF and METADATA say 2004. | [googlefonts/mrdafoe](https://github.com/googlefonts/mrdafoe) |
| Monsieur La Doulaise (added 2011-11-30) | Sudtipos | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/monsieurladoulaise/OFL.txt) (`ofl/monsieurladoulaise`) | 1.000 | [`bf723d3`](https://github.com/google/fonts/commit/bf723d3f0f5386bc8944235b7d88e09e92127861), 2026-10-05 | (c) 2011 Alejandro Paul. RFN "Monsieur La Doulaise". TTF and METADATA say 2006, and the TTF's RFN is "MonsieurLaDoulaise". | [googlefonts/monsieurladoulaise](https://github.com/googlefonts/monsieurladoulaise) |
| Great Vibes (added 2012-03-29) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/greatvibes/OFL.txt) (`ofl/greatvibes`) | 1.103 | [`c1eda92`](https://github.com/google/fonts/commit/c1eda9233c33ad7775b27efd794f931095cf6133), 2026-03-03 | Copyright 2015 The Great Vibes Pro Project Authors. No RFN. TTF and METADATA say 2010. | [googlefonts/great-vibes](https://github.com/googlefonts/great-vibes) |
| Allura (added 2012-02-08) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/allura/OFL.txt) (`ofl/allura`) | 1.110 | [`fffdadf`](https://github.com/google/fonts/commit/fffdadf0f0c9cc1ec8b407063424a8bfbee05611), 2026-03-03 | Copyright 2010 The Allura Project Authors. No RFN. | [googlefonts/allura](https://github.com/googlefonts/allura) |
| Yellowtail (added 2011-07-20) | Astigmatic | [APACHE2](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/apache/yellowtail/LICENSE.txt) (`apache/yellowtail`) | 001.002 | [`e77fdf0`](https://github.com/google/fonts/commit/e77fdf0f4f6757f773feeea5603898e7d875dceb), 2026-03-25 | LICENSE.txt has no copyright line. TTF: (c) 2011 Brian J. Bonislawsky DBA Astigmatic (AOETI), "All rights reserved. Available under the Apache 2.0 licence." **No NOTICE file.** The TTF has no license fields (name IDs 13 and 14). | [googlefonts/googlefontdirectory-hg](https://github.com/googlefonts/googlefontdirectory-hg) (legacy Google Code mirror, no designer repo) |
| Kaushan Script (added 2012-01-25) | Impallari Type | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/kaushanscript/OFL.txt) (`ofl/kaushanscript`) | 1.002 | [`782024a`](https://github.com/google/fonts/commit/782024a002529169c4978b9c53a7441e4648e1c5), 2026-03-26 | (c) 2011 Pablo Impallari, (c) 2011 Igino Marini. RFN "Kaushan Script". | [librefonts/kaushanscript](https://github.com/librefonts/kaushanscript) |
| Sacramento (added 2012-11-01) | Astigmatic | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/sacramento/OFL.txt) (`ofl/sacramento`) | 1.000 | [`93e33a6`](https://github.com/google/fonts/commit/93e33a6b13d1a7d14d96b0a30892d36ede88ae27), 2026-04-24 | (c) 2012 Brian J. Bonislawsky DBA Astigmatic (AOETI). RFN "Sacramento". | [googlefonts/SacramentoFont](https://github.com/googlefonts/SacramentoFont) |
| Corinthia (added 2021-08-26) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/corinthia/OFL.txt) (`ofl/corinthia`) | 1.013 (Regular and Bold) | [`3dd7884`](https://github.com/google/fonts/commit/3dd78844021e948ceb633d1dcee3f7885561b5d9), 2026-03-03 | Copyright 2010 The Corinthia Project Authors. No RFN. | [googlefonts/corinthia](https://github.com/googlefonts/corinthia) |
| Damion (added 2011-04-27) | Vernon Adams | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/damion/OFL.txt) (`ofl/damion`) | 1.100 | [`7380f7c`](https://github.com/google/fonts/commit/7380f7cebbf2250460c23fd301b51bcbab162edf), 2026-03-03 | Copyright 2014 The Damion Project Authors. No RFN. | [googlefonts/damionFont](https://github.com/googlefonts/damionFont) |
| Satisfy (added 2011-10-12) | Sideshow | [APACHE2](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/apache/satisfy/LICENSE.txt) (`apache/satisfy`) | 1.001 | [`1bf1ba2`](https://github.com/google/fonts/commit/1bf1ba256af8ffbc25714b1152698916e05fe541), 2026-03-25 | LICENSE.txt has no copyright line. TTF: (c) 2011 Font Diner, Inc., "All rights reserved", with name ID 13 naming Apache 2.0. **No NOTICE file.** | [googlefonts/googlefontdirectory-hg](https://github.com/googlefonts/googlefontdirectory-hg) (legacy Google Code mirror, no designer repo) |
| Comforter Brush (added 2021-09-17) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/comforterbrush/OFL.txt) (`ofl/comforterbrush`) | 1.013 | [`3dd7884`](https://github.com/google/fonts/commit/3dd78844021e948ceb633d1dcee3f7885561b5d9), 2026-03-03 | Copyright 2015 The Comforter Brush Project Authors. No RFN. | [googlefonts/comforter-brush](https://github.com/googlefonts/comforter-brush) |
| Water Brush (added 2022-04-07) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/waterbrush/OFL.txt) (`ofl/waterbrush`) | 1.010 | [`8b0a1d0`](https://github.com/google/fonts/commit/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5), 2026-03-12 | Copyright 2004-2021 The Water Brush Project Authors. No RFN. | [googlefonts/water-brush](https://github.com/googlefonts/water-brush) |
| Kolker Brush (added 2021-11-26) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/kolkerbrush/OFL.txt) (`ofl/kolkerbrush`) | 1.010 | [`130fcfb`](https://github.com/google/fonts/commit/130fcfb0ff422fec96b335616b2ca99f91914792), 2026-03-03 | Copyright 2004 The Kolker Brush Project Authors. No RFN. | [googlefonts/kolker-brush](https://github.com/googlefonts/kolker-brush) |
| Dancing Script (added 2011-05-18) | Impallari Type | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/dancingscript/OFL.txt) (`ofl/dancingscript`) | 2.001 (variable, wght) | [`7380f7c`](https://github.com/google/fonts/commit/7380f7cebbf2250460c23fd301b51bcbab162edf), 2026-03-03 | Copyright 2016 The Dancing Script Project Authors. RFN "Dancing Script". | [googlefonts/DancingScript](https://github.com/googlefonts/DancingScript) |
| Marck Script (added 2011-10-12) | Denis Masharov | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/marckscript/OFL.txt) (`ofl/marckscript`) | 1.002 | [`c2ef852`](https://github.com/google/fonts/commit/c2ef852f23814b921f6fa74795fc7fe9556eb343), 2026-09-04 | (c) 2011 Denis Masharov and Marck Fogel. RFN "Marck Script". | [googlefonts/marckscript](https://github.com/googlefonts/marckscript) |
| Cookie (added 2011-10-12) | Ania Kruk | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/cookie/OFL.txt) (`ofl/cookie`) | 1.004 | [`fbacb49`](https://github.com/google/fonts/commit/fbacb4997e84060c219541a38b2435878daa312e), 2026-09-04 | (c) 2011 Ania Kruk. RFN "Cookie". | [googlefonts/cookie](https://github.com/googlefonts/cookie) |
| Norican (added 2012-02-08) | Vernon Adams | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/norican/OFL.txt) (`ofl/norican`) | 1.100 | [`8b0a1d0`](https://github.com/google/fonts/commit/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5), 2026-03-12 | Copyright 2011 The Norican Project Authors. No RFN. | [googlefonts/NoricanFont](https://github.com/googlefonts/NoricanFont) |
| Alex Brush (added 2011-12-19) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/alexbrush/OFL.txt) (`ofl/alexbrush`) | 1.111 | [`fffdadf`](https://github.com/google/fonts/commit/fffdadf0f0c9cc1ec8b407063424a8bfbee05611), 2026-03-03 | Copyright 2011 The Alex Brush Project Authors. No RFN. | [googlefonts/alex-brush](https://github.com/googlefonts/alex-brush) |
| Arizonia (added 2011-12-19) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/arizonia/OFL.txt) (`ofl/arizonia`) | 1.010 | [`95f4904`](https://github.com/google/fonts/commit/95f4904fc8bcf26d3420fe315560c96417c6dec7), 2026-03-03 | Copyright 2007-2021 The Arizonia Project Authors. No RFN. | [googlefonts/arizonia](https://github.com/googlefonts/arizonia) |
| Meddon (added 2011-02-02) | Vernon Adams | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/meddon/OFL.txt) (`ofl/meddon`) | 1.000 | [`30c61ef`](https://github.com/google/fonts/commit/30c61ef30bf7b89629cf20a2f9b52f76f367c400), 2026-03-26 | (c) 2010, 2011 Vernon Adams. RFN "Meddon". TTF name ID 0 omits the RFN, and **name ID 13 still contains the OFL template placeholder** `<URL\|email>`. | [vernnobile/MeddonFont](https://github.com/vernnobile/MeddonFont) |
| Qwigley (added 2011-12-19) | Robert Leuschke | [OFL](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/qwigley/OFL.txt) (`ofl/qwigley`) | 1.010 | [`8b0a1d0`](https://github.com/google/fonts/commit/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5), 2026-03-12 | Copyright 2011 The Qwigley Project Authors. No RFN. | [googlefonts/qwigley](https://github.com/googlefonts/qwigley) |

### A. SIL OFL 1.1: one word's outlines as SVG path data

- **The license attaches to the font files, not to things made with them.** "Font Software" means "the set of files released by the Copyright Holder(s) under this license and clearly marked as such" ([OFL 1.1](https://openfontlicense.org/open-font-license-official-text/)). The grant and every condition concern copies of that Font Software. `src/data/signature.ts` would contain none of those files.
- Condition 5 (and the preamble) says the requirement to stay under the OFL "does not apply to any document created using the Font Software".
- The [OFL FAQ](https://openfontlicense.org/ofl-faq/) (version 1.1-update7) covers this use. Entry 1.1 says yes to "logos or other graphics" and to objects "based on their outlines", with "No additional license or permission" needed. Entry 1.1.1 says the conditions bite only when you "redistribute, bundle or modify the font itself". Entry 1.13 says a graphic made with an OFL font is not "subject to the OFL". Entry 1.26 treats graphical output that is "not a font" as normal usage.
- **No attribution or license copy is required.** FAQ 1.1.2 says acknowledgement "is not required". SIL's [Using OFL fonts](https://openfontlicense.org/how-to-use-ofl-fonts/) page says that for graphics and websites "you do not need to include the license, copyright, or any other acknowledgement".
- **The Reserved Font Name does not come into it.** Condition 3 stops a "Modified Version of the Font Software" from using the RFN, and it "only applies to the primary font name as presented to the users". No font is shipped, so there is no font name to present.
- **No FAQ entry mentions SVG, path data, or converting text to outlines.** The nearest is 1.14, on extracting embedded fonts from documents, which asks people to "respect the work of the author(s)". Inference: one word, laid out and merged into a single path, is a graphic made with the font, so FAQ 1.1 and the document exception cover it. The "Modified Version" definition includes "changing formats", which a strict reader could stretch to exported outlines, but FAQ 1.1's own examples (laser-cut shapes, cookie cutters) are outline exports treated as design work. The traced centreline strokes are a step further removed and get the same answer.

### B. Apache 2.0 (Yellowtail, Satisfy)

- **The use itself is permitted.** Section 2 grants the right to "reproduce, prepare Derivative Works of, publicly display" and distribute the Work "in Source or Object form" ([Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0)). The only question is which Section 4 conditions attach.
- **Apache 2.0 has no counterpart to the OFL's document exception**, and it never mentions fonts, glyphs or rendered output.
- "Object" form is any form produced by "mechanical transformation or translation of a Source form", including "conversions to other media types". A Derivative Work needs changes that "represent, as a whole, an original work of authorship". Inference: writing the font's own glyph outlines out as SVG path data reads most naturally as a mechanical conversion of part of the Work to another media type, so Object form of the Work, not a Derivative Work. The other reading, that a rendered word is output of using the font and not a copy of the Work, is also defensible. **The text does not settle which applies.**
- If Section 4 applies, it requires (a) giving recipients "a copy of this License", (b) "prominent notices" on modified files, (c) keeping the Work's copyright and attribution notices in the Source form of any Derivative Works, and (d) carrying over a NOTICE file's attributions. **Neither `apache/yellowtail` nor `apache/satisfy` has a NOTICE file at the pinned commit**, so (d) asks for nothing.
- Inference: keeping the font's copyright line and the Apache 2.0 license (a copy, or at least its URL) next to the path data would cover (a) to (c) under the stricter reading, and costs nothing under the looser one. The text also does not say whether site visitors who receive the SVG count as "recipients" who must get a copy of the license.

## Resolution (2026-10-07)

- **We switched to route 4.** The signature is now "Lawrence" set in **Mrs Saint Delafield** by Sudtipos (Alejandro Paul). All 24 fonts in the table above had their licenses checked and were traced. Seven were dropped on a first look: Comforter, Water and Kolker Brush, whose rough edges bloat the data to 19–56 KB, and Arizonia, Marck Script, Meddon and Qwigley, for letters that don't join or heavy early ink. Of the 17 left, seven made the shortlist, and Lawrence chose from an example page of those seven.
- **License: SIL Open Font License 1.1.** Source: [`ofl/mrssaintdelafield`](https://github.com/google/fonts/tree/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/mrssaintdelafield) at google/fonts commit `5e8a3ba899557829a76cfdac30fa512bda91d7ca` (`main` at 2026-10-07T13:48:24Z). The file is `MrsSaintDelafield-Regular.ttf`, **version 1.001** (name ID 5). Its [`OFL.txt`](https://github.com/google/fonts/blob/5e8a3ba899557829a76cfdac30fa512bda91d7ca/ofl/mrssaintdelafield/OFL.txt) is the unaltered OFL 1.1 text, "Copyright (c) 2011 Alejandro Paul", with the Reserved Font Name "Mrs Saint Delafield". The upstream repo is [googlefonts/mrssaintdelafield](https://github.com/googlefonts/mrssaintdelafield).
- **Why the OFL permits this use.** The OFL governs the Font Software, meaning the font files. `src/data/signature.ts` contains no font file. It holds one word's glyph outlines, rendered into a single SVG path, plus centrelines traced from a raster of that path. Inference ([Section A](#a-sil-ofl-11-one-words-outlines-as-svg-path-data)): that makes it a document made with the font, not a redistribution of the font software. Condition 5 says the license "does not apply to any document created using the Font Software". OFL FAQ 1.1 allows "logos or other graphics" and objects "based on their outlines", with "No additional license or permission". No FAQ entry names SVG or path data. A strict reader could stretch "changing formats" in the Modified Version definition to exported outlines, but the FAQ's own outline-export examples count as design work. Attribution is not required (FAQ 1.1.2). The data file's header credits the font anyway. The Reserved Font Name doesn't come into it, because no font, modified or not, is distributed. Section A has the citations.
- **The La Storia outlines are gone from the working tree, but git history still has them.** They were added in `436291e` and remain in every commit up to the replacement. History was not rewritten.

### How `src/data/signature.ts` was generated

The generator was a throwaway script outside the repo, and it added no dependencies here.

1. **Shaping.** harfbuzzjs 1.6.3 shaped "Lawrence" with HarfBuzz's default features. This font has no GSUB features and one GPOS feature, `kern`, which HarfBuzz applied. Its letters join through overlaps drawn into the glyphs. Each glyph's outline came from `glyphToJson` at its shaped position. Outlines were flipped to y-down and scaled so the ink is 1180 units wide, with 14 units of padding (viewBox 1208 × 353.5). They were kept as TrueType quadratics, filled nonzero, and rounded to 0.1.
2. **Raster.** resvg-js 2.6.2 drew the outline at 4 px per unit (4832 × 1414 px). Pixels with alpha ≥ 0.5 count as ink. Specks and holes of 40 px or less were removed.
3. **Skeleton.** scikit-image 0.26 `skeletonize` (Zhang-Suen thinning), plus SciPy's Euclidean distance transform for stroke radii.
4. **Graph and pruning.** Endpoints and clusters of junction pixels became nodes, and the pixel chains between them became edges. Two junctions joined by a link shorter than 1.2 × the sum of their radii were merged, because the skeleton splits one crossing in two. A spur shorter than 4 node radii was pruned only if the rest of the skeleton still covered its ink within maskWidth/2 minus 1.5 raster px (0.375 units). That pruned 1 spur here.
5. **Pen order.**
   - Connected pieces of ink are drawn left to right, with small marks after the main stroke.
   - Each piece starts at its leftmost endpoint, skipping short upward stem tips. A piece with no usable endpoint starts at its top junction, heading counter-clockwise; this is how the a's bowl gets drawn before its stem.
   - At a junction the pen prefers edges that don't strand unvisited ink (Fleury's rule), then the smallest turn.
   - A dead end of 3.5 node radii or less is retraced inline. A longer one ends the stroke, and the next stroke starts at the most recent junction with unused edges. If that junction is within 2.5 radii, the pen joins it without lifting.
   - The result is 9 strokes.
6. **Fitting.**
   - Each stroke was resampled every 0.5 px, smoothed with a Gaussian (σ = 1 unit) and split wherever the pen reverses or turns more than 70°.
   - The pieces were fitted with cubic Béziers (Schneider's algorithm, 0.6-unit tolerance) and rounded to 0.1.
   - Lengths were measured on the rounded curves.
7. **maskWidth: 23.9.** That is twice the largest stroke radius on the skeleton away from junctions (10.96 units), plus a 2-unit margin. One spot of ink still out of reach at that width got a short out-and-back detour from the nearest point on the path, so it is revealed as the pen passes.
8. **Checks.**
   - At full progress, the mask covers every ink pixel at 4 px per unit.
   - Early ink is measured at 2 px per unit. For each ink pixel, it compares two pen positions, both measured as arc length along all strokes in order. The first is where the mask first covers the pixel. The second is where the path first passes close enough to own it: within that point's local stroke radius plus 0.75 units. A pixel counts as early when the first comes more than one maskWidth before the second. 2.66% of this signature's ink is early, mostly where strokes touch. La Storia's shipped strokes score 1.55% on the same measure and leave 49 px uncovered at 4 px per unit.
   - As a sanity check, the same pipeline run on the La Storia outline gave maskWidth 22.6 (shipped: 22.2) and left nothing uncovered.
   - The data file is 10.5 KB; La Storia's was 17.2 KB.
