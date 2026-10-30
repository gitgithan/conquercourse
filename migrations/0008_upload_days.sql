-- NOT YET APPLIED to the live database (CC-221, CC-108): needs the owner's yes.
-- One row per day and player for the photo -> 3D object slots; the row with player '*' is the whole game's total for that day.
-- A slot is taken with one conditional update, so two requests cannot both take the last one, whichever server answers.
CREATE TABLE IF NOT EXISTS upload_days (
  day TEXT NOT NULL,
  player TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, player)
);
