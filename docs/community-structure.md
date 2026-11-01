# How the Community area is organised (decided 2026-10-31, updated 2026-11-01)

## So what
- Community is one place with two tabs, Explore and Make, not many screens.
- A photo gives 3D pieces; they are made inside the Community flow and used in the World Editor.
- Only 3D pieces are shared; courses come from World Slicing and the Editor.

## Decision: one screen with a stepper (CC-247)
- The flow is three steps on one screen: Photo, Pick, Make.
- Every pick becomes a 3D piece, so there is no choice step.
- The name box sits in step Make.
- You click a thing the finder outlined; there is no box to draw.
- Community opens on Explore, so a person sees what finished work looks like before making any.
- Explore has two parts: **Make your own** (one button) and **Pieces people made**.
- Pieces people made, top to bottom: our examples (only those with a picture), then yours, then pieces shared by players.
- Each card has a small source crop picture, a **See Object** button and a **Use in my World Editor** button.
- See Object opens the same 3D turntable as a new piece.
- The list has a search box (by name) and a **Show more** button.
- There is no courses block and no kind filter.
- Owner (2026-10-31): the old Communities, Park and gallery screens are deleted; the flow is the only Community.
- The click-by-click walkthrough is `docs/community-flow-guide.md`.

## The one flow
- Photo -> Pick -> Make (CC-247 to CC-249).
  - Photo: a person adds a photo of their own neighbourhood.
  - Pick: they click the thing the finder outlined (a bench, a rail, a wall).
  - Make: they name it and press the button; it becomes a 3D piece that joins the pieces tray in the World Editor.

## Screens, before and after
| Now | After | Why |
| --- | --- | --- |
| Communities home | Community (the front door) | Shows what people made, newest first |
| Gallery of objects | Explore, "Pieces people made" | Same data, one less screen |
| Park (photo in, course out) | Removed | Courses come only from World Slicing and the Editor |
| Object maker | The Make tab: Photo, Pick, Make | Making a piece is part of adding a photo |
| Course maker | The World Editor (not Community) | A course is built from pieces, wherever they came from |

## Pieces and courses
- Pieces are a separate idea from courses, but they are made inside the same flow.
- A person never "generates a course" in Community; they generate pieces.
- Pieces appear in the World Editor tray with a small badge showing they came from a photo.

## From World Editor to Community
- Owner rule: the editor does not go into Community unless someone contributed real photos from their neighbourhood.
- A course is offered to Community only when at least one piece in it came from a contributed photo.
- A course made only from the built-in pieces stays in Courses.
- This is not built yet.

## What this needs
- A `from_photo` flag on each editor piece (the tray already knows where a piece came from).
- The share button check, plus a test that a built-in-only course cannot be shared.
- Nothing about people is added: no names, no accounts (see the private notes rule).
