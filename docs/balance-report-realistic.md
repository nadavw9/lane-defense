# Lane Defense — Realistic Balance Report

**Generated:** 2026-10-31
**Command:** `node tools/balance-sim.js --level=all --runs=300 --skill=human`
**Model:** discrete, turn-based, goal-based simulation with the `human` profile (no mis-drops, no column cycling, bench from L13 and it digs while there is room, boosterIQ 0.90), lane barriers, waves from L10, BRIDGES from L6 (the bot bridges every eligible pair every turn, the diligent player; src/game/bridges.js), pair-biased spawning (PAIR_P 0.45), speeders boosted (SPEEDER_BOOST 1.6). Bands: `tools/bands.mjs`.

AvgTurns = shots in a winning run. The tuner (`tune-levels.mjs 1-200 300 --write`) put 185/200 in band; flags beyond the band are noise at 300 runs on some levels. Known bot gaps unchanged: it does not chase colour/trait GOALS and plays no COLOR SWAP or rainbow (L28, L49, L57, L79, L86, L124, L138, L157, L169, L197 read harder than they play); L4 and L6 sit above their band on purpose (teaching levels at the tuner's ceiling). 151 levels sit at the lightest mix (heft 0.15). The NON-bridger's win rate for L6-30 is in the second block: the mechanic is necessary, not optional.

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
  6 │ Total:16                           │  99.0 │ 70-80 │     23.0 │       0.71 │ TOO EASY
  7 │ Total:20                           │  74.7 │ 70-80 │     36.2 │       0.54 │ OK
  8 │ Total:29                           │  73.7 │ 70-80 │     58.0 │       0.50 │ OK
  9 │ Total:20                           │  75.0 │ 70-80 │     35.5 │       0.56 │ OK
 10 │ Total:22                           │  59.0 │ 54-64 │     29.0 │       0.73 │ OK
 11 │ Total:22                           │  73.3 │ 68-78 │     30.9 │       0.71 │ OK
 12 │ Blue:7, Green:7                    │  67.0 │ 62-72 │     31.8 │       0.77 │ OK
 13 │ Total:22                           │  66.3 │ 62-72 │     31.1 │       0.70 │ OK
 14 │ Total:22                           │  67.0 │ 62-72 │     31.2 │       0.70 │ OK
 15 │ Total:30                           │  52.3 │ 47-57 │     35.5 │       0.81 │ OK
 16 │ Total:22                           │  72.0 │ 68-78 │     29.0 │       0.75 │ OK
 17 │ Total:24                           │  67.7 │ 62-72 │     30.7 │       0.77 │ OK
 18 │ Total:22                           │  66.7 │ 62-72 │     29.5 │       0.72 │ OK
 19 │ Total:22                           │  67.7 │ 62-72 │     29.1 │       0.75 │ OK
 20 │ Total:22                           │  52.7 │ 47-57 │     29.7 │       0.71 │ OK
 21 │ Total:22                           │  72.3 │ 68-78 │     29.1 │       0.75 │ OK
 22 │ Total:19                           │  69.0 │ 62-72 │     26.9 │       0.69 │ OK
 23 │ Total:24                           │  68.0 │ 62-72 │     34.9 │       0.68 │ OK
 24 │ Total:18                           │  65.3 │ 62-72 │     25.1 │       0.70 │ OK
 25 │ Total:20                           │  56.7 │ 47-57 │     28.7 │       0.66 │ OK
 26 │ Total:19                           │  70.0 │ 68-78 │     29.0 │       0.64 │ OK
 27 │ Total:19                           │  63.0 │ 58-68 │     27.1 │       0.68 │ OK
 28 │ Red:4, Yellow:4                    │  58.3 │ 58-68 │     25.7 │       0.68 │ OK
 29 │ Total:19                           │  62.7 │ 58-68 │     29.1 │       0.62 │ OK
 30 │ Total:20                           │  48.0 │ 43-53 │     25.9 │       0.72 │ OK
 31 │ Total:19                           │  69.0 │ 64-74 │     27.1 │       0.69 │ OK
 32 │ Total:18                           │  63.7 │ 58-68 │     28.1 │       0.62 │ OK
 33 │ Total:20                           │  58.0 │ 58-68 │     28.7 │       0.66 │ TOO HARD
 34 │ Total:19                           │  65.7 │ 58-68 │     27.1 │       0.68 │ OK
 35 │ Total:32                           │  50.0 │ 43-53 │     53.5 │       0.59 │ OK
 36 │ Total:19                           │  69.0 │ 64-74 │     27.1 │       0.69 │ OK
 37 │ Total:18                           │  62.3 │ 58-68 │     25.7 │       0.68 │ OK
 38 │ Total:22                           │  60.7 │ 58-68 │     34.5 │       0.63 │ OK
 39 │ Total:18                           │  57.0 │ 58-68 │     25.6 │       0.67 │ TOO HARD
 40 │ Total:20                           │  48.3 │ 43-53 │     27.6 │       0.68 │ OK
 41 │ Total:26                           │  59.0 │ 64-74 │     46.1 │       0.55 │ TOO HARD
 42 │ Total:19                           │  65.0 │ 58-68 │     27.1 │       0.68 │ OK
 43 │ Total:24                           │  62.7 │ 58-68 │     31.1 │       0.75 │ OK
 44 │ Total:20                           │  67.0 │ 58-68 │     31.8 │       0.61 │ OK
 45 │ Total:22                           │  51.7 │ 43-53 │     32.0 │       0.66 │ OK
 46 │ Total:19                           │  70.3 │ 62-72 │     27.0 │       0.69 │ OK
 47 │ Total:26                           │  65.0 │ 56-66 │     42.8 │       0.60 │ OK
 48 │ Total:29                           │  60.7 │ 56-66 │     39.9 │       0.70 │ OK
 49 │ undefined:2, Green:3               │  37.7 │ 56-66 │     32.0 │       0.57 │ TOO HARD
 50 │ Total:26                           │  42.0 │ 31-41 │     33.7 │       0.72 │ TOO EASY
 51 │ Total:19                           │  70.7 │ 62-72 │     27.5 │       0.68 │ OK
 52 │ Total:18                           │  54.0 │ 56-66 │     25.1 │       0.67 │ TOO HARD
 53 │ Total:24                           │  63.3 │ 56-66 │     41.7 │       0.56 │ OK
 54 │ Total:18                           │  64.3 │ 56-66 │     25.8 │       0.68 │ OK
 55 │ Total:24                           │  47.0 │ 41-51 │     34.4 │       0.66 │ OK
 56 │ Total:21, jeep:4                   │  68.0 │ 62-72 │     33.5 │       0.62 │ OK
 57 │ undefined:2, Orange:3              │  50.0 │ 56-66 │     29.5 │       0.59 │ TOO HARD
 58 │ Total:18                           │  61.0 │ 56-66 │     25.8 │       0.67 │ OK
 59 │ Total:28                           │  65.7 │ 56-66 │     47.7 │       0.58 │ OK
 60 │ Total:22                           │  35.7 │ 31-41 │     29.3 │       0.71 │ OK
 61 │ Total:19                           │  71.0 │ 60-70 │     27.0 │       0.69 │ TOO EASY
 62 │ Total:21                           │  60.0 │ 54-64 │     33.4 │       0.62 │ OK
 63 │ Total:20                           │  64.3 │ 54-64 │     28.9 │       0.67 │ TOO EASY
 64 │ Total:28                           │  60.0 │ 54-64 │     38.4 │       0.71 │ OK
 65 │ undefined:4, Purple:6              │  43.7 │ 39-49 │     52.5 │       0.45 │ OK
 66 │ Total:19                           │  68.0 │ 60-70 │     27.3 │       0.68 │ OK
 67 │ Total:20                           │  63.7 │ 54-64 │     29.1 │       0.66 │ OK
 68 │ Total:20                           │  67.7 │ 54-64 │     32.7 │       0.60 │ TOO EASY
 69 │ Total:19                           │  65.0 │ 54-64 │     27.2 │       0.68 │ TOO EASY
 70 │ Total:28                           │  33.7 │ 29-39 │     36.8 │       0.71 │ OK
 71 │ Total:25                           │  68.3 │ 60-70 │     41.2 │       0.60 │ OK
 72 │ Total:26                           │  58.7 │ 54-64 │     35.6 │       0.70 │ OK
 73 │ Total:20                           │  60.0 │ 54-64 │     29.3 │       0.65 │ OK
 74 │ Total:22                           │  62.3 │ 54-64 │     35.4 │       0.61 │ OK
 75 │ Total:22                           │  45.0 │ 39-49 │     32.5 │       0.65 │ OK
 76 │ Total:19                           │  66.7 │ 58-68 │     27.3 │       0.68 │ OK
 77 │ Total:22                           │  57.3 │ 52-62 │     37.1 │       0.59 │ OK
 78 │ Total:20                           │  60.0 │ 52-62 │     28.8 │       0.66 │ OK
 79 │ undefined:2, Orange:3              │  31.3 │ 52-62 │     36.0 │       0.59 │ TOO HARD
 80 │ Total:27                           │  36.3 │ 27-37 │     35.4 │       0.72 │ OK
 81 │ Total:18                           │  67.3 │ 58-68 │     25.8 │       0.68 │ OK
 82 │ Total:20                           │  59.7 │ 52-62 │     29.4 │       0.66 │ OK
 83 │ Total:30                           │  61.0 │ 52-62 │     51.6 │       0.58 │ OK
 84 │ Total:20                           │  56.3 │ 52-62 │     29.0 │       0.65 │ OK
 85 │ Total:24                           │  43.0 │ 37-47 │     34.4 │       0.66 │ OK
 86 │ undefined:2, undefined:2, Green:2  │  27.7 │ 58-68 │     75.6 │       0.59 │ TOO HARD + TOO LONG
 87 │ Total:19                           │  64.0 │ 52-62 │     27.3 │       0.67 │ TOO EASY
 88 │ Total:30                           │  57.0 │ 52-62 │     42.4 │       0.68 │ OK
 89 │ Total:28                           │  61.0 │ 52-62 │     47.0 │       0.59 │ OK
 90 │ Total:27                           │  33.3 │ 27-37 │     35.3 │       0.71 │ OK
 91 │ Total:19                           │  66.7 │ 56-66 │     26.8 │       0.69 │ TOO EASY
 92 │ Total:21                           │  57.0 │ 50-60 │     33.5 │       0.62 │ OK
 93 │ Total:20                           │  56.7 │ 50-60 │     29.3 │       0.65 │ OK
 94 │ Total:20                           │  54.0 │ 50-60 │     29.1 │       0.65 │ OK
 95 │ Total:30                           │  43.7 │ 35-45 │     46.7 │       0.63 │ OK
 96 │ Total:30                           │  63.0 │ 56-66 │     39.4 │       0.75 │ OK
 97 │ Total:20                           │  51.3 │ 50-60 │     29.3 │       0.65 │ OK
 98 │ Total:22                           │  58.3 │ 50-60 │     35.1 │       0.61 │ OK
 99 │ Total:18                           │  64.3 │ 50-60 │     25.8 │       0.68 │ TOO EASY
100 │ Total:24                           │  37.0 │ 25-35 │     31.3 │       0.71 │ TOO EASY
101 │ Total:24                           │  61.0 │ 56-66 │     41.8 │       0.57 │ OK
102 │ Total:19                           │  59.3 │ 50-60 │     27.5 │       0.66 │ OK
103 │ Total:20                           │  57.3 │ 50-60 │     29.3 │       0.65 │ OK
104 │ undefined:2, Total:10              │  57.7 │ 50-60 │     30.3 │       0.61 │ OK
105 │ Total:21                           │  44.0 │ 35-45 │     31.5 │       0.64 │ OK
106 │ Total:20                           │  65.7 │ 56-66 │     29.0 │       0.66 │ OK
107 │ Total:28                           │  57.3 │ 50-60 │     46.6 │       0.59 │ OK
108 │ Red:6, Total:18                    │  55.0 │ 50-60 │     31.3 │       0.67 │ OK
109 │ jeep:4, Total:20                   │  54.3 │ 50-60 │     29.3 │       0.65 │ OK
110 │ Total:25                           │  33.0 │ 25-35 │     32.6 │       0.71 │ OK
111 │ Total:20                           │  62.7 │ 56-66 │     28.9 │       0.67 │ OK
112 │ Total:28                           │  54.3 │ 50-60 │     38.4 │       0.69 │ OK
113 │ Total:28                           │  62.0 │ 50-60 │     46.2 │       0.60 │ TOO EASY
114 │ undefined:2, Blue:3                │  54.0 │ 50-60 │     30.2 │       0.59 │ OK
115 │ Total:22                           │  43.3 │ 35-45 │     32.2 │       0.65 │ OK
116 │ Total:24                           │  62.7 │ 56-66 │     37.4 │       0.63 │ OK
117 │ Total:20                           │  54.7 │ 50-60 │     29.2 │       0.65 │ OK
118 │ Total:20                           │  56.3 │ 50-60 │     29.3 │       0.65 │ OK
119 │ undefined:2, Total:9               │  54.3 │ 50-60 │    176.4 │       0.65 │ TOO LONG
120 │ Total:25                           │  33.7 │ 25-35 │     32.7 │       0.70 │ OK
121 │ Total:20                           │  59.3 │ 56-66 │     28.8 │       0.66 │ OK
122 │ Total:20                           │  54.0 │ 50-60 │     32.6 │       0.59 │ OK
123 │ Total:20                           │  60.0 │ 50-60 │     29.1 │       0.66 │ OK
124 │ undefined:3, Orange:4              │  19.3 │ 50-60 │     42.2 │       0.65 │ TOO HARD
125 │ Total:30                           │  41.0 │ 35-45 │     54.4 │       0.53 │ OK
126 │ Total:19                           │  66.3 │ 56-66 │     27.1 │       0.68 │ TOO EASY
127 │ Total:20                           │  57.0 │ 50-60 │     29.7 │       0.65 │ OK
128 │ Total:23                           │  58.0 │ 50-60 │     36.0 │       0.62 │ OK
129 │ jeep:5, Total:20                   │  55.7 │ 50-60 │     29.8 │       0.65 │ OK
130 │ Total:27                           │  30.3 │ 25-35 │     35.3 │       0.71 │ OK
131 │ Total:24                           │  61.3 │ 56-66 │     43.7 │       0.54 │ OK
132 │ Total:22                           │  59.7 │ 50-60 │     31.5 │       0.67 │ OK
133 │ Total:20                           │  57.3 │ 50-60 │     29.5 │       0.65 │ OK
134 │ Total:23                           │  55.3 │ 50-60 │     36.1 │       0.62 │ OK
135 │ Total:25                           │  41.7 │ 35-45 │     36.5 │       0.65 │ OK
136 │ Total:28                           │  59.0 │ 56-66 │     39.5 │       0.69 │ OK
137 │ Red:6, Total:20                    │  60.0 │ 50-60 │     38.7 │       0.59 │ OK
138 │ undefined:3, Total:12              │  22.0 │ 50-60 │     68.0 │       0.61 │ TOO HARD
139 │ Total:19                           │  58.0 │ 50-60 │     27.4 │       0.66 │ OK
140 │ Total:28                           │  29.3 │ 25-35 │     36.8 │       0.71 │ OK
141 │ Total:19                           │  66.3 │ 56-66 │     27.3 │       0.68 │ TOO EASY
142 │ Total:20                           │  62.0 │ 50-60 │     29.2 │       0.66 │ TOO EASY
143 │ Total:28                           │  55.0 │ 50-60 │     49.5 │       0.55 │ OK
144 │ undefined:5, Green:4               │  54.7 │ 50-60 │     50.1 │       0.74 │ OK
145 │ Total:22                           │  39.7 │ 35-45 │     32.1 │       0.65 │ OK
146 │ Total:22                           │  59.7 │ 56-66 │     34.9 │       0.61 │ OK
147 │ Total:18                           │  54.0 │ 50-60 │     25.1 │       0.67 │ OK
148 │ Total:20                           │  61.7 │ 50-60 │     29.2 │       0.66 │ TOO EASY
149 │ undefined:4, Total:18              │  54.3 │ 50-60 │     37.4 │       0.57 │ OK
150 │ Total:25                           │  34.7 │ 25-35 │     32.8 │       0.71 │ OK
151 │ Total:20                           │  62.7 │ 56-66 │     28.9 │       0.67 │ OK
152 │ Total:25                           │  55.0 │ 50-60 │     38.7 │       0.62 │ OK
153 │ Total:20                           │  56.3 │ 50-60 │     29.2 │       0.65 │ OK
154 │ Total:19                           │  58.7 │ 50-60 │     27.2 │       0.67 │ OK
155 │ Total:30                           │  44.0 │ 35-45 │     50.7 │       0.58 │ OK
156 │ Total:20                           │  59.3 │ 56-66 │     28.8 │       0.66 │ OK
157 │ undefined:2, Orange:3              │  30.7 │ 50-60 │     38.8 │       0.59 │ TOO HARD
158 │ Total:21                           │  59.7 │ 50-60 │     34.7 │       0.60 │ OK
159 │ jeep:4, Total:20                   │  54.3 │ 50-60 │     29.1 │       0.65 │ OK
160 │ Total:26                           │  33.0 │ 25-35 │     33.6 │       0.71 │ OK
161 │ Total:24                           │  60.7 │ 56-66 │     43.3 │       0.54 │ OK
162 │ Total:20                           │  61.0 │ 50-60 │     29.2 │       0.66 │ TOO EASY
163 │ Total:20                           │  57.7 │ 50-60 │     29.0 │       0.66 │ OK
164 │ undefined:2, Total:11              │  56.3 │ 50-60 │     50.2 │       0.64 │ OK
165 │ Total:21                           │  41.3 │ 35-45 │     31.4 │       0.64 │ OK
166 │ Total:19                           │  70.0 │ 56-66 │     27.1 │       0.68 │ TOO EASY
167 │ Total:28                           │  58.3 │ 50-60 │     46.0 │       0.60 │ OK
168 │ Total:32                           │  55.7 │ 50-60 │     44.6 │       0.70 │ OK
169 │ undefined:3, Blue:4                │  28.3 │ 50-60 │     31.8 │       0.65 │ TOO HARD
170 │ Total:28                           │  30.7 │ 25-35 │     37.1 │       0.71 │ OK
171 │ Total:20                           │  65.7 │ 56-66 │     29.0 │       0.66 │ OK
172 │ Total:20                           │  54.3 │ 50-60 │     29.1 │       0.65 │ OK
173 │ jeep:5, Total:20                   │  54.0 │ 50-60 │     38.6 │       0.50 │ OK
174 │ Total:20                           │  62.3 │ 50-60 │     29.2 │       0.66 │ TOO EASY
175 │ Total:21                           │  43.7 │ 35-45 │     30.9 │       0.64 │ OK
176 │ Total:20                           │  65.7 │ 56-66 │     32.1 │       0.61 │ OK
177 │ Total:20                           │  60.3 │ 50-60 │     29.3 │       0.66 │ TOO EASY
178 │ Total:20                           │  54.7 │ 50-60 │     29.2 │       0.65 │ OK
179 │ undefined:3, Total:16              │  54.0 │ 50-60 │    177.1 │       0.63 │ TOO LONG
180 │ Total:27                           │  33.3 │ 25-35 │     35.7 │       0.71 │ OK
181 │ Total:20                           │  62.7 │ 56-66 │     28.9 │       0.67 │ OK
182 │ Total:22                           │  57.7 │ 50-60 │     34.9 │       0.62 │ OK
183 │ Total:20                           │  57.0 │ 50-60 │     29.1 │       0.65 │ OK
184 │ Total:30                           │  57.0 │ 50-60 │     37.9 │       0.78 │ OK
185 │ Total:30                           │  41.7 │ 35-45 │     53.8 │       0.55 │ OK
186 │ Total:19                           │  69.0 │ 56-66 │     27.0 │       0.68 │ TOO EASY
187 │ Purple:4, Total:18                 │  62.3 │ 50-60 │     28.2 │       0.67 │ TOO EASY
188 │ Total:21                           │  56.0 │ 50-60 │     33.2 │       0.62 │ OK
189 │ undefined:2, Total:9               │  62.0 │ 50-60 │     42.2 │       0.69 │ TOO EASY
190 │ Total:28                           │  30.3 │ 25-35 │     36.9 │       0.71 │ OK
191 │ Total:24                           │  62.0 │ 56-66 │     40.0 │       0.59 │ OK
192 │ Total:30                           │  55.7 │ 50-60 │     41.3 │       0.70 │ OK
193 │ Total:21                           │  53.3 │ 50-60 │     31.2 │       0.66 │ OK
194 │ jeep:4, Total:20                   │  56.7 │ 50-60 │     33.0 │       0.58 │ OK
195 │ Total:22                           │  41.7 │ 35-45 │     32.1 │       0.65 │ OK
196 │ Total:20                           │  65.7 │ 56-66 │     29.0 │       0.66 │ OK
197 │ undefined:2, Red:3                 │  39.7 │ 50-60 │     57.1 │       0.50 │ TOO HARD
198 │ Total:20                           │  56.0 │ 50-60 │     29.4 │       0.65 │ OK
199 │ Total:18                           │  64.0 │ 50-60 │     25.7 │       0.67 │ TOO EASY
200 │ Total:24                           │  37.0 │ 25-35 │     31.3 │       0.71 │ TOO EASY

40 / 200 levels flagged.
Flagged: L4(TOO EASY)  L6(TOO EASY)  L33(TOO HARD)  L39(TOO HARD)  L41(TOO HARD)  L49(TOO HARD)  L50(TOO EASY)  L52(TOO HARD)  L57(TOO HARD)  L61(TOO EASY)  L63(TOO EASY)  L68(TOO EASY)  L69(TOO EASY)  L79(TOO HARD)  L86(TOO HARD + TOO LONG)  L87(TOO EASY)  L91(TOO EASY)  L99(TOO EASY)  L100(TOO EASY)  L113(TOO EASY)  L119(TOO LONG)  L124(TOO HARD)  L126(TOO EASY)  L138(TOO HARD)  L141(TOO EASY)  L142(TOO EASY)  L148(TOO EASY)  L157(TOO HARD)  L162(TOO EASY)  L166(TOO EASY)  L169(TOO HARD)  L174(TOO EASY)  L177(TOO EASY)  L179(TOO LONG)  L186(TOO EASY)  L187(TOO EASY)  L189(TOO EASY)  L197(TOO HARD)  L199(TOO EASY)  L200(TOO EASY)
Mean win rate across levels: 57.1%  [profile: human; the tuning reference is human]
```
