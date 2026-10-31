# How the Community area is organised (proposal, 2026-10-31)

## So what
- Community should be one place with three steps inside it, not three more screens.
- Objects and wallpapers are made inside the course-making flow, not beside it.
- A World Editor course reaches Community only when it uses real photos that a person contributed.

## The one flow
- Photo -> Pick -> Choose -> Make (CC-247 to CC-249).
  - Photo: a person adds a photo of their own neighbourhood.
  - Pick: they tap the thing in the photo (a bench, a rail, a wall).
  - Choose: it becomes a 3D object, or a wallpaper behind the Course.
  - Make: the object joins the pieces tray in the World Editor, or the wallpaper joins a course.

## Screens, before and after
| Now | After | Why |
| --- | --- | --- |
| Communities home | Community (the front door) | Shows photos from places, newest first |
| Gallery of objects | A tab inside Community: Objects | Same data, one less screen |
| Park | A tab inside Community: Places | A place is where the photos were taken |
| Object maker | A step inside Photo -> Pick -> Choose | Making an object is part of adding a photo |
| Course maker | The World Editor (not Community) | A course is built from pieces, wherever they came from |

## Objects and courses
- Objects are a separate idea from courses, but they are made inside the same flow.
- A person never "generates a course" in Community; they generate pieces.
- Pieces appear in the World Editor tray with a small badge showing which place they came from.

## From World Editor to Community
- Owner rule: the editor does not go into Community unless someone contributed real photos from their neighbourhood.
- A course is offered to Community only when at least one piece in it came from a contributed photo.
- A course made only from the built-in pieces stays in Courses and never shows in Community.
- The offer is one button in the editor: "Share to Community", greyed out with the reason in plain words when the rule is not met.

## What this needs
- A `from_photo` flag on each editor piece (the tray already knows where a piece came from).
- The share button check, plus a test that a built-in-only course cannot be shared.
- Nothing about people is added: no names, no accounts (see the private notes rule).
