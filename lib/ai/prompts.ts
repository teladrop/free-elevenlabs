import { ScriptGenerationParams, VisualStyle } from '@/lib/types';

/**
 * Script Generation Prompt
 * Focuses on retention-first principles
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
  } = params;

  const lengthEstimate = Math.round(videoLength * 140); // ~140 words per minute

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

${
  keyPoints
    ? `Key Points to Cover:\n${keyPoints.map((kp) => `- ${kp}`).join('\n')}\n`
    : ''
}

${researchMaterial ? `Research Material:\n${researchMaterial}\n` : ''}

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
 * Script Analysis Prompt
 * Analyzes script for retention factors
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
 * Script Rewrite Prompt
 * Improves weak sections of script
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

  return `Generate a detailed visual prompt for this narration line.

NARRATION LINE:
"${scriptLine}"

VISUAL STYLE: ${styleDescriptions[visualStyle]}

VISUAL BIBLE / CONTEXT:
${visualBible}

Requirements:
1. Understand what the narration is communicating, not just the literal nouns
2. Create a visual that illustrates the idea/concept being spoken
3. Be specific about composition, camera angle, lighting, and elements
4. Include color direction and atmosphere consistent with the visual style
5. Specify duration if appropriate (e.g., "2-3 seconds")
6. Suggest any motion or animation direction

Format response as:
{
  "prompt": "detailed visual prompt description",
  "duration": "estimated duration in seconds",
  "motionSuggestion": "description of motion if any",
  "keyElements": ["element 1", "element 2", "element 3"]
}`;
}

/**
 * Title Generation Prompt
 */
export function buildTitleGenerationPrompt(topic: string, researchData: string): string {
  return `Generate 30 compelling YouTube video titles for this topic.

TOPIC: ${topic}

RESEARCH DATA:
${researchData}

Generate titles using these approaches (3 titles each):
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

OUTPUT FORMAT — follow this EXACTLY:

Curiosity-driven:
- Title here
- Title here
- Title here

Contrarian:
- Title here
- Title here
- Title here

[Repeat for all 10 approaches]

STRICT RULES:
- Every list item must be a plain title string only — no brackets, no parentheses, no comments, no scores, no counts, no labels, no explanations after the title
- Titles must be under 60 characters
- No markdown bold (**), no quotes around titles, no trailing punctuation other than ? or !
- Do not add any text outside the category blocks above
- Do not number the titles within a category`;
}

/**
 * Content Ideas Generation
 */
export function buildIdeaGenerationPrompt(topic: string, researchPatterns: string): string {
  return `Generate 50 original video content ideas for this topic.

TOPIC: ${topic}

RESEARCH INSIGHTS:
${researchPatterns}

Generate ideas in these categories (5 each):
1. Unusual angles (underexplored perspectives)
2. Curiosity-driven (create open loops)
3. Business angles (economics, strategy)
4. Documentary angles (deep dives)
5. Explainer angles (educational)
6. Personal story angles (relatable narratives)
7. Contrarian angles (challenge consensus)
8. Technical deep-dives (for sophisticated audience)
9. "How/Why" angles (explanatory)
10. Emerging trends (forward-looking)

For each idea provide:
- Title/angle
- Hook/opening
- Unique value
- Visual potential (1-10)
- Searchability (1-10)
- Storytelling potential (1-10)

Format as JSON array of objects.
Be specific and original. Don't suggest generic titles.
Use research data to inform novelty.`;
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
