import { ScriptGenerationParams, VisualStyle } from '@/lib/types';

// ── CTA helpers ───────────────────────────────────────────────────────────────

const CTA_POSITION_LABELS: Record<string, string> = {
  'after-hook': 'right after the opening hook (around 10–15 seconds in)',
  'early':      'early in the script (around the 25% mark)',
  'mid':        'in the middle of the script (around the 50% mark)',
  'late':       'late in the script (around the 75% mark)',
  'end':        'near the very end (around the 90% mark)',
};

function buildCtaBlock(channelName: string, channelCategory: string, position: string): string {
  const ch = channelName || 'this channel';
  const cat = channelCategory ? ` ${channelCategory}` : '';
  const posLabel = CTA_POSITION_LABELS[position] || 'near the end';

  return `
CTA INSTRUCTIONS:
- Insert a natural, conversational CTA ${posLabel}.
- The CTA must NOT feel like an interruption — blend it into the flow of the script.
- Channel name: "${ch}"
- Channel category: "${cat.trim() || 'general'}"
- CTA must include: subscribe to ${ch} + like this video
- Keep it under 2 sentences, energetic but not salesy.
- Example formats you can adapt:
  * "If you enjoy${cat} content like this, subscribe to ${ch} — we drop new videos every week."
  * "Hit like if this changed your perspective, and subscribe to ${ch} so you never miss one."
  * "This is the kind of${cat} deep-dive we do here at ${ch} — subscribe so you catch every one."
`;
}

/**
 * Script Generation Prompt
 * Focuses on retention-first principles with optional CTA
 */
export function buildScriptPrompt(params: ScriptGenerationParams): string {
  const {
    topic, contentType, style, targetAudience,
    videoLength, tone, retentionIntensity,
    keyPoints, researchMaterial, platform,
    channelName, channelCategory, ctaPosition,
  } = params;

  const lengthEstimate = Math.round(videoLength * 140);
  const ctaBlock = (ctaPosition && ctaPosition !== 'none')
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition)
    : '';

  return `You are an expert retention-focused content scriptwriter for ${platform}.

Your task: Write a compelling, TTS-ready narration script.

CRITICAL: The script must contain ONLY the words to be spoken. NO timestamps, scene numbers, visual instructions, [SFX], [MUSIC], or any production notes.

Topic: ${topic}
Content Type: ${contentType}
Style: ${style}
Target Audience: ${targetAudience}
Video Length: ${videoLength} minutes (~${lengthEstimate} words)
Tone: ${tone}
Retention Intensity: ${retentionIntensity}/10
${channelName ? `Channel: ${channelName}` : ''}
${channelCategory ? `Category: ${channelCategory}` : ''}

${keyPoints ? `Key Points to Cover:\n${keyPoints.map(kp => `- ${kp}`).join('\n')}\n` : ''}
${researchMaterial ? `Research Material:\n${researchMaterial}\n` : ''}
${ctaBlock}

RETENTION-FIRST PRINCIPLES:
1. Start with a strong hook (first 3 seconds are critical)
2. Create immediate curiosity and open loops
3. Use information gaps to maintain interest
4. Build narrative progression and escalation
5. Include surprising or counterintuitive information
6. Use varied sentence lengths (mix short and long)
7. Create pattern interrupts throughout
8. Strong transitions between ideas
9. Maintain emotional or intellectual tension
10. Powerful closing that delivers on the hook

AVOID:
- "You won't believe..." or "Shocking..." clichés
- Unnecessary exposition
- Repetition of information
- Padding to reach word count
- Essay-style writing (write for spoken narration)
- Weak or abrupt endings

Write only the plain narration text. Every word should be engaging and necessary.`;
}

/**
 * External Script Rewrite Prompt
 * Rewrites a user-supplied script to be retention-optimised + adds CTA
 */
export function buildExternalScriptRewritePrompt(
  externalScript: string,
  params: ScriptGenerationParams,
): string {
  const {
    style, targetAudience, tone, platform,
    channelName, channelCategory, ctaPosition,
  } = params;

  const ctaBlock = (ctaPosition && ctaPosition !== 'none')
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition)
    : '';

  return `You are an expert retention-focused scriptwriter for ${platform}.

Rewrite the script below to be retention-optimised for YouTube. Keep all the original information and intent — only improve the delivery, pacing, hook, and flow.

ORIGINAL SCRIPT:
"""
${externalScript}
"""

Style: ${style}
Target Audience: ${targetAudience}
Tone: ${tone}
${channelName ? `Channel: ${channelName}` : ''}
${channelCategory ? `Category: ${channelCategory}` : ''}
${ctaBlock}

REWRITE RULES:
- Keep all original facts, arguments, and core message
- Improve the opening hook to grab attention in the first 3 seconds
- Add open loops and curiosity gaps throughout
- Vary sentence length — mix punchy short sentences with richer longer ones
- Improve transitions between ideas
- Strengthen the ending so it delivers on the hook
- Output ONLY the rewritten narration text — no notes, no labels, no production directions

Return only the rewritten script.`;
}

/**
 * AI Fix Prompt — applies analysis suggestions to an existing script
 */
export function buildScriptFixPrompt(
  script: string,
  analysis: Record<string, unknown>,
  params: ScriptGenerationParams,
): string {
  const suggestions = (analysis.suggestions as string[] | undefined) ?? [];
  const {
    channelName, channelCategory, ctaPosition, platform,
  } = params;

  const ctaBlock = (ctaPosition && ctaPosition !== 'none')
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition)
    : '';

  const weakAreas: string[] = [];
  const a = analysis as Record<string, number>;
  if (a.hookStrength           < 6) weakAreas.push('Hook is weak — rewrite the opening to be more compelling');
  if (a.curiosity              < 6) weakAreas.push('Lacks curiosity gaps — add open loops and withheld payoffs');
  if (a.pacing                 < 6) weakAreas.push('Pacing is flat — vary sentence length, add punchy one-liners');
  if (a.predictability         > 5) weakAreas.push('Too predictable — add a surprising or counterintuitive angle');
  if (a.ttsReadability         < 7) weakAreas.push('Hard to read aloud — simplify long sentences');
  if (a.narrativeProgression   < 6) weakAreas.push('Weak narrative arc — escalate tension or stakes earlier');
  if (a.endingStrength         < 6) weakAreas.push('Weak ending — make it deliver on the hook\'s promise');

  return `You are an expert retention-focused scriptwriter for ${platform}.

Fix the script below using the AI analysis feedback. Apply every suggestion and address every weak area listed.

ORIGINAL SCRIPT:
"""
${script}
"""

AI ANALYSIS SCORE: ${analysis.overallScore ?? '?'}/100

WEAK AREAS TO FIX:
${weakAreas.map(w => `- ${w}`).join('\n') || '- General polish and flow'}

SPECIFIC SUGGESTIONS:
${suggestions.map(s => `- ${s}`).join('\n') || '- Improve overall quality'}
${channelName ? `\nChannel: ${channelName}` : ''}
${channelCategory ? `Category: ${channelCategory}` : ''}
${ctaBlock}

RULES:
- Keep all the original information and facts
- Apply every fix listed above
- Output ONLY the fixed narration — no explanations, no labels
- Maintain approximately the same length

Return only the fixed script.`;
}

/**
 * Script Analysis Prompt
 */
export function buildScriptAnalysisPrompt(script: string): string {
  return `Analyze this script for retention quality. Score each aspect 0-10 where applicable.

SCRIPT TO ANALYZE:
"""
${script}
"""

Provide analysis in JSON format:
{
  "hookStrength": <0-10>,
  "curiosity": <0-10>,
  "pacing": <0-10>,
  "narrativeProgression": <0-10>,
  "informationDensity": <0-10>,
  "repetition": <0-10 lower is better>,
  "predictability": <0-10 lower is better>,
  "openLoops": <count>,
  "payoffs": <count>,
  "endingStrength": <0-10>,
  "ttsReadability": <0-10>,
  "suggestions": [
    "specific improvement 1",
    "specific improvement 2"
  ],
  "overallScore": <0-100>
}

Focus on:
- Is the hook strong enough to stop scrollers?
- Does the script maintain curiosity throughout?
- Is the pacing varied to prevent monotony?
- Does information unfold logically?
- Are there open loops that pay off?
- Is the ending satisfying?
- Will this read well aloud for TTS?`;
}

/**
 * Script Rewrite Prompt (internal — improves weak sections after initial generation)
 */
export function buildScriptRewritePrompt(
  script: string,
  analysis: Record<string, unknown>,
  weakAreas: string[],
): string {
  return `Rewrite this script to improve its retention and engagement.

ORIGINAL SCRIPT:
"""
${script}
"""

ANALYSIS FEEDBACK:
${JSON.stringify(analysis, null, 2)}

AREAS TO IMPROVE:
${weakAreas.map(area => `- ${area}`).join('\n')}

Requirements:
- Keep the core message and information
- Only rewrite the narration text (no production notes)
- Maintain approximately the same length
- Improve hook, curiosity, and pacing
- Fix weak transitions and information flow
- Strengthen the ending

Return ONLY the improved script narration. No explanations or notes.`;
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
