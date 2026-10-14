INSERT OR IGNORE INTO work_windows(id, weekday, start_min, end_min) VALUES
  (lower(hex(randomblob(16))), 1, 600, 1140),
  (lower(hex(randomblob(16))), 2, 600, 1140),
  (lower(hex(randomblob(16))), 3, 600, 1140),
  (lower(hex(randomblob(16))), 4, 600, 1140),
  (lower(hex(randomblob(16))), 5, 600, 1140);
