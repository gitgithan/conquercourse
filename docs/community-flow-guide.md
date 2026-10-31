# Community flow: click by click

## So what
- Community opens on finished work first, so you see what a completed creation looks like before you make one.
- Then one clear button, **Make your own**, takes you into the making flow.
- The making flow is one screen: Photo, Mark, Segment, Choose, Make.
- You never choose "wallpaper or object" up front.
- You mark areas once; each marked area can become a piece or a wallpaper.
- It is behind a switch: add `?flow=1` to the address, or open the preview address (it is on there).
- `?flow=0` brings back the old screens.

## How to open it
- Preview: `https://preview.conquercourse.pages.dev/?mode=communities&welcome=0`
- Anywhere else: add `&flow=1` to `?mode=communities&welcome=0`.
- The old gallery address (`?mode=gallery`) opens Explore.
- `&tab=make` opens the making flow directly.

## The two tabs
- **Explore** (opens first), top to bottom:
  - Courses people made: the finished courses, each card with a Play button.
  - Now make your own: the **Make your own** button.
  - Pieces and wallpapers: finished examples first (sample places as wallpapers, our example pieces with their credit lines), then yours from this browser.
- **Make your own**: the stepper below. Your marks stay if you look at Explore and come back.

## Click by click (Make your own tab)
1. **Photo.**
   - Click "Choose file" and pick a JPEG, or click one of our sample place photos.
   - You land on Mark by yourself.
2. **Mark.**
   - Click the photo: a ready-made box drops where you clicked.
   - Or drag on the photo to draw your own box.
   - Drag a box to move it; drag the green corner to resize it.
   - Ctrl+C and Ctrl+V copy and paste, Delete removes, Ctrl+Z undoes.
   - Press "Next: Segment" when at least one area is marked.
3. **Segment.**
   - Press **Segment Region(s)**.
   - The server finds exact outlines; each of your boxes takes the outline that sits on it.
   - Blue shapes show the outlines; chips below list your areas.
   - A "+ stairs" button means it found something you did not mark; click it to add it.
   - "Skip: use my boxes as they are" goes on without outlines (use it if the job is off).
4. **Choose.**
   - Each area has a small picture, a name box and two buttons: **3D piece** and **Wallpaper**.
   - Name a piece with a plain word (bench, railing, stairs, wall).
   - Press a button again to un-choose it.
   - "Next: Make" opens when at least one area has a choice.
5. **Make.**
   - A 3D piece shows **Generate Piece**; press it and wait (the first one of a day can take minutes).
   - The piece is saved in this browser and appears in the World Editor tray as "📷 Mine: name".
   - A wallpaper shows a name, a course list and **Save wallpaper**; the crop is your box widened to the course's wide look.
   - "What next" then offers: Open the World Editor, Play a course with the wallpaper, See them in Explore, Start with another photo.

## What the wallpaper path looks like
- It is the same marks, so there is no second crop tool.
- At Choose you press **Wallpaper** for that area.
- At Make you pick the course it hangs behind and press Save wallpaper.
- "Play a course with the wallpaper" opens that course with `&wallpaper=<id>` and the crop is the sky behind the lane.
- It is looks only; the course plays the same.

## Things to know (gaps)
- Segmentation finds outlines on its own; it does not take a mark as a hint. Marks pick the outline that sits on them.
- Wallpapers and pieces stay in this browser. Sharing waits for the safety check and approval (CC-249).
- The World Editor "Share to Community" button and the contributed-photo rule are not built yet.
- The example pieces in Explore are pictures with credits; they open the World Editor, not a 3D view.
- The wallpaper shows only on the Course screen, and only with `?wallpaper=<id>` in the address.
- The tray badge is a camera sign on the "Mine:" buttons; the place name is not on it yet.
- Pieces appear in the tray only with `?uploadobj=1` (the "Open the World Editor" button adds it).
- Generate Piece uses the paid photo-to-3D job; the existing daily limits and safety check apply. Nothing was run for real in the tests (the API is stubbed).
- Desktop at 1280 px only.
