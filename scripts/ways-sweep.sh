#!/bin/bash
# Tuning sweep for the Two ways course: one line per setting with the proved time of each way. Settings run side by side.
# Usage: scripts/ways-sweep.sh "BAR_Y=3.1" "JOIN=40 LOWTOP=-6.7 LEDGE=1 BARS=27,31.5" ...
i=0
for cfg in "$@"; do
  i=$((i+1)); f=/tmp/tw-sweep-$i.json
  ( env $cfg OUT=$f npx tsx scripts/make-two-ways-course.ts && echo "== $cfg" > $f.txt && npx tsx scripts/ways-plan.ts $f 2>&1 | grep -E "^(high|low)" >> $f.txt ) &
done
wait
for j in $(seq 1 $i); do cat /tmp/tw-sweep-$j.json.txt; done
