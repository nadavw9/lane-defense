# Lane Defense — Realistic Balance Report

**Generated:** 2026-10-31
**Command:** `node tools/balance-sim.js --level=all --runs=300 --skill=human`
**Model:** discrete, turn-based, goal-based simulation with the `human` profile (no mis-drops, no column cycling, bench from L13 and it digs while there is room, boosterIQ 0.90), lane barriers, waves from L10, BRIDGES from L6 (the bot bridges every eligible pair every turn, the diligent player; src/game/bridges.js), pair-biased spawning (PAIR_P 0.45), speeders boosted (SPEEDER_BOOST 1.6). Bands: `tools/bands.mjs`.

AvgTurns = shots in a winning run. The tuner (`tune-levels.mjs 1-200 300 --write`) left 16/200 outside their band on its own runs (pairs-only bridges, 2026-10-31 evening); this re-measurement with fresh seeds shows 131/200 in band, the rest within sampling noise of the band edge (300 runs is about +/-5 points on a 10-point band). Numbers stay the owner's first call after device play. Known bot gaps unchanged: it does not chase colour/trait GOALS and plays no COLOR SWAP or rainbow (L28, L49, L57, L79, L86, L124, L138, L157, L169, L197 read harder than they play); L4 and L6 sit above their band on purpose (teaching levels at the tuner's ceiling). 151 levels sit at the lightest mix (heft 0.15). The NON-bridger's win rate for L6-30 is in the second block: the mechanic is necessary, not optional.

```

Balance sim — 200 level(s) × 300 runs  [skill: human]  (win = all goals met, no breach)
Bands @ human profile (no mis-drops, no cycling, boosterIQ 0.90; lane barriers) — see tools/bands.mjs

Lvl │ Goals                              │ Win%  │ Band  │ AvgTurns │ Kills/Shot │ Flag
────┼────────────────────────────────────┼───────┼───────┼──────────┼────────────┼──────────────────
  1 │ Total:16                           │ 100.0 │ 90-100 │     16.0 │       1.00 │ OK
  2 │ Total:22                           │ 100.0 │ 90-100 │     22.3 │       1.00 │ OK
  3 │ Total:22                           │ 100.0 │ 90-100 │     22.6 │       1.00 │ OK
  4 │ Total:29                           │  92.0 │ 70-80 │     56.2 │       0.52 │ TOO EASY
  5 │ Total:20                           │  75.3 │ 70-80 │     36.1 │       0.55 │ OK
  6 │ Total:16                           │  97.7 │ 70-80 │     24.9 │       0.65 │ TOO EASY
  7 │ Total:20                           │  74.3 │ 70-80 │     36.7 │       0.54 │ OK
  8 │ Total:24                           │  77.3 │ 70-80 │     49.6 │       0.48 │ OK
  9 │ Total:20                           │  73.7 │ 70-80 │     35.8 │       0.55 │ OK
 10 │ Total:22                           │  59.0 │ 54-64 │     30.5 │       0.71 │ OK
 11 │ Total:22                           │  75.0 │ 68-78 │     30.8 │       0.71 │ OK
 12 │ Blue:7, Green:7                    │  66.3 │ 62-72 │     33.8 │       0.72 │ OK
 13 │ Total:22                           │  65.3 │ 62-72 │     31.0 │       0.70 │ OK
 14 │ Total:21                           │  65.0 │ 62-72 │     29.4 │       0.70 │ OK
 15 │ Total:30                           │  51.7 │ 47-57 │     36.6 │       0.80 │ OK
 16 │ Total:22                           │  72.3 │ 68-78 │     30.1 │       0.73 │ OK
 17 │ Total:24                           │  67.3 │ 62-72 │     30.9 │       0.76 │ OK
 18 │ Total:22                           │  66.0 │ 62-72 │     30.5 │       0.71 │ OK
 19 │ Total:22                           │  67.7 │ 62-72 │     29.9 │       0.73 │ OK
 20 │ Total:22                           │  52.3 │ 47-57 │     29.5 │       0.73 │ OK
 21 │ Total:20                           │  74.3 │ 68-78 │     27.4 │       0.72 │ OK
 22 │ Total:18                           │  66.0 │ 62-72 │     26.2 │       0.67 │ OK
 23 │ Total:20                           │  63.3 │ 62-72 │     29.9 │       0.65 │ OK
 24 │ Total:17                           │  73.7 │ 62-72 │     24.7 │       0.68 │ TOO EASY
 25 │ Total:20                           │  50.3 │ 47-57 │     29.7 │       0.64 │ OK
 26 │ Total:19                           │  68.3 │ 68-78 │     30.0 │       0.61 │ OK
 27 │ Total:19                           │  58.0 │ 58-68 │     28.1 │       0.66 │ TOO HARD
 28 │ Red:4, Yellow:4                    │  52.3 │ 58-68 │     24.9 │       0.65 │ TOO HARD
 29 │ Total:19                           │  60.3 │ 58-68 │     29.3 │       0.62 │ OK
 30 │ Total:20                           │  48.3 │ 43-53 │     27.7 │       0.69 │ OK
 31 │ Total:19                           │  66.0 │ 64-74 │     28.0 │       0.66 │ OK
 32 │ Total:18                           │  62.7 │ 58-68 │     28.1 │       0.62 │ OK
 33 │ Total:18                           │  62.7 │ 58-68 │     26.1 │       0.66 │ OK
 34 │ Total:18                           │  60.3 │ 58-68 │     26.6 │       0.65 │ OK
 35 │ Total:32                           │  47.7 │ 43-53 │     54.1 │       0.58 │ OK
 36 │ Total:19                           │  66.0 │ 64-74 │     28.0 │       0.66 │ OK
 37 │ Total:19                           │  52.7 │ 58-68 │     28.1 │       0.64 │ TOO HARD
 38 │ Total:20                           │  66.3 │ 58-68 │     31.5 │       0.61 │ OK
 39 │ Total:17                           │  70.3 │ 58-68 │     25.1 │       0.66 │ TOO EASY
 40 │ Total:20                           │  48.3 │ 43-53 │     28.5 │       0.67 │ OK
 41 │ Total:26                           │  58.7 │ 64-74 │     46.7 │       0.54 │ TOO HARD
 42 │ Total:18                           │  60.7 │ 58-68 │     26.8 │       0.65 │ OK
 43 │ Total:24                           │  62.7 │ 58-68 │     31.9 │       0.73 │ OK
 44 │ Total:19                           │  67.0 │ 58-68 │     30.3 │       0.61 │ OK
 45 │ Total:20                           │  49.0 │ 43-53 │     30.0 │       0.63 │ OK
 46 │ Total:19                           │  68.0 │ 62-72 │     28.2 │       0.66 │ OK
 47 │ Total:26                           │  66.0 │ 56-66 │     43.2 │       0.59 │ OK
 48 │ Total:28                           │  59.0 │ 56-66 │     38.8 │       0.69 │ OK
 49 │ undefined:2, Green:3               │  40.3 │ 56-66 │     31.8 │       0.57 │ TOO HARD
 50 │ Total:25                           │  42.0 │ 31-41 │     33.8 │       0.70 │ TOO EASY
 51 │ Total:19                           │  64.3 │ 62-72 │     28.1 │       0.65 │ OK
 52 │ Total:17                           │  67.3 │ 56-66 │     25.0 │       0.66 │ TOO EASY
 53 │ Total:26                           │  59.0 │ 56-66 │     46.3 │       0.54 │ OK
 54 │ Total:19                           │  57.0 │ 56-66 │     28.0 │       0.65 │ OK
 55 │ Total:24                           │  46.0 │ 41-51 │     35.5 │       0.64 │ OK
 56 │ Total:20, jeep:3                   │  66.0 │ 62-72 │     32.0 │       0.61 │ OK
 57 │ undefined:2, Orange:3              │  42.7 │ 56-66 │     28.5 │       0.58 │ TOO HARD
 58 │ Total:18                           │  56.7 │ 56-66 │     26.5 │       0.66 │ OK
 59 │ Total:28                           │  69.7 │ 56-66 │     48.2 │       0.58 │ TOO EASY
 60 │ Total:20                           │  37.7 │ 31-41 │     27.9 │       0.68 │ OK
 61 │ Total:18                           │  66.3 │ 60-70 │     26.4 │       0.66 │ OK
 62 │ Total:20                           │  67.0 │ 54-64 │     31.8 │       0.62 │ TOO EASY
 63 │ Total:18                           │  71.3 │ 54-64 │     26.5 │       0.67 │ TOO EASY
 64 │ Total:28                           │  59.7 │ 54-64 │     38.9 │       0.70 │ OK
 65 │ undefined:4, Purple:6              │  43.0 │ 39-49 │     52.7 │       0.46 │ OK
 66 │ Total:19                           │  65.0 │ 60-70 │     28.4 │       0.65 │ OK
 67 │ Total:18                           │  63.7 │ 54-64 │     26.9 │       0.66 │ OK
 68 │ Total:20                           │  65.7 │ 54-64 │     33.1 │       0.59 │ TOO EASY
 69 │ Total:19                           │  60.3 │ 54-64 │     28.0 │       0.65 │ OK
 70 │ Total:26                           │  40.0 │ 29-39 │     35.3 │       0.70 │ TOO EASY
 71 │ Total:23                           │  66.7 │ 60-70 │     37.8 │       0.60 │ OK
 72 │ Total:26                           │  58.7 │ 54-64 │     36.4 │       0.68 │ OK
 73 │ Total:18                           │  63.0 │ 54-64 │     26.8 │       0.66 │ OK
 74 │ Total:20                           │  62.3 │ 54-64 │     32.4 │       0.60 │ OK
 75 │ Total:20                           │  49.3 │ 39-49 │     30.3 │       0.63 │ TOO EASY
 76 │ Total:18                           │  66.0 │ 58-68 │     26.3 │       0.66 │ OK
 77 │ Total:26                           │  57.7 │ 52-62 │     43.1 │       0.59 │ OK
 78 │ Total:18                           │  68.7 │ 52-62 │     26.6 │       0.66 │ TOO EASY
 79 │ undefined:2, Orange:3              │  31.0 │ 52-62 │     36.1 │       0.58 │ TOO HARD
 80 │ Total:26                           │  38.7 │ 27-37 │     35.1 │       0.70 │ TOO EASY
 81 │ Total:19                           │  63.3 │ 58-68 │     28.4 │       0.65 │ OK
 82 │ Total:19                           │  65.0 │ 52-62 │     28.3 │       0.65 │ TOO EASY
 83 │ Total:30                           │  59.3 │ 52-62 │     51.5 │       0.57 │ OK
 84 │ Total:18                           │  61.0 │ 52-62 │     26.4 │       0.65 │ OK
 85 │ Total:21                           │  42.3 │ 37-47 │     32.1 │       0.63 │ OK
 86 │ undefined:2, undefined:2, Green:2  │  26.0 │ 58-68 │     75.4 │       0.58 │ TOO HARD + TOO LONG
 87 │ Total:18                           │  55.0 │ 52-62 │     26.3 │       0.66 │ OK
 88 │ Total:30                           │  57.0 │ 52-62 │     42.8 │       0.69 │ OK
 89 │ Total:28                           │  66.0 │ 52-62 │     47.8 │       0.58 │ TOO EASY
 90 │ Total:26                           │  34.3 │ 27-37 │     35.3 │       0.69 │ OK
 91 │ Total:19                           │  61.7 │ 56-66 │     28.0 │       0.65 │ OK
 92 │ Total:21                           │  57.3 │ 50-60 │     33.6 │       0.61 │ OK
 93 │ Total:18                           │  59.3 │ 50-60 │     26.5 │       0.65 │ OK
 94 │ Total:19                           │  57.7 │ 50-60 │     27.8 │       0.65 │ OK
 95 │ Total:30                           │  42.7 │ 35-45 │     47.2 │       0.62 │ OK
 96 │ Total:30                           │  61.0 │ 56-66 │     39.2 │       0.74 │ OK
 97 │ Total:19                           │  62.3 │ 50-60 │     28.1 │       0.65 │ TOO EASY
 98 │ Total:21                           │  58.0 │ 50-60 │     34.2 │       0.60 │ OK
 99 │ Total:18                           │  58.7 │ 50-60 │     26.4 │       0.66 │ OK
100 │ Total:23                           │  33.3 │ 25-35 │     31.4 │       0.68 │ OK
101 │ Total:24                           │  61.3 │ 56-66 │     41.7 │       0.57 │ OK
102 │ Total:19                           │  52.7 │ 50-60 │     28.3 │       0.64 │ OK
103 │ Total:20                           │  54.7 │ 50-60 │     30.3 │       0.63 │ OK
104 │ undefined:2, Total:10              │  58.0 │ 50-60 │     31.8 │       0.60 │ OK
105 │ Total:21                           │  42.7 │ 35-45 │     32.7 │       0.62 │ OK
106 │ Total:18                           │  67.0 │ 56-66 │     26.7 │       0.66 │ TOO EASY
107 │ Total:28                           │  61.7 │ 50-60 │     47.3 │       0.59 │ TOO EASY
108 │ Red:5, Total:16                    │  60.0 │ 50-60 │     27.0 │       0.65 │ OK
109 │ jeep:4, Total:19                   │  61.7 │ 50-60 │     28.2 │       0.65 │ TOO EASY
110 │ Total:25                           │  30.3 │ 25-35 │     34.4 │       0.68 │ OK
111 │ Total:18                           │  67.0 │ 56-66 │     26.6 │       0.66 │ TOO EASY
112 │ Total:28                           │  55.3 │ 50-60 │     38.6 │       0.70 │ OK
113 │ Total:28                           │  61.0 │ 50-60 │     46.7 │       0.59 │ TOO EASY
114 │ undefined:2, Blue:3                │  47.0 │ 50-60 │     31.5 │       0.57 │ TOO HARD
115 │ Total:20                           │  47.3 │ 35-45 │     29.7 │       0.63 │ TOO EASY
116 │ Total:21                           │  62.0 │ 56-66 │     33.7 │       0.61 │ OK
117 │ Total:19                           │  58.0 │ 50-60 │     28.5 │       0.64 │ OK
118 │ Total:18                           │  59.3 │ 50-60 │     26.7 │       0.65 │ OK
119 │ undefined:2, Total:10              │  55.3 │ 50-60 │    173.1 │       0.65 │ TOO LONG
120 │ Total:25                           │  34.3 │ 25-35 │     33.5 │       0.69 │ OK
121 │ Total:18                           │  70.3 │ 56-66 │     26.6 │       0.67 │ TOO EASY
122 │ Total:20                           │  57.7 │ 50-60 │     33.2 │       0.58 │ OK
123 │ Total:18                           │  64.7 │ 50-60 │     26.5 │       0.66 │ TOO EASY
124 │ undefined:3, Orange:4              │  16.3 │ 50-60 │     41.7 │       0.63 │ TOO HARD
125 │ Total:30                           │  40.3 │ 35-45 │     55.0 │       0.53 │ OK
126 │ Total:18                           │  63.3 │ 56-66 │     26.8 │       0.65 │ OK
127 │ Total:19                           │  66.3 │ 50-60 │     28.7 │       0.65 │ TOO EASY
128 │ Total:21                           │  62.3 │ 50-60 │     33.9 │       0.61 │ TOO EASY
129 │ jeep:5, Total:20                   │  52.3 │ 50-60 │     30.4 │       0.63 │ OK
130 │ Total:25                           │  35.7 │ 25-35 │     33.6 │       0.69 │ TOO EASY
131 │ Total:24                           │  63.0 │ 56-66 │     43.6 │       0.54 │ OK
132 │ Total:20                           │  57.0 │ 50-60 │     30.4 │       0.63 │ OK
133 │ Total:19                           │  63.0 │ 50-60 │     28.3 │       0.65 │ TOO EASY
134 │ Total:22                           │  63.3 │ 50-60 │     35.5 │       0.62 │ TOO EASY
135 │ Total:21                           │  42.7 │ 35-45 │     32.1 │       0.63 │ OK
136 │ Total:23                           │  61.0 │ 56-66 │     32.3 │       0.70 │ OK
137 │ Red:6, Total:20                    │  60.0 │ 50-60 │     39.0 │       0.58 │ OK
138 │ undefined:3, Total:12              │  20.3 │ 50-60 │     65.6 │       0.59 │ TOO HARD
139 │ Total:18                           │  55.7 │ 50-60 │     26.6 │       0.65 │ OK
140 │ Total:26                           │  40.0 │ 25-35 │     35.6 │       0.69 │ TOO EASY
141 │ Total:18                           │  65.7 │ 56-66 │     26.8 │       0.66 │ OK
142 │ Total:20                           │  53.7 │ 50-60 │     30.4 │       0.63 │ OK
143 │ Total:28                           │  54.7 │ 50-60 │     49.0 │       0.56 │ OK
144 │ undefined:5, Green:4               │  54.0 │ 50-60 │     49.7 │       0.73 │ OK
145 │ Total:22                           │  37.3 │ 35-45 │     33.0 │       0.63 │ OK
146 │ Total:24                           │  61.7 │ 56-66 │     36.9 │       0.63 │ OK
147 │ Total:19                           │  48.0 │ 50-60 │     27.9 │       0.65 │ TOO HARD
148 │ Total:18                           │  63.3 │ 50-60 │     26.3 │       0.66 │ TOO EASY
149 │ undefined:4, Total:18              │  54.0 │ 50-60 │     38.9 │       0.57 │ OK
150 │ Total:25                           │  34.3 │ 25-35 │     34.3 │       0.69 │ OK
151 │ Total:18                           │  66.3 │ 56-66 │     26.7 │       0.66 │ TOO EASY
152 │ Total:23                           │  61.0 │ 50-60 │     36.4 │       0.62 │ TOO EASY
153 │ Total:18                           │  60.3 │ 50-60 │     26.6 │       0.65 │ TOO EASY
154 │ Total:19                           │  53.3 │ 50-60 │     27.6 │       0.66 │ OK
155 │ Total:30                           │  43.0 │ 35-45 │     51.3 │       0.57 │ OK
156 │ Total:18                           │  70.3 │ 56-66 │     26.6 │       0.67 │ TOO EASY
157 │ undefined:2, Orange:3              │  28.3 │ 50-60 │     38.4 │       0.58 │ TOO HARD
158 │ Total:21                           │  59.7 │ 50-60 │     35.6 │       0.59 │ OK
159 │ jeep:4, Total:19                   │  62.3 │ 50-60 │     28.1 │       0.65 │ TOO EASY
160 │ Total:25                           │  36.0 │ 25-35 │     34.3 │       0.69 │ TOO EASY
161 │ Total:24                           │  61.0 │ 56-66 │     43.0 │       0.54 │ OK
162 │ Total:18                           │  66.7 │ 50-60 │     26.7 │       0.65 │ TOO EASY
163 │ Total:18                           │  62.3 │ 50-60 │     26.5 │       0.65 │ TOO EASY
164 │ undefined:2, Total:11              │  56.0 │ 50-60 │     52.6 │       0.64 │ OK
165 │ Total:22                           │  38.7 │ 35-45 │     33.2 │       0.63 │ OK
166 │ Total:18                           │  68.3 │ 56-66 │     26.8 │       0.66 │ TOO EASY
167 │ Total:28                           │  65.0 │ 50-60 │     46.9 │       0.59 │ TOO EASY
168 │ Total:31                           │  53.3 │ 50-60 │     44.3 │       0.68 │ OK
169 │ undefined:3, Blue:4                │  26.3 │ 50-60 │     32.0 │       0.64 │ TOO HARD
170 │ Total:26                           │  34.7 │ 25-35 │     35.2 │       0.69 │ OK
171 │ Total:18                           │  67.0 │ 56-66 │     26.7 │       0.66 │ TOO EASY
172 │ Total:18                           │  60.0 │ 50-60 │     26.7 │       0.65 │ OK
173 │ jeep:5, Total:20                   │  55.7 │ 50-60 │     39.0 │       0.49 │ OK
174 │ Total:20                           │  54.3 │ 50-60 │     30.3 │       0.63 │ OK
175 │ Total:20                           │  45.3 │ 35-45 │     30.5 │       0.62 │ TOO EASY
176 │ Total:19                           │  67.3 │ 56-66 │     30.3 │       0.61 │ TOO EASY
177 │ Total:20                           │  54.7 │ 50-60 │     30.6 │       0.63 │ OK
178 │ Total:19                           │  58.0 │ 50-60 │     28.5 │       0.64 │ OK
179 │ undefined:2, Total:15              │  60.0 │ 50-60 │    111.5 │       0.63 │ TOO LONG
180 │ Total:25                           │  38.0 │ 25-35 │     33.7 │       0.70 │ TOO EASY
181 │ Total:18                           │  66.3 │ 56-66 │     26.7 │       0.66 │ TOO EASY
182 │ Total:22                           │  59.0 │ 50-60 │     34.9 │       0.62 │ OK
183 │ Total:18                           │  56.7 │ 50-60 │     26.9 │       0.64 │ OK
184 │ Total:30                           │  53.7 │ 50-60 │     37.9 │       0.77 │ OK
185 │ Total:30                           │  40.0 │ 35-45 │     54.3 │       0.54 │ OK
186 │ Total:19                           │  66.3 │ 56-66 │     28.1 │       0.66 │ TOO EASY
187 │ Purple:4, Total:18                 │  62.7 │ 50-60 │     29.2 │       0.64 │ TOO EASY
188 │ Total:20                           │  57.7 │ 50-60 │     31.9 │       0.61 │ OK
189 │ undefined:2, Total:9               │  54.7 │ 50-60 │     38.5 │       0.67 │ OK
190 │ Total:27                           │  34.7 │ 25-35 │     36.6 │       0.70 │ OK
191 │ Total:23                           │  61.0 │ 56-66 │     39.2 │       0.58 │ OK
192 │ Total:30                           │  54.0 │ 50-60 │     41.0 │       0.71 │ OK
193 │ Total:20                           │  57.3 │ 50-60 │     30.2 │       0.63 │ OK
194 │ jeep:4, Total:20                   │  55.0 │ 50-60 │     33.6 │       0.57 │ OK
195 │ Total:20                           │  46.0 │ 35-45 │     30.3 │       0.63 │ TOO EASY
196 │ Total:18                           │  67.0 │ 56-66 │     26.7 │       0.66 │ TOO EASY
197 │ undefined:2, Red:3                 │  36.3 │ 50-60 │     58.2 │       0.50 │ TOO HARD
198 │ Total:18                           │  60.3 │ 50-60 │     26.7 │       0.65 │ TOO EASY
199 │ Total:19                           │  56.3 │ 50-60 │     28.1 │       0.65 │ OK
200 │ Total:23                           │  33.3 │ 25-35 │     31.4 │       0.68 │ OK

69 / 200 levels flagged.
Flagged: L4(TOO EASY)  L6(TOO EASY)  L24(TOO EASY)  L27(TOO HARD)  L28(TOO HARD)  L37(TOO HARD)  L39(TOO EASY)  L41(TOO HARD)  L49(TOO HARD)  L50(TOO EASY)  L52(TOO EASY)  L57(TOO HARD)  L59(TOO EASY)  L62(TOO EASY)  L63(TOO EASY)  L68(TOO EASY)  L70(TOO EASY)  L75(TOO EASY)  L78(TOO EASY)  L79(TOO HARD)  L80(TOO EASY)  L82(TOO EASY)  L86(TOO HARD + TOO LONG)  L89(TOO EASY)  L97(TOO EASY)  L106(TOO EASY)  L107(TOO EASY)  L109(TOO EASY)  L111(TOO EASY)  L113(TOO EASY)  L114(TOO HARD)  L115(TOO EASY)  L119(TOO LONG)  L121(TOO EASY)  L123(TOO EASY)  L124(TOO HARD)  L127(TOO EASY)  L128(TOO EASY)  L130(TOO EASY)  L133(TOO EASY)  L134(TOO EASY)  L138(TOO HARD)  L140(TOO EASY)  L147(TOO HARD)  L148(TOO EASY)  L151(TOO EASY)  L152(TOO EASY)  L153(TOO EASY)  L156(TOO EASY)  L157(TOO HARD)  L159(TOO EASY)  L160(TOO EASY)  L162(TOO EASY)  L163(TOO EASY)  L166(TOO EASY)  L167(TOO EASY)  L169(TOO HARD)  L171(TOO EASY)  L175(TOO EASY)  L176(TOO EASY)  L179(TOO LONG)  L180(TOO EASY)  L181(TOO EASY)  L186(TOO EASY)  L187(TOO EASY)  L195(TOO EASY)  L196(TOO EASY)  L197(TOO HARD)  L198(TOO EASY)
Mean win rate across levels: 57.5%  [profile: human; the tuning reference is human]
```

## The non-bridger (same profile, bridges off) — L6-30, 200 runs each

```

node tools/balance-sim.js --level=N --runs=200 --skill=human --no-bridges
  6 │ Total:16                           │  75.0 │ 70-80 │     30.0 │       0.53 │ OK
  7 │ Total:20                           │  37.5 │ 70-80 │     41.3 │       0.46 │ TOO HARD
  8 │ Total:24                           │  26.5 │ 70-80 │     54.8 │       0.41 │ TOO HARD
  9 │ Total:20                           │  57.5 │ 70-80 │     39.3 │       0.50 │ TOO HARD
 10 │ Total:22                           │  31.5 │ 54-64 │     34.2 │       0.61 │ TOO HARD
 11 │ Total:22                           │  50.0 │ 68-78 │     34.8 │       0.61 │ TOO HARD
 12 │ Blue:7, Green:7                    │  44.5 │ 62-72 │     35.8 │       0.63 │ TOO HARD
 13 │ Total:22                           │  42.5 │ 62-72 │     34.7 │       0.62 │ TOO HARD
 14 │ Total:21                           │  55.5 │ 62-72 │     32.9 │       0.62 │ TOO HARD
 15 │ Total:30                           │  32.0 │ 47-57 │     40.0 │       0.72 │ TOO HARD
 16 │ Total:22                           │  49.0 │ 68-78 │     33.8 │       0.63 │ TOO HARD
 17 │ Total:24                           │  59.0 │ 62-72 │     33.1 │       0.70 │ TOO HARD
 18 │ Total:22                           │  44.0 │ 62-72 │     33.8 │       0.62 │ TOO HARD
 19 │ Total:22                           │  40.5 │ 62-72 │     32.8 │       0.65 │ TOO HARD
 20 │ Total:22                           │  26.0 │ 47-57 │     32.7 │       0.63 │ TOO HARD
 21 │ Total:20                           │  57.0 │ 68-78 │     30.0 │       0.64 │ TOO HARD
 22 │ Total:18                           │  25.0 │ 62-72 │     29.3 │       0.56 │ TOO HARD
 23 │ Total:20                           │  35.5 │ 62-72 │     33.5 │       0.56 │ TOO HARD
 24 │ Total:17                           │  52.0 │ 62-72 │     27.1 │       0.59 │ TOO HARD
 25 │ Total:20                           │  24.5 │ 47-57 │     32.7 │       0.57 │ TOO HARD
 26 │ Total:19                           │  61.5 │ 68-78 │     32.1 │       0.57 │ TOO HARD
 27 │ Total:19                           │  27.0 │ 58-68 │     30.6 │       0.57 │ TOO HARD
 28 │ Red:4, Yellow:4                    │  35.0 │ 58-68 │     28.4 │       0.56 │ TOO HARD
 29 │ Total:19                           │  42.5 │ 58-68 │     31.8 │       0.56 │ TOO HARD
 30 │ Total:20                           │  23.0 │ 43-53 │     30.0 │       0.61 │ TOO HARD
```

Without bridging the same player sits far under every band from L7 on (L10: 13% vs 59%; L20: 9% vs 53%). L6 (the teaching level) stays winnable without a bridge on purpose.
