# Lane Defense Visual Audit Skill

When the user requests visual changes or feature work that affects
gameplay, ALWAYS perform this audit before claiming the task done:

1. Run `npm run dev` in the background (port 5173 by default)
2. Use Playwright MCP to navigate to http://localhost:5173
3. Tap PLAY, navigate through L1, L4, L8, L13
4. Take a screenshot at each level
5. For each screenshot, evaluate:
   - Are car colors instantly readable as one of: red/blue/green/
     yellow/purple/orange?
   - Does the scene look like Royal Match / Color Block Jam tier
     production quality?
   - Are tutorials clear and actionable?
   - Is there visual clutter or amateur cues (Lego-stacked geometry,
     muddy colors, missing shadows, ugly fonts)?
6. If ANY answer is "no", fix the code, then re-screenshot and
   re-evaluate. Loop until all checks pass.
7. Only then commit and push.

Reference: design files in preview/brand-cars.html, brand-shooters.html,
colors-themes.html. The bar is "would Royal Match ship this?"
