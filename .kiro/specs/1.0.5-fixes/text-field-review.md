# Library card text fields — single-line → multi-line review

Some users said the single-line text field is too short. Below is every
single-line `text_input` field in the curated library (`src/data/curatedLibrary.ts`),
so you can decide which to convert to multi-line (`text_area`).

**How to use this file:** put an `x` in the **Convert?** column for each field you
want changed to multi-line, then hand it back. Leave blank to keep single-line.

**Legend:**
- `text_input` = single-line (the short one users complained about)
- `text_area` = multi-line (grows to fit longer entries)
- "Rec" = my recommendation (multi = convert, keep = leave single-line)

**Operational note:** changing these only affects tools added to the wallet
*after* the update ships — cards already in a user's wallet keep the field type
they had when added (no over-the-air card update). This improves future adds.

---

## Grounding & Calming

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [x] | 5-4-3-2-1 Grounding | 2 things you can SMELL | 200 | multi |
| [x] | 5-4-3-2-1 Grounding | 1 thing you can TASTE | 200 | multi |
| [x] | 5-4-3-2-1 Grounding | Reflection | 200 | multi |
| [ ] | Name It to Tame It | What emotion are you feeling right now? | 200 | keep |

_(Note: on 5-4-3-2-1, the SEE / TOUCH / HEAR fields are already multi-line;
converting SMELL + TASTE would make all five consistent.)_

## Cognitive Reframing

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [x] | Thought – Feeling – Action | Thought | 200 | multi |
| [ ] | Thought – Feeling – Action | Feeling | 200 | keep |
| [x] | Thought – Feeling – Action | Action | 200 | multi |
| [x] | Evidence For & Against | The belief | 200 | multi |

_(Note: Evidence For & Against's two "evidence" fields are already multi-line.)_

## Daily Check-In & Journaling

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [x] | Daily Check-In | What's on your mind? | 200 | multi (likely the main complaint) |
| [x] | Evening Gratitude | What are you grateful for today? | 200 | multi |
| [x] | Evening Gratitude | What can you let go of tonight? | 200 | multi |
| [x] | Three Good Things | 1. First good thing | 200 | multi (optional) |
| [x] | Three Good Things | 2. Second good thing | 200 | multi (optional) |
| [x] | Three Good Things | 3. Third good thing | 200 | multi (optional) |

_(Note: "Win of the Day" is already multi-line.)_

## Body & Sensory

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [ ] | Sensory Comfort Kit | What did you choose? | 150 | keep |
| [x] | Sensory Comfort Kit | How did it feel? | 200 | multi |

## Self-Compassion

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [x] | Permission Slip | I give myself permission to... | 200 | multi |

## Lightweight Connection

| Convert? | Card | Field label | maxLength | Rec |
|:---:|---|---|:---:|:---:|
| [ ] | Gratitude Message | Who will you thank? | 100 | keep (a name) |
| [ ] | Active Listening Practice | Who did you listen to? | 100 | keep (a name) |

_(Note: Gratitude Message's "Your message" body is already multi-line.)_

---

## Summary of my recommendation
- **Convert (10):** 5-4-3-2-1 SMELL, TASTE, Reflection; Thought; Action; The belief;
  Daily Check-In "What's on your mind?"; Evening Gratitude (both); Sensory "How did it feel?";
  Permission Slip. _(and optionally the three "Three Good Things" fields)_
- **Keep single-line (6):** Name It to Tame It emotion; Feeling; Sensory "What did you choose?";
  both name fields (Gratitude Message, Active Listening).

## Open question for you
- Do multi-line fields still need a maxLength cap? Today the single-line ones cap at
  150–200. Multi-line can keep a cap (e.g. bump to 500) or drop it. Tell me your preference.
