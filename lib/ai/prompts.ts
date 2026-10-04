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
    referenceTranscripts,
  } = params;

  const lengthEstimate = Math.round(videoLength * 130); // ~130 words per minute for TTS narration

  const hasCta = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta
    ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!)
    : '';

  // Build reference block — up to 3 transcripts, each truncated to ~400 words
  // so the prompt stays within token limits while giving enough style signal.
  const MAX_WORDS_PER_REF = 400;
  const refBlock = (referenceTranscripts ?? []).length > 0
    ? `
REFERENCE TRANSCRIPTS (learn from these — style, pacing, voice, hook patterns):
These are real high-performing scripts on topics related to "${topic}".
Study how they open, how they build tension, how they use sentence rhythm.
DO NOT copy their content or facts. ONLY absorb the writing style and structure.

${(referenceTranscripts ?? []).slice(0, 3).map((r, i) => {
  const words = r.transcript.split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, MAX_WORDS_PER_REF).join(' ') + (words.length > MAX_WORDS_PER_REF ? '…' : '');
  return `--- Reference ${i + 1}: "${r.title}" ---\n${excerpt}`;
}).join('\n\n')}

Now write a NEW, ORIGINAL script about "${topic}" that adopts the voice, pacing, and hook energy from the references above — but with completely original content.
`
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
${refBlock}
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
 * Script Analysis Prompt — complete rebuild.
 * Returns a rich ScriptAnalysis JSON with per-section scores,
 * retention curve estimates, findings, and prioritised fixes.
 */
export function buildScriptAnalysisPrompt(script: string): string {
  return `You are a senior YouTube retention analyst. Analyze the script below and return a single JSON object.

SCRIPT:
"""
${script}
"""

Analyze these 6 sections:
1. Hook (first 10% of script) — does it stop a scroller in under 5 seconds?
2. Curiosity & Open Loops — are questions raised that force the viewer to stay?
3. Pacing & Rhythm — sentence variety, pattern interrupts, no monotone walls of text?
4. Narrative Arc — does tension/stakes build progressively, or does it plateau?
5. Information Density — every sentence earns its place, no filler or padding?
6. Ending & Payoff — does it deliver on the hook's promise? Satisfying close?

For each section produce findings: specific observations quoting or referencing the ACTUAL script content — not generic advice.

Severity rules:
- "good" = this element is working well, keep it
- "warn" = present but weak, could be stronger
- "bad"  = missing or actively hurting retention

Retention curve: estimate what % of viewers are still watching at each point IF this script were read as-is.
Use these real YouTube benchmarks as your baseline — score RELATIVE to them:
- At 30 seconds: YouTube average is ~70%. Strong scripts hit 75-85%. Weak hooks drop to 50-60%.
- At midpoint:   YouTube average is ~45%. Strong scripts hit 55-65%. Weak pacing drops to 30-40%.
- At end:        YouTube average is ~35%. Strong scripts hit 40-55%. Poor endings drop to 20-30%.
Be honest and realistic. Do NOT inflate scores. A score of 65% at midpoint is excellent.

Return ONLY valid JSON. No markdown fences. No text before or after. Start with { end with }.

{
  "overallScore": <integer 0-100>,
  "headline": "<one punchy sentence verdict on the whole script>",
  "retention30s": <integer 0-100, % still watching at 30 seconds>,
  "retentionMid": <integer 0-100, % still watching at midpoint>,
  "retentionEnd": <integer 0-100, % still watching at end>,
  "sections": [
    {
      "name": "Hook",
      "score": <integer 0-100>,
      "verdict": "<one sentence on what this section does well or poorly>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation from this script>", "severity": "good|warn|bad" },
        { "label": "<short tag>", "detail": "<specific observation from this script>", "severity": "good|warn|bad" }
      ],
      "fix": "<one concrete rewrite instruction, or null if score >= 80>"
    },
    {
      "name": "Curiosity & Open Loops",
      "score": <integer 0-100>,
      "verdict": "<one sentence>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation>", "severity": "good|warn|bad" }
      ],
      "fix": "<concrete fix or null>"
    },
    {
      "name": "Pacing & Rhythm",
      "score": <integer 0-100>,
      "verdict": "<one sentence>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation>", "severity": "good|warn|bad" }
      ],
      "fix": "<concrete fix or null>"
    },
    {
      "name": "Narrative Arc",
      "score": <integer 0-100>,
      "verdict": "<one sentence>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation>", "severity": "good|warn|bad" }
      ],
      "fix": "<concrete fix or null>"
    },
    {
      "name": "Information Density",
      "score": <integer 0-100>,
      "verdict": "<one sentence>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation>", "severity": "good|warn|bad" }
      ],
      "fix": "<concrete fix or null>"
    },
    {
      "name": "Ending & Payoff",
      "score": <integer 0-100>,
      "verdict": "<one sentence>",
      "findings": [
        { "label": "<short tag>", "detail": "<specific observation>", "severity": "good|warn|bad" }
      ],
      "fix": "<concrete fix or null>"
    }
  ],
  "strengths": [
    "<specific strength 1 from this script>",
    "<specific strength 2 from this script>",
    "<specific strength 3 from this script>"
  ],
  "criticalFixes": [
    "<most impactful fix — specific to this script>",
    "<second most impactful fix>",
    "<third most impactful fix>"
  ]
}`;
}

/**
 * Script Rewrite Prompt
 * Original — improves weak sections after initial generation.
 * Works with new ScriptAnalysis shape.
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

WEAK AREAS TO FIX:
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
 * Works with new ScriptAnalysis shape.
 */
export function buildScriptFixPrompt(
  script: string,
  analysis: Record<string, unknown>,
  params: ScriptGenerationParams,
): string {
  const { topic, channelName, channelCategory, ctaPosition, platform } = params;
  const hasCta   = ctaPosition && ctaPosition !== 'none';
  const ctaBlock = hasCta ? buildCtaBlock(channelName || '', channelCategory || '', ctaPosition!) : '';

  // Pull fixes from new analysis shape
  const criticalFixes = (analysis.criticalFixes as string[] | undefined) ?? [];
  const sections      = (analysis.sections as Array<{ name: string; score: number; fix: string | null }> | undefined) ?? [];
  const weakSections  = sections.filter(s => s.fix && s.score < 80);

  return `You are an expert retention-focused content scriptwriter for ${platform}.

Fix this script using the AI analysis feedback. Apply every fix listed — no skipping.
${topic ? `Topic: "${topic}" — keep every sentence on this topic.` : ''}

ORIGINAL SCRIPT:
"""
${script}
"""

OVERALL SCORE: ${analysis.overallScore ?? '?'}/100
HEADLINE: ${analysis.headline ?? ''}

CRITICAL FIXES (apply all):
${criticalFixes.length > 0 ? criticalFixes.map(f => `- ${f}`).join('\n') : '- Improve overall engagement and retention'}

SECTION-LEVEL FIXES:
${weakSections.length > 0 ? weakSections.map(s => `- [${s.name}] ${s.fix}`).join('\n') : '- Polish flow and sentence variety'}
${ctaBlock}
RULES:
- Keep all original facts and information
- Apply every fix above — no exceptions
- Maintain approximately the same word count
- Output ONLY the fixed narration — no explanations, no labels

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
