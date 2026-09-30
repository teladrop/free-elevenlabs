import { ScriptGenerationParams, VisualStyle } from '@/lib/types';

// ── CTA builder ───────────────────────────────────────────────────────────────
// Returns the literal CTA sentence(s) to insert into the script.
// Used as a MARKER so the AI inserts real spoken words, not just an instruction.

function buildCtaSentence(channelName: string, channelCategory: string): string {
  const ch  = channelName  || 'this channel';
  const cat = channelCategory ? ` ${channelCategory}` : '';
  return `If you enjoy${cat} content like this, hit like and subscribe to ${ch} — we drop new videos every week.`;
}

const CTA_POSITION_INSTRUCTION: Record<string, string> = {
  'after-hook': 'Insert the CTA sentence immediately after the opening hook, before the main body begins.',
  'early':      'Insert the CTA sentence at approximately the 25% point of the script.',
  'mid':        'Insert the CTA sentence at approximately the midpoint of the script.',
  'late':       'Insert the CTA sentence at approximately the 75% point of the script.',
  'end':        'Insert the CTA sentence near the very end, just before the closing line.',
};

function buildCtaBlock(channelName: string, channelCategory: string, position: string): string {
  const sentence  = buildCtaSentence(channelName, channelCategory);
  const placement = CTA_POSITION_INSTRUCTION[position] ?? CTA_POSITION_INSTRUCTION['end'];
  return `
━━━ CTA (MANDATORY — YOU MUST INCLUDE THIS) ━━━
${placement}
The CTA line to use (copy it verbatim or adapt slightly):
  "${sentence}"
It must sound natural in the flow of the narration. Do NOT skip it.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Script Generation Prompt — human-feeling, retention-first, story-driven.
 * Uses examples to show the AI what great writing looks like,
 * not a template it fills out mechanically.
 */
export function buildScriptPrompt(params: ScriptGenerationParams): string {
  const {
    topic, contentType, style, targetAudience,
    videoLength, tone, retentionIntensity,
    keyPoints, researchMaterial, platform,
    channelName, channelCategory, ctaPosition,
  } = params;

  const lengthEstimate = Math.round(videoLength * 140);
  const hasCta         = ctaPosition && ctaPosition !== 'none';
  const ctaSentence    = hasCta ? buildCtaSentence(channelName || '', channelCategory || '') : '';

  const ctaPositionLabel: Record<string, string> = {
    'after-hook': 'right after the hook (2nd or 3rd sentence)',
    'early':      'after the first major point (~25% through)',
    'mid':        'at the midpoint (~50% through)',
    'late':       'near the end (~75% through)',
    'end':        'as the second-to-last sentence',
  };
  const ctaWhere = ctaPosition ? (ctaPositionLabel[ctaPosition] ?? 'near the end') : '';

  const ctaInstruction = hasCta
    ? `\nCTA — place ${ctaWhere}. Weave this naturally into the narration so it feels like part of the story, not an ad break:\n"${ctaSentence}"\n`
    : '';

  return `You are a world-class YouTube scriptwriter. Your scripts feel like they were written by a curious, intelligent human storyteller — not an AI filling out a template.

Write a complete spoken narration script about: "${topic}"
Platform: ${platform} | Style: ${style} | Tone: ${tone} | Length: ${videoLength} min (~${lengthEstimate} words)
Audience: ${targetAudience} | Retention intensity: ${retentionIntensity}/10
${channelName ? `Channel: ${channelName}` : ''}${channelCategory ? ` | Category: ${channelCategory}` : ''}
${keyPoints ? `\nPoints to cover:\n${keyPoints.map(kp => `- ${kp}`).join('\n')}` : ''}
${researchMaterial ? `\nResearch:\n${researchMaterial}` : ''}
${ctaInstruction}

WHAT MAKES A GREAT HOOK (study these examples):

Bad — generic, AI-sounding, kills retention immediately:
"Have you ever wondered about [topic]? In this video, we're going to explore the fascinating world of..."
"[Topic] is something that affects millions of people every day. But what exactly is it?"

Good — drops you into a mystery or moment, makes you need to know what happens next:
"Three weeks before his company went public, the founder quietly moved 40 million dollars offshore. Nobody noticed. Until now."
"The Roman Empire didn't fall. It was stolen. And the thieves left a paper trail."
"Your brain makes the decision to move your hand 300 milliseconds before you consciously choose to. Free will might be the biggest lie we tell ourselves."
"In 1972, NASA sent a message into deep space. They've been waiting for a reply ever since. Two years ago, something answered."

Write a hook for "${topic}" that is THIS specific and THIS surprising. Drop us into a moment, a mystery, or a fact that reframes everything. First sentence only. No preamble.

WHAT GREAT BODY WRITING SOUNDS LIKE:

Bad — encyclopedic, robotic, no story:
"There are several important factors to consider. First, the historical context. Second, the modern implications. Third..."

Good — uses real stories, names, specific details, builds to a payoff:
"Barry Marshall was so convinced his colleagues were wrong that in 1984 he did something that would get him fired today. He walked into his lab, picked up a petri dish full of bacteria, and drank it. He got violently ill. He also won the Nobel Prize."

Good — creates tension, withholds, forces you to keep listening:
"The data was sitting in the files the whole time. Forty years of it. No one had looked because no one thought to ask the question. When they finally did — the answer was so obvious, so embarrassing, that the journal almost didn't publish it."

Use real names, real numbers, real moments wherever possible. Specificity is what separates writing that feels true from writing that feels generated.

VOICE RULES — internalize these:
- Write the way a brilliant, curious friend talks — not a textbook or a press release
- Use "you" and "we" to pull the listener in
- Vary your rhythm: short. Then a longer sentence that builds momentum and lands somewhere unexpected. Then short again.
- Ask a question, then immediately complicate the obvious answer
- State something confidently, then crack it open two sentences later
- Every paragraph should end on something that makes the reader lean forward
- Never use: "importantly", "notably", "it's worth mentioning", "in conclusion", "as we can see", "delve", "crucial", "fascinating", "tapestry"

RETENTION MECHANICS — don't announce them, just use them:
- Open a mystery or tension in the first 30 seconds. Don't resolve it until at least 70% through.
- Drop one genuinely surprising fact or story every 90 seconds
- Shift angle or perspective every 2-3 paragraphs — keeps the brain from going on autopilot
- The ending must echo or recontextualize the opening — bookend it so it feels complete

OUTPUT RULES:
- Plain spoken narration only — no [SFX], no headings, no bullet points, no stage directions
- Do not write "Here's the script:" or any preamble — start with the first word of the script
- Do not label sections — write it as one continuous flowing piece of narration

Start writing now, beginning with the hook for "${topic}":`;
}

/**
 * Internal Retention Rewrite — fixes weak areas after initial generation.
 * Topic is always passed so the AI never drifts.
 */
export function buildScriptRewritePrompt(
  script: string,
  analysis: Record<string, unknown>,
  weakAreas: string[],
  params: ScriptGenerationParams,
): string {
  const { topic, platform, channelName, channelCategory, ctaPosition } = params;
  const hasCta = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!)
    : '';

  return `You are an expert retention-focused YouTube scriptwriter.

Rewrite the script below to fix the specific weak areas identified by AI analysis.
The script is about: "${topic}" — every sentence must stay on this topic.

━━━ ORIGINAL SCRIPT ━━━
${script}

━━━ OVERALL SCORE: ${analysis.overallScore ?? '?'}/100 ━━━

━━━ WEAK AREAS TO FIX (address every single one) ━━━
${weakAreas.map(w => `• ${w}`).join('\n')}
${ctaBlock}

━━━ REWRITE RULES ━━━
- Keep ALL original facts and information about "${topic}"
- Fix every weak area listed above — this is mandatory
- Maintain approximately the same word count (±10%)
- Output ONLY the rewritten narration — no labels, no notes
- Platform: ${platform}

Write the improved script now:`;
}

/**
 * External Script Rewrite — user pastes a script from outside, AI rewrites it retention-first.
 */
export function buildExternalScriptRewritePrompt(
  externalScript: string,
  params: ScriptGenerationParams,
): string {
  const {
    topic, style, targetAudience, tone, platform,
    channelName, channelCategory, ctaPosition,
  } = params;

  const hasCta = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!)
    : '';

  // Auto-detect topic from script if user didn't provide one
  const topicLine = topic?.trim()
    ? `The script topic is: "${topic}"`
    : 'Infer the topic from the script content and stay on it throughout.';

  return `You are an expert retention-focused YouTube scriptwriter.

Rewrite the script below to be highly engaging and retention-optimised.
${topicLine}
Keep ALL the original information and intent — only improve delivery, pacing, hook, and flow.

━━━ ORIGINAL SCRIPT ━━━
${externalScript}

━━━ REWRITE SETTINGS ━━━
Platform:        ${platform}
Style:           ${style}
Target Audience: ${targetAudience}
Tone:            ${tone}
${channelName     ? `Channel:  ${channelName}` : ''}
${channelCategory ? `Category: ${channelCategory}` : ''}
${ctaBlock}

━━━ REWRITE RULES ━━━
1. Rewrite the opening as a strong hook — first sentence must create immediate curiosity
2. Add open loops and curiosity gaps throughout
3. Mix short punchy sentences with longer flowing ones
4. Add a pattern interrupt every 60–90 seconds
5. Strengthen transitions between ideas
6. Rewrite the ending to deliver on the hook's promise
7. Output ONLY the rewritten narration — no labels, no notes, no production directions

Write the rewritten script now:`;
}

/**
 * AI Fix Prompt — user clicks "Fix Script", applies analysis suggestions precisely.
 */
export function buildScriptFixPrompt(
  script: string,
  analysis: Record<string, unknown>,
  params: ScriptGenerationParams,
): string {
  const suggestions  = (analysis.suggestions as string[] | undefined) ?? [];
  const { topic, channelName, channelCategory, ctaPosition, platform } = params;

  const hasCta = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!)
    : '';

  // Build weak areas from scores
  const a = analysis as Record<string, number>;
  const weakAreas: string[] = [];
  if (a.hookStrength         < 7) weakAreas.push('Hook is weak — rewrite the very first sentence to be more gripping');
  if (a.curiosity            < 7) weakAreas.push('Not enough curiosity gaps — add 2–3 open loops that get paid off later');
  if (a.pacing               < 7) weakAreas.push('Pacing is flat — break up long paragraphs, add short punchy sentences');
  if (a.predictability       > 4) weakAreas.push('Too predictable — add at least one counterintuitive or surprising fact');
  if (a.ttsReadability       < 7) weakAreas.push('Hard to read aloud — shorten sentences over 25 words, avoid complex clauses');
  if (a.narrativeProgression < 7) weakAreas.push('Weak narrative arc — raise the stakes or tension in the middle section');
  if (a.endingStrength       < 7) weakAreas.push('Weak ending — rewrite the final paragraph to deliver on the hook\'s promise');
  if (a.informationDensity   < 6) weakAreas.push('Too much padding — cut filler sentences, every line must carry new info');

  return `You are an expert retention-focused YouTube scriptwriter.

Apply the AI analysis feedback to fix this script about "${topic ?? 'the given topic'}".
Every fix listed below is MANDATORY — do not skip any.

━━━ ORIGINAL SCRIPT ━━━
${script}

━━━ AI SCORE: ${analysis.overallScore ?? '?'}/100 ━━━

━━━ MANDATORY FIXES (apply ALL of these) ━━━
${weakAreas.length > 0 ? weakAreas.map(w => `• ${w}`).join('\n') : '• Polish the overall flow and engagement'}

━━━ SPECIFIC SUGGESTIONS FROM ANALYSIS ━━━
${suggestions.length > 0 ? suggestions.map(s => `• ${s}`).join('\n') : '• Improve overall quality and engagement'}
${ctaBlock}

━━━ OUTPUT RULES ━━━
- Keep ALL original facts about "${topic ?? 'the topic'}"
- Apply every fix above — no exceptions
- Maintain approximately the same word count (±10%)
- Platform: ${platform}
- Output ONLY the fixed narration — no labels, no explanations

Write the fixed script now:`;
}

/**
 * Script Analysis Prompt
 */
export function buildScriptAnalysisPrompt(script: string): string {
  return `Analyze this YouTube script for retention quality. Be strict — most scripts have real weaknesses.

SCRIPT:
"""
${script}
"""

Return ONLY valid JSON (no markdown, no explanation):
{
  "hookStrength": <0-10>,
  "curiosity": <0-10>,
  "pacing": <0-10>,
  "narrativeProgression": <0-10>,
  "informationDensity": <0-10>,
  "repetition": <0-10 where 10 = very repetitive>,
  "predictability": <0-10 where 10 = very predictable>,
  "openLoops": <integer count>,
  "payoffs": <integer count>,
  "endingStrength": <0-10>,
  "ttsReadability": <0-10>,
  "suggestions": ["specific fix 1", "specific fix 2", "specific fix 3"],
  "overallScore": <0-100>
}

Scoring guide:
- hookStrength: Does the first sentence stop a scroller? 8+ = excellent
- curiosity: Are open loops created and paid off? 8+ = strong
- pacing: Sentence variety, rhythm, pattern interrupts? 8+ = dynamic
- narrativeProgression: Does tension/stakes escalate? 8+ = strong arc
- informationDensity: Every sentence carries value? 8+ = tight
- repetition: 0 = no repetition (ideal), 10 = very repetitive
- predictability: 0 = full of surprises (ideal), 10 = totally predictable
- ttsReadability: Can this be read aloud naturally? 8+ = excellent
- overallScore: Weighted average 0-100 (aim for honest scoring — most scripts are 50-70)`;
}

/**
 * Visual Prompt Generation
 * Creates detailed visual prompts for each script line
 */
export function buildVisualPromptPrompt(
  scriptLine: string,
  visualStyle: VisualStyle,
  visualBible: string,
): string {
  const styleDescriptions: Record<VisualStyle, string> = {
    '2d-stickman': 'Simple 2D stickfigure style with minimalist line art',
    '2d-minimal': 'Clean 2D minimal design with flat colors and simple shapes',
    '2d-editorial': 'Editorial illustration style with artistic linework',
    '2d-documentary': 'Documentary-style 2D illustrations',
    '3d-stylized': 'Stylized 3D with exaggerated proportions',
    '3d-educational': 'Clean 3D educational visualization',
    '3d-isometric': 'Isometric 3D perspective view',
    cinematic: 'Cinematic photorealistic 3D rendering',
    photorealistic: 'Photorealistic 3D rendering',
    '3d-lowpoly': 'Low-polygon 3D style',
    'paper-cutout': 'Paper cutout animation style',
    'hand-drawn': 'Hand-drawn illustration style',
    infographic: 'Infographic data visualization style',
    'animated-diagram': 'Animated diagram and flowchart style',
    'minimal-geometric': 'Minimal geometric abstract style',
    'map-geographic': 'Geographic map illustration',
    retro: 'Retro vintage illustration style',
  };

  return `You are writing a visual prompt for an AI image generator.

Style: ${styleDescriptions[visualStyle]}
Context: ${visualBible}
Narration: "${scriptLine}"

Task: Write 2-3 sentences (MAXIMUM 75 words) describing a scene that visually represents the narration's meaning.

CRITICAL RULES:
- Count ONLY actual words (not punctuation, not numbers)
- Start directly with the scene description
- NO thinking process, NO labels, NO JSON, NO "Here is", NO "Visual prompt:", NO "We need to", NO "Let's craft"
- NO word counting demonstrations (don't write "A1 small2 circle3...")
- Just write the scene description and STOP

Example of correct format:
"A small circle of friends gathers near a low bush bearing glossy red berries, under a clear sky. One person, wearing a simple green shirt, points confidently at a single berry while the others watch with relieved expressions."
(This is 38 words - well under the 75 word limit)

Now write your scene (max 75 words):`;
}

/**
 * Title Generation Prompt
 */
export function buildTitleGenerationPrompt(topic: string, researchData: string): string {
  return `Generate 30 compelling YouTube video titles for the topic: "${topic}"

RESEARCH DATA:
${researchData}

Write 3 real, specific titles for each of these 10 approaches:
1. Curiosity-driven
2. Contrarian
3. Mystery-style
4. Story-based
5. Business-angle
6. Explainer-style
7. Question-format
8. High-stakes
9. Unexpected-fact
10. Hybrid

OUTPUT FORMAT:

Curiosity-driven:
- [write a real curiosity-driven title about ${topic}]
- [write a real curiosity-driven title about ${topic}]
- [write a real curiosity-driven title about ${topic}]

Contrarian:
- [write a real contrarian title about ${topic}]
- [write a real contrarian title about ${topic}]
- [write a real contrarian title about ${topic}]

[Continue for all 10 approaches in the same format]

RULES:
- Replace every [write a real ... title] placeholder with an ACTUAL title about "${topic}"
- Each title must be specific to "${topic}" — not generic filler
- Plain text only — no parentheses, no brackets, no comments after the title
- Under 60 characters per title
- No markdown bold, no quotes around titles
- Do not output any placeholder text like "Title here" or "[write a ...]"`;
}

/**
 * Content Ideas Generation
 */
export function buildIdeaGenerationPrompt(topic: string, researchPatterns: string): string {
  return `Generate 20 original YouTube video content ideas for the topic below.

TOPIC: ${topic}

RESEARCH CONTEXT:
${researchPatterns}

Return a JSON array. Each element must follow this exact shape:
[
  {
    "category": "one of: Unusual Angle | Curiosity | Business | Documentary | Explainer | Personal Story | Contrarian | Technical | How & Why | Trending",
    "title": "The video title — specific, compelling, under 70 chars",
    "hook": "One sentence opening hook that would stop someone from scrolling",
    "value": "What the viewer gains from watching",
    "visualPotential": 8,
    "searchability": 7,
    "storytellingPotential": 8
  }
]

RULES:
- Return ONLY the JSON array. No markdown, no explanation, no text before or after.
- "title" must be a real video title — not a category name, not a description.
- "hook" must be different from "title" — it's the opening spoken line, not the title.
- Scores are integers 1–10.
- Be specific to the topic. No generic placeholders.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic / Niche Analysis Prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Topic Analysis Prompt
 *
 * Receives a list of real YouTube videos (title + views + channel + age) and
 * the user's query / niche, then asks the AI to:
 *   1. Cluster the videos into coherent topic groups
 *   2. Identify content gaps (what is missing or under-served)
 *   3. Extract winning title patterns visible across the videos
 *
 * The output is strict JSON so the research route can parse it directly into
 * the ResearchSession.analysis shape without post-processing.
 */
export function buildTopicAnalysisPrompt(
  niche: string,
  videoSummaries: string,
  totalVideos: number,
): string {
  return `You are a YouTube content strategist analyzing real search results for a specific niche.

NICHE / QUERY: "${niche}"
TOTAL VIDEOS IN DATASET: ${totalVideos}

VIDEO DATA (title | views | channel | published):
${videoSummaries}

Your task: analyse these real videos and return a JSON object with exactly three keys.

────────────────────────────────────────────────────────────────
OUTPUT FORMAT (strict JSON — no markdown, no explanation outside the JSON):
{
  "topics": [
    {
      "name": "short cluster label (3-6 words)",
      "description": "1-2 sentence description of what videos in this cluster share",
      "videoIndexes": [0, 3, 7],
      "evidence": ["why these were grouped together", "shared angle or format"]
    }
  ],
  "gaps": [
    {
      "gap": "concise gap label",
      "description": "what is missing or under-served in this niche based on the data",
      "opportunityReasoning": "why a new creator could win here",
      "estimatedDifficulty": "low|moderate|high",
      "oversaturated": ["angle heavily covered 1", "angle heavily covered 2"],
      "undersaturated": ["angle barely covered 1"],
      "outdated": ["topic that has old content needing refresh"]
    }
  ],
  "patterns": [
    {
      "pattern": "title template e.g. 'Why X is Y'",
      "description": "what makes this pattern work for this niche",
      "videoIndexes": [1, 5],
      "recentUsage": 2
    }
  ]
}
────────────────────────────────────────────────────────────────

RULES:
- Base every observation strictly on the provided video data — no invented facts.
- topics: identify 3-7 clusters. Every cluster must reference at least 2 video indexes.
- gaps: identify 3-5 content gaps. Reference oversaturated vs undersaturated angles visible in the data.
- patterns: identify 3-6 title patterns that appear 2+ times (e.g. "How X Works", "The Truth About X", "X vs Y").
- videoIndexes arrays use 0-based positions from the VIDEO DATA list above.
- estimatedDifficulty = "low" when the cluster has < 3 high-authority channels, "high" when top 3 channels dominate views.
- Return ONLY the JSON object. No prose before or after it.`;
}
