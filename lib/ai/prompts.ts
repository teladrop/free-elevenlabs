import { ScriptGenerationParams, VisualStyle } from '@/lib/types';

// ── CTA helper ────────────────────────────────────────────────────────────────
// Builds the literal CTA sentence appended to the original script prompt.
// Kept minimal so it doesn't change the script voice/style.

function buildCtaSentence(channelName: string, channelCategory: string): string {
  const ch  = channelName  || 'this channel';
  const cat = channelCategory ? ` ${channelCategory}` : '';
  return `If you enjoy${cat} content like this, hit like and subscribe to ${ch} — new videos every week.`;
}

function buildCtaBlock(channelName: string, channelCategory: string, position: string): string {
  const sentence = buildCtaSentence(channelName, channelCategory);
  const where: Record<string, string> = {
    'after-hook': 'right after your opening hook (2nd or 3rd sentence)',
    'early':      'after your first main point (~25% through the script)',
    'mid':        'at the midpoint of the script (~50% through)',
    'late':       'near the end of the script (~75% through)',
    'end':        'as the second-to-last sentence before you close',
  };
  const placement = where[position] ?? where['end'];
  return `
CTA: Place this line ${placement}. Write it so it flows naturally in the narration — not like an ad break.
CTA text: "${sentence}"
`;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Script Generation Prompt
 * Original retention-first prompt — unchanged from original.
 * CTA appended only when the user has it enabled.
 */
export function buildScriptPrompt(params: ScriptGenerationParams): string {
  const {
    topic,
    contentType,
    style,
    targetAudience,
    videoLength,
    tone,
    retentionIntensity,
    keyPoints,
    researchMaterial,
    platform,
    channelName,
    channelCategory,
    ctaPosition,
  } = params;

  const lengthEstimate = Math.round(videoLength * 140); // ~140 words per minute

  const hasCta = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!)
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

${keyPoints ? `Key Points to Cover:\n${keyPoints.map((kp) => `- ${kp}`).join('\n')}\n` : ''}
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
- "You won't believe..." or "Shocking..." cliches
- Unnecessary exposition
- Repetition of information
- Padding to reach word count
- Essay-style writing (write for spoken narration)
- Weak or abrupt endings

Write only the plain narration text. Every word should be engaging and necessary.`;
}

/**
 * Script Analysis Prompt
 * Hardened to always return valid JSON — no markdown fences, no prose.
 */
export function buildScriptAnalysisPrompt(script: string): string {
  return `Analyze this YouTube script for retention quality.

SCRIPT:
"""
${script}
"""

Return ONLY a valid JSON object. No markdown. No code fences. No explanation before or after.
Start your response with { and end with }.

{
  "hookStrength": <integer 0-10>,
  "curiosity": <integer 0-10>,
  "pacing": <integer 0-10>,
  "narrativeProgression": <integer 0-10>,
  "informationDensity": <integer 0-10>,
  "repetition": <integer 0-10, lower is better>,
  "predictability": <integer 0-10, lower is better>,
  "openLoops": <integer count>,
  "payoffs": <integer count>,
  "endingStrength": <integer 0-10>,
  "ttsReadability": <integer 0-10>,
  "suggestions": [
    "specific actionable improvement 1",
    "specific actionable improvement 2",
    "specific actionable improvement 3"
  ],
  "overallScore": <integer 0-100>
}

Scoring guide:
- hookStrength: Does sentence 1 stop a scroller? 8+ = strong
- curiosity: Are there open loops and withheld payoffs? 8+ = strong
- pacing: Varied sentence length, rhythm, pattern interrupts? 8+ = dynamic
- narrativeProgression: Does tension or stakes escalate? 8+ = strong arc
- informationDensity: Every sentence carries value? 8+ = tight
- repetition: 0 = no repetition (ideal), 10 = very repetitive
- predictability: 0 = surprising (ideal), 10 = totally predictable
- ttsReadability: Can it be read aloud naturally? 8+ = excellent
- overallScore: Honest 0-100 weighted average. Most scripts score 50-75.
- suggestions: 3 specific, actionable fixes. Not vague. Reference the actual script.`;
}

/**
 * Script Rewrite Prompt
 * Original — improves weak sections after initial generation.
 */
export function buildScriptRewritePrompt(
  script: string,
  analysis: Record<string, unknown>,
  weakAreas: string[],
  params?: ScriptGenerationParams,
): string {
  const topic = params?.topic ?? '';
  return `Rewrite this script to improve its retention and engagement.
${topic ? `The script is about: "${topic}" — keep every sentence on this topic.\n` : ''}
ORIGINAL SCRIPT:
"""
${script}
"""

ANALYSIS FEEDBACK:
${JSON.stringify(analysis, null, 2)}

AREAS TO IMPROVE:
${weakAreas.map((area) => `- ${area}`).join('\n')}

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
 * External Script Rewrite Prompt
 * User pastes a script from outside — AI rewrites it retention-first.
 */
export function buildExternalScriptRewritePrompt(
  externalScript: string,
  params: ScriptGenerationParams,
): string {
  const { topic, style, targetAudience, tone, platform, channelName, channelCategory, ctaPosition } = params;
  const hasCta   = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!) : '';
  const topicLine = topic?.trim()
    ? `Topic: "${topic}" — every sentence must stay on this topic.`
    : 'Keep the same topic as the original script.';

  return `You are an expert retention-focused content scriptwriter for ${platform}.

Rewrite the script below to be highly engaging and retention-optimised.
${topicLine}
Keep ALL the original information — only improve delivery, pacing, hook, and flow.

ORIGINAL SCRIPT:
"""
${externalScript}
"""

Style: ${style} | Audience: ${targetAudience} | Tone: ${tone}
${ctaBlock}
REWRITE RULES:
- Improve the opening hook — first sentence must create immediate curiosity
- Add open loops and curiosity gaps throughout
- Mix short punchy sentences with longer flowing ones
- Strengthen transitions between ideas
- Rewrite the ending to deliver on the hook's promise
- Output ONLY the rewritten narration — no labels, no notes

Write the rewritten script now:`;
}

/**
 * AI Fix Prompt
 * Applies analysis suggestions to an existing script.
 */
export function buildScriptFixPrompt(
  script: string,
  analysis: Record<string, unknown>,
  params: ScriptGenerationParams,
): string {
  const suggestions = (analysis.suggestions as string[] | undefined) ?? [];
  const { topic, channelName, channelCategory, ctaPosition, platform } = params;
  const hasCta   = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!) : '';

  const a = analysis as Record<string, number>;
  const weakAreas: string[] = [];
  if ((a.hookStrength         ?? 10) < 7) weakAreas.push('Hook is weak — rewrite the first sentence to be more gripping');
  if ((a.curiosity            ?? 10) < 7) weakAreas.push('Not enough curiosity — add open loops that get paid off later');
  if ((a.pacing               ?? 10) < 7) weakAreas.push('Pacing flat — break up long paragraphs with short punchy sentences');
  if ((a.predictability       ??  0) > 4) weakAreas.push('Too predictable — add a surprising or counterintuitive fact');
  if ((a.ttsReadability       ?? 10) < 7) weakAreas.push('Hard to read aloud — shorten sentences over 25 words');
  if ((a.narrativeProgression ?? 10) < 7) weakAreas.push('Weak arc — raise stakes or tension in the middle section');
  if ((a.endingStrength       ?? 10) < 7) weakAreas.push('Weak ending — rewrite to deliver on the hook\'s promise');

  return `You are an expert retention-focused content scriptwriter for ${platform}.

Fix this script using the AI analysis feedback. Apply every fix listed.
${topic ? `Topic: "${topic}" — keep every sentence on this topic.` : ''}

ORIGINAL SCRIPT:
"""
${script}
"""

AI SCORE: ${analysis.overallScore ?? '?'}/100

FIXES TO APPLY:
${weakAreas.length > 0 ? weakAreas.map(w => `- ${w}`).join('\n') : '- General polish and flow improvement'}

SUGGESTIONS FROM ANALYSIS:
${suggestions.length > 0 ? suggestions.map(s => `- ${s}`).join('\n') : '- Improve overall engagement'}
${ctaBlock}
RULES:
- Keep all original facts and information
- Apply every fix above — no exceptions
- Maintain approximately the same word count
- Output ONLY the fixed narration — no explanations

Write the fixed script now:`;
}

/**
 * Visual Prompt Generation
 */
export function buildVisualPromptPrompt(
  scriptLine: string,
  visualStyle: VisualStyle,
  visualBible: string,
): string {
  const styleDescriptions: Record<VisualStyle, string> = {
    '2d-stickman':        'Simple 2D stickfigure style with minimalist line art',
    '2d-minimal':         'Clean 2D minimal design with flat colors and simple shapes',
    '2d-editorial':       'Editorial illustration style with artistic linework',
    '2d-documentary':     'Documentary-style 2D illustrations',
    '3d-stylized':        'Stylized 3D with exaggerated proportions',
    '3d-educational':     'Clean 3D educational visualization',
    '3d-isometric':       'Isometric 3D perspective view',
    cinematic:            'Cinematic photorealistic 3D rendering',
    photorealistic:       'Photorealistic 3D rendering',
    '3d-lowpoly':         'Low-polygon 3D style',
    'paper-cutout':       'Paper cutout animation style',
    'hand-drawn':         'Hand-drawn illustration style',
    infographic:          'Infographic data visualization style',
    'animated-diagram':   'Animated diagram and flowchart style',
    'minimal-geometric':  'Minimal geometric abstract style',
    'map-geographic':     'Geographic map illustration',
    retro:                'Retro vintage illustration style',
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
- Each title must be specific to "${topic}" -- not generic filler
- Plain text only -- no parentheses, no brackets, no comments after the title
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
    "title": "The video title -- specific, compelling, under 70 chars",
    "hook": "One sentence opening hook that would stop someone from scrolling",
    "value": "What the viewer gains from watching",
    "visualPotential": 8,
    "searchability": 7,
    "storytellingPotential": 8
  }
]

RULES:
- Return ONLY the JSON array. No markdown, no explanation, no text before or after.
- "title" must be a real video title -- not a category name, not a description.
- "hook" must be different from "title" -- it's the opening spoken line, not the title.
- Scores are integers 1-10.
- Be specific to the topic. No generic placeholders.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic / Niche Analysis Prompt
// ─────────────────────────────────────────────────────────────────────────────

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

OUTPUT FORMAT (strict JSON -- no markdown, no explanation outside the JSON):
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

RULES:
- Base every observation strictly on the provided video data -- no invented facts.
- topics: identify 3-7 clusters. Every cluster must reference at least 2 video indexes.
- gaps: identify 3-5 content gaps. Reference oversaturated vs undersaturated angles visible in the data.
- patterns: identify 3-6 title patterns that appear 2+ times (e.g. "How X Works", "The Truth About X", "X vs Y").
- videoIndexes arrays use 0-based positions from the VIDEO DATA list above.
- estimatedDifficulty = "low" when the cluster has < 3 high-authority channels, "high" when top 3 channels dominate views.
- Return ONLY the JSON object. No prose before or after it.`;
}
