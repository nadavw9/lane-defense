# Lane Defense — Realistic Balance Report

**Generated:** 2026-10-30
**Command:** `node tools/balance-sim.js --level=all --runs=300 --skill=human`
**Model:** discrete, turn-based, goal-based simulation with the `human` profile (no mis-drops, no column cycling, bench from L13, boosterIQ 0.90), lane barriers (one free breach per lane), waves from L10, no crisis assist. Bands: `tools/bands.mjs` (owner's first call, 2026-10-30; refine after device play).

AvgTurns = shots in a winning run (levels used to take 12-20; the owner asked for longer). Flags beyond the band are noise at 300 runs on some levels; the tuner (`tune-levels.mjs 1-200 300 --write`) put 186/200 in band. Known bot gaps: it does not chase colour/trait GOALS (so colour-goal levels read harder than they play) and plays no COLOR SWAP or rainbow; 130 levels sit at the lightest mix (heft 0.15), i.e. the late game is hard for this bot even light — the owner's device play decides the bands there.

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
  6 │ Total:16                           │  93.7 │ 70-80 │     24.7 │       0.65 │ TOO EASY
  7 │ Total:20                           │  76.7 │ 70-80 │     35.6 │       0.55 │ OK
  8 │ Total:20                           │  75.0 │ 70-80 │     40.6 │       0.48 │ OK
  9 │ Total:20                           │  75.3 │ 70-80 │     38.3 │       0.51 │ OK
 10 │ Total:22                           │  60.0 │ 54-64 │     30.6 │       0.70 │ OK
 11 │ Total:22                           │  75.7 │ 68-78 │     32.2 │       0.68 │ OK
 12 │ Blue:7, Green:7                    │  67.7 │ 62-72 │     34.5 │       0.72 │ OK
 13 │ Total:22                           │  68.3 │ 62-72 │     32.9 │       0.66 │ OK
 14 │ Total:22                           │  68.7 │ 62-72 │     32.7 │       0.66 │ OK
 15 │ Total:30                           │  52.7 │ 47-57 │     37.8 │       0.77 │ OK
 16 │ Total:22                           │  72.7 │ 68-78 │     31.3 │       0.70 │ OK
 17 │ Total:21                           │  68.0 │ 62-72 │     28.9 │       0.72 │ OK
 18 │ Total:22                           │  66.0 │ 62-72 │     31.4 │       0.69 │ OK
 19 │ Total:22                           │  66.7 │ 62-72 │     30.1 │       0.72 │ OK
 20 │ Total:22                           │  53.7 │ 47-57 │     30.5 │       0.70 │ OK
 21 │ Total:22                           │  73.7 │ 68-78 │     30.4 │       0.72 │ OK
 22 │ Total:19                           │  66.0 │ 62-72 │     28.4 │       0.65 │ OK
 23 │ Total:20                           │  65.7 │ 62-72 │     29.8 │       0.65 │ OK
 24 │ Total:18                           │  61.7 │ 62-72 │     26.2 │       0.67 │ TOO HARD
 25 │ Total:22                           │  52.7 │ 47-57 │     32.4 │       0.66 │ OK
 26 │ Total:18                           │  78.0 │ 68-78 │     27.2 │       0.65 │ OK
 27 │ Total:19                           │  64.3 │ 58-68 │     27.7 │       0.66 │ OK
 28 │ Red:4, Yellow:4                    │  58.0 │ 58-68 │     26.1 │       0.65 │ TOO HARD
 29 │ Total:22                           │  62.3 │ 58-68 │     34.3 │       0.64 │ OK
 30 │ Total:20                           │  49.0 │ 43-53 │     29.0 │       0.66 │ OK
 31 │ Total:19                           │  68.0 │ 64-74 │     28.1 │       0.66 │ OK
 32 │ Total:23                           │  63.0 │ 58-68 │     34.6 │       0.66 │ OK
 33 │ Total:18                           │  65.3 │ 58-68 │     26.6 │       0.66 │ OK
 34 │ Total:19                           │  60.7 │ 58-68 │     28.8 │       0.64 │ OK
 35 │ Total:32                           │  47.0 │ 43-53 │     54.6 │       0.58 │ OK
 36 │ Total:19                           │  68.0 │ 64-74 │     28.1 │       0.66 │ OK
 37 │ Total:19                           │  58.0 │ 58-68 │     28.5 │       0.65 │ TOO HARD
 38 │ Total:26                           │  63.7 │ 58-68 │     41.5 │       0.61 │ OK
 39 │ Total:19                           │  56.0 │ 58-68 │     28.4 │       0.64 │ TOO HARD
 40 │ Total:20                           │  48.7 │ 43-53 │     29.1 │       0.65 │ OK
 41 │ Total:23                           │  66.3 │ 64-74 │     40.5 │       0.56 │ OK
 42 │ Total:19                           │  63.0 │ 58-68 │     28.4 │       0.65 │ OK
 43 │ Total:22                           │  62.7 │ 58-68 │     30.9 │       0.69 │ OK
 44 │ Total:24                           │  70.0 │ 58-68 │     37.6 │       0.63 │ TOO EASY
 45 │ Total:22                           │  48.7 │ 43-53 │     33.1 │       0.64 │ OK
 46 │ Total:18                           │  68.3 │ 62-72 │     26.6 │       0.65 │ OK
 47 │ Total:26                           │  61.0 │ 56-66 │     43.5 │       0.59 │ OK
 48 │ Total:33                           │  59.7 │ 56-66 │     45.8 │       0.70 │ OK
 49 │ undefined:2, Green:3               │  40.7 │ 56-66 │     32.7 │       0.57 │ TOO HARD
 50 │ Total:28                           │  37.7 │ 31-41 │     37.9 │       0.69 │ OK
 51 │ Total:19                           │  68.7 │ 62-72 │     28.4 │       0.65 │ OK
 52 │ Total:18                           │  65.3 │ 56-66 │     26.4 │       0.66 │ OK
 53 │ Total:26                           │  62.3 │ 56-66 │     47.0 │       0.54 │ OK
 54 │ Total:19                           │  64.7 │ 56-66 │     28.2 │       0.65 │ OK
 55 │ Total:24                           │  46.0 │ 41-51 │     36.6 │       0.63 │ OK
 56 │ Total:24, jeep:4                   │  66.7 │ 62-72 │     36.5 │       0.65 │ OK
 57 │ undefined:2, Orange:3              │  50.3 │ 56-66 │     29.1 │       0.57 │ TOO HARD
 58 │ Total:18                           │  61.0 │ 56-66 │     26.8 │       0.65 │ OK
 59 │ Total:28                           │  64.7 │ 56-66 │     45.5 │       0.61 │ OK
 60 │ Total:26                           │  40.3 │ 31-41 │     35.4 │       0.70 │ OK
 61 │ Total:18                           │  70.3 │ 60-70 │     26.4 │       0.66 │ TOO EASY
 62 │ Total:26                           │  60.3 │ 54-64 │     39.9 │       0.64 │ OK
 63 │ Total:20                           │  60.0 │ 54-64 │     30.0 │       0.64 │ OK
 64 │ Total:32                           │  59.7 │ 54-64 │     44.1 │       0.70 │ OK
 65 │ undefined:4, Purple:6              │  45.0 │ 39-49 │     55.7 │       0.44 │ OK
 66 │ Total:19                           │  64.3 │ 60-70 │     28.6 │       0.64 │ OK
 67 │ Total:19                           │  67.0 │ 54-64 │     28.3 │       0.65 │ TOO EASY
 68 │ Total:27                           │  63.0 │ 54-64 │     41.5 │       0.64 │ OK
 69 │ Total:18                           │  62.7 │ 54-64 │     26.3 │       0.66 │ OK
 70 │ Total:28                           │  42.7 │ 29-39 │     38.4 │       0.70 │ TOO EASY
 71 │ Total:30                           │  70.0 │ 60-70 │     48.5 │       0.62 │ OK
 72 │ Total:26                           │  60.7 │ 54-64 │     37.2 │       0.68 │ OK
 73 │ Total:20                           │  61.7 │ 54-64 │     29.9 │       0.64 │ OK
 74 │ Total:24                           │  64.0 │ 54-64 │     36.6 │       0.64 │ OK
 75 │ Total:22                           │  47.0 │ 39-49 │     33.2 │       0.64 │ OK
 76 │ Total:19                           │  66.7 │ 58-68 │     28.1 │       0.66 │ OK
 77 │ Total:26                           │  57.7 │ 52-62 │     44.2 │       0.57 │ OK
 78 │ Total:20                           │  55.3 │ 52-62 │     29.6 │       0.64 │ OK
 79 │ undefined:2, Orange:3              │  39.3 │ 52-62 │     35.5 │       0.59 │ TOO HARD
 80 │ Total:28                           │  39.7 │ 27-37 │     37.8 │       0.70 │ TOO EASY
 81 │ Total:19                           │  63.0 │ 58-68 │     28.5 │       0.64 │ OK
 82 │ Total:20                           │  59.7 │ 52-62 │     30.1 │       0.64 │ OK
 83 │ Total:30                           │  56.7 │ 52-62 │     53.1 │       0.56 │ OK
 84 │ Total:18                           │  59.7 │ 52-62 │     26.9 │       0.64 │ OK
 85 │ Total:24                           │  41.3 │ 37-47 │     36.2 │       0.63 │ OK
 86 │ undefined:2, undefined:2, Green:2  │  31.7 │ 58-68 │     74.2 │       0.62 │ TOO HARD + TOO LONG
 87 │ Total:18                           │  62.7 │ 52-62 │     26.6 │       0.66 │ TOO EASY
 88 │ Total:48                           │  57.7 │ 52-62 │     63.1 │       0.74 │ OK
 89 │ Total:30                           │  56.0 │ 52-62 │     49.7 │       0.59 │ OK
 90 │ Total:28                           │  34.3 │ 27-37 │     38.8 │       0.69 │ OK
 91 │ Total:19                           │  66.0 │ 56-66 │     28.4 │       0.66 │ OK
 92 │ Total:28                           │  50.3 │ 50-60 │     42.7 │       0.64 │ OK
 93 │ Total:18                           │  64.0 │ 50-60 │     27.0 │       0.65 │ TOO EASY
 94 │ Total:20                           │  53.7 │ 50-60 │     29.9 │       0.64 │ OK
 95 │ Total:30                           │  42.7 │ 35-45 │     45.4 │       0.64 │ OK
 96 │ Total:30                           │  61.0 │ 56-66 │     41.0 │       0.71 │ OK
 97 │ Total:20                           │  60.3 │ 50-60 │     30.0 │       0.64 │ TOO EASY
 98 │ Total:28                           │  55.7 │ 50-60 │     43.2 │       0.63 │ OK
 99 │ Total:18                           │  62.0 │ 50-60 │     26.5 │       0.66 │ TOO EASY
100 │ Total:26                           │  35.0 │ 25-35 │     35.5 │       0.69 │ OK
101 │ Total:24                           │  59.0 │ 56-66 │     43.6 │       0.53 │ OK
102 │ Total:18                           │  58.3 │ 50-60 │     26.8 │       0.64 │ OK
103 │ Total:20                           │  58.7 │ 50-60 │     30.2 │       0.63 │ OK
104 │ undefined:2, Total:10              │  58.3 │ 50-60 │     50.6 │       0.69 │ OK
105 │ Total:26                           │  38.7 │ 35-45 │     38.7 │       0.63 │ OK
106 │ Total:20                           │  56.3 │ 56-66 │     29.8 │       0.64 │ OK
107 │ Total:28                           │  54.3 │ 50-60 │     48.9 │       0.56 │ OK
108 │ Red:6, Total:18                    │  54.3 │ 50-60 │     32.3 │       0.64 │ OK
109 │ jeep:4, Total:20                   │  55.0 │ 50-60 │     30.8 │       0.62 │ OK
110 │ Total:28                           │  28.7 │ 25-35 │     38.4 │       0.69 │ OK
111 │ Total:18                           │  64.7 │ 56-66 │     26.8 │       0.66 │ OK
112 │ Total:31                           │  54.7 │ 50-60 │     43.5 │       0.68 │ OK
113 │ Total:30                           │  55.0 │ 50-60 │     50.7 │       0.59 │ OK
114 │ undefined:2, Blue:3                │  54.0 │ 50-60 │     33.6 │       0.58 │ OK
115 │ Total:26                           │  40.0 │ 35-45 │     38.5 │       0.64 │ OK
116 │ Total:24                           │  62.7 │ 56-66 │     38.1 │       0.62 │ OK
117 │ Total:19                           │  60.0 │ 50-60 │     28.8 │       0.64 │ OK
118 │ Total:18                           │  62.3 │ 50-60 │     26.7 │       0.65 │ TOO EASY
119 │ undefined:3, Total:15              │  56.0 │ 50-60 │    249.2 │       0.71 │ TOO LONG
120 │ Total:28                           │  34.0 │ 25-35 │     38.4 │       0.68 │ OK
121 │ Total:18                           │  65.7 │ 56-66 │     26.8 │       0.65 │ OK
122 │ Total:21                           │  57.7 │ 50-60 │     33.3 │       0.62 │ OK
123 │ Total:18                           │  60.0 │ 50-60 │     26.7 │       0.64 │ OK
124 │ undefined:3, Orange:4              │  24.3 │ 50-60 │     42.0 │       0.65 │ TOO HARD
125 │ Total:30                           │  40.7 │ 35-45 │     56.4 │       0.51 │ OK
126 │ Total:19                           │  61.0 │ 56-66 │     28.3 │       0.65 │ OK
127 │ Total:20                           │  54.7 │ 50-60 │     30.2 │       0.63 │ OK
128 │ Total:29                           │  56.3 │ 50-60 │     44.0 │       0.64 │ OK
129 │ jeep:5, Total:20                   │  59.3 │ 50-60 │     30.6 │       0.63 │ OK
130 │ Total:28                           │  33.3 │ 25-35 │     38.4 │       0.69 │ OK
131 │ Total:24                           │  62.0 │ 56-66 │     43.7 │       0.54 │ OK
132 │ Total:20                           │  60.3 │ 50-60 │     30.0 │       0.64 │ TOO EASY
133 │ Total:20                           │  59.3 │ 50-60 │     30.1 │       0.63 │ OK
134 │ Total:28                           │  56.0 │ 50-60 │     42.4 │       0.64 │ OK
135 │ Total:26                           │  39.0 │ 35-45 │     38.3 │       0.64 │ OK
136 │ Total:38                           │  70.0 │ 56-66 │     50.4 │       0.74 │ TOO EASY
137 │ Red:6, Total:19                    │  56.3 │ 50-60 │     39.0 │       0.55 │ OK
138 │ undefined:3, Total:12              │  34.7 │ 50-60 │     72.8 │       0.64 │ TOO HARD + TOO LONG
139 │ Total:19                           │  59.7 │ 50-60 │     28.4 │       0.65 │ OK
140 │ Total:29                           │  35.7 │ 25-35 │     40.3 │       0.69 │ TOO EASY
141 │ Total:19                           │  65.0 │ 56-66 │     28.2 │       0.65 │ OK
142 │ Total:20                           │  60.7 │ 50-60 │     30.0 │       0.64 │ TOO EASY
143 │ Total:28                           │  53.7 │ 50-60 │     51.7 │       0.52 │ OK
144 │ undefined:5, Green:4               │  54.3 │ 50-60 │     54.6 │       0.73 │ OK
145 │ Total:25                           │  45.7 │ 35-45 │     37.4 │       0.64 │ TOO EASY
146 │ Total:24                           │  61.7 │ 56-66 │     37.1 │       0.63 │ OK
147 │ Total:19                           │  64.3 │ 50-60 │     28.1 │       0.66 │ TOO EASY
148 │ Total:20                           │  60.7 │ 50-60 │     30.0 │       0.64 │ TOO EASY
149 │ undefined:4, Total:18              │  55.3 │ 50-60 │     52.6 │       0.60 │ OK
150 │ Total:28                           │  31.3 │ 25-35 │     38.1 │       0.69 │ OK
151 │ Total:18                           │  65.0 │ 56-66 │     26.7 │       0.66 │ OK
152 │ Total:28                           │  60.3 │ 50-60 │     43.3 │       0.63 │ TOO EASY
153 │ Total:18                           │  63.3 │ 50-60 │     26.9 │       0.64 │ TOO EASY
154 │ Total:18                           │  62.7 │ 50-60 │     26.4 │       0.66 │ TOO EASY
155 │ Total:30                           │  39.7 │ 35-45 │     53.8 │       0.54 │ OK
156 │ Total:18                           │  65.7 │ 56-66 │     26.8 │       0.65 │ OK
157 │ undefined:2, Orange:3              │  36.3 │ 50-60 │     36.9 │       0.59 │ TOO HARD
158 │ Total:28                           │  55.7 │ 50-60 │     44.9 │       0.61 │ OK
159 │ jeep:4, Total:20                   │  55.0 │ 50-60 │     30.7 │       0.63 │ OK
160 │ Total:29                           │  33.3 │ 25-35 │     40.2 │       0.69 │ OK
161 │ Total:24                           │  61.7 │ 56-66 │     46.1 │       0.51 │ OK
162 │ Total:18                           │  58.3 │ 50-60 │     26.7 │       0.64 │ OK
163 │ Total:20                           │  58.0 │ 50-60 │     30.1 │       0.64 │ OK
164 │ undefined:3, Total:18              │  54.3 │ 50-60 │     38.8 │       0.62 │ OK
165 │ Total:25                           │  45.0 │ 35-45 │     37.5 │       0.64 │ OK
166 │ Total:18                           │  63.7 │ 56-66 │     26.9 │       0.65 │ OK
167 │ Total:28                           │  54.7 │ 50-60 │     46.1 │       0.60 │ OK
168 │ Total:43                           │  51.7 │ 50-60 │     58.9 │       0.71 │ OK
169 │ undefined:3, Blue:4                │  36.0 │ 50-60 │     37.1 │       0.65 │ TOO HARD
170 │ Total:29                           │  32.0 │ 25-35 │     39.7 │       0.69 │ OK
171 │ Total:20                           │  56.3 │ 56-66 │     29.8 │       0.64 │ OK
172 │ Total:18                           │  62.0 │ 50-60 │     26.8 │       0.64 │ TOO EASY
173 │ jeep:5, Total:20                   │  55.7 │ 50-60 │     39.4 │       0.48 │ OK
174 │ Total:20                           │  57.7 │ 50-60 │     29.7 │       0.64 │ OK
175 │ Total:27                           │  39.7 │ 35-45 │     40.3 │       0.64 │ OK
176 │ Total:24                           │  61.0 │ 56-66 │     37.5 │       0.63 │ OK
177 │ Total:20                           │  59.7 │ 50-60 │     29.9 │       0.64 │ OK
178 │ Total:19                           │  60.0 │ 50-60 │     28.8 │       0.64 │ OK
179 │ undefined:3, Total:18              │  56.0 │ 50-60 │     61.9 │       0.59 │ OK
180 │ Total:28                           │  34.0 │ 25-35 │     38.3 │       0.69 │ OK
181 │ Total:18                           │  65.0 │ 56-66 │     26.7 │       0.66 │ OK
182 │ Total:28                           │  57.3 │ 50-60 │     42.3 │       0.65 │ OK
183 │ Total:18                           │  64.0 │ 50-60 │     26.9 │       0.65 │ TOO EASY
184 │ Total:30                           │  54.3 │ 50-60 │     40.6 │       0.71 │ OK
185 │ Total:30                           │  41.7 │ 35-45 │     55.0 │       0.53 │ OK
186 │ Total:18                           │  64.7 │ 56-66 │     26.7 │       0.66 │ OK
187 │ Purple:4, Total:18                 │  63.3 │ 50-60 │     28.4 │       0.65 │ TOO EASY
188 │ Total:27                           │  56.0 │ 50-60 │     40.4 │       0.65 │ OK
189 │ undefined:2, Total:9               │  60.0 │ 50-60 │     41.2 │       0.68 │ OK
190 │ Total:29                           │  34.0 │ 25-35 │     39.4 │       0.69 │ OK
191 │ Total:22                           │  62.3 │ 56-66 │     41.1 │       0.52 │ OK
192 │ Total:28                           │  54.7 │ 50-60 │     38.9 │       0.68 │ OK
193 │ Total:20                           │  60.0 │ 50-60 │     30.0 │       0.64 │ OK
194 │ jeep:4, Total:19                   │  56.7 │ 50-60 │     30.8 │       0.58 │ OK
195 │ Total:21                           │  45.7 │ 35-45 │     32.1 │       0.63 │ TOO EASY
196 │ Total:20                           │  56.3 │ 56-66 │     29.8 │       0.64 │ OK
197 │ undefined:3, Red:5                 │  55.3 │ 50-60 │     43.5 │       0.58 │ OK
198 │ Total:18                           │  59.3 │ 50-60 │     26.8 │       0.64 │ OK
199 │ Total:18                           │  61.0 │ 50-60 │     26.7 │       0.65 │ TOO EASY
200 │ Total:26                           │  35.0 │ 25-35 │     35.5 │       0.69 │ OK

40 / 200 levels flagged.
Flagged: L4(TOO EASY)  L6(TOO EASY)  L24(TOO HARD)  L28(TOO HARD)  L37(TOO HARD)  L39(TOO HARD)  L44(TOO EASY)  L49(TOO HARD)  L57(TOO HARD)  L61(TOO EASY)  L67(TOO EASY)  L70(TOO EASY)  L79(TOO HARD)  L80(TOO EASY)  L86(TOO HARD + TOO LONG)  L87(TOO EASY)  L93(TOO EASY)  L97(TOO EASY)  L99(TOO EASY)  L118(TOO EASY)  L119(TOO LONG)  L124(TOO HARD)  L132(TOO EASY)  L136(TOO EASY)  L138(TOO HARD + TOO LONG)  L140(TOO EASY)  L142(TOO EASY)  L145(TOO EASY)  L147(TOO EASY)  L148(TOO EASY)  L152(TOO EASY)  L153(TOO EASY)  L154(TOO EASY)  L157(TOO HARD)  L169(TOO HARD)  L172(TOO EASY)  L183(TOO EASY)  L187(TOO EASY)  L195(TOO EASY)  L199(TOO EASY)
Mean win rate across levels: 57.5%  [profile: human; the tuning reference is human]
```
