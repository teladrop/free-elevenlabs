# Visual Prompts Generator - Known Issues & Solutions

## Rate Limiting on Free Models

### Problem
OpenRouter's free AI models have strict rate limits. When generating visual prompts for multiple lines, you may encounter:
- "Rate limit reached" errors
- "No prompt yet" messages
- Some lines generating successfully while others fail

### Why This Happens
Free tier models on OpenRouter are shared resources with:
- Requests per minute (RPM) limits
- Requests per day (RPD) limits  
- Model-specific rate limits that vary

### Solutions

#### 1. Wait and Retry (Recommended for Free Users)
-  Wait 1-2 minutes between generation attempts
- Generate prompts in smaller batches (5-10 lines at a time)
- Use the "Regenerate" button for individual failed lines

#### 2. Switch to a Different Free Model
Some models have better rate limits than others. Edit `.env.local`:
```bash
# Try different free models:
VISUAL_MODEL=nvidia/nemotron-3-super-120b-a12b:free  # Most reliable
# VISUAL_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free  # Higher quality but stricter limits
```

#### 3. Upgrade to OpenRouter Paid Tier
- Add credits to your OpenRouter account
- Remove `:free` suffix from model names
- Example: `VISUAL_MODEL=nvidia/nemotron-3-super-120b-a12b`
- Cost: ~$0.001-0.01 per visual prompt depending on model

#### 4. Use Your Own API Keys
Configure your own API keys for models like:
- OpenAI GPT-4
- Anthropic Claude
- Google Gemini

### Current Configuration
The app defaults to:
- **Visual Model**: `nvidia/nemotron-3-super-120b-a12b:free`
- **Fallback**: Same as above
- **Rate Limit Behavior**: Errors are shown in-line, generation continues for other lines

### Best Practices
1. **Generate during off-peak hours** (late night/early morning UTC)
2. **Keep scripts concise** - shorter scripts = fewer API calls
3. **Use the visual bible** effectively to get better prompts faster
4. **Save prompts immediately** - don't regenerate unnecessarily
5. **Copy prompts to clipboard** regularly as backup

### Error Messages Explained
- **"Rate limit reached"** = Too many requests too quickly, wait 60-120 seconds
- **"Model unavailable for free"** = Model no longer free, switch models
- **"No endpoints found"** = Model name incorrect or deprecated
- **"No prompt yet"** = Generation failed silently, check console logs

### Monitoring Usage
Check the Next.js console output for detailed logs:
```
[visuals/generate] Generating prompt for line 0: ...
[visuals/generate] Line 0 response: ...
[visuals/generate] line 0 failed: Rate limit reached...
```

### Future Improvements
- [ ] Add retry logic with exponential backoff
- [ ] Implement queue system for batch processing
- [ ] Add progress indicators for long-running generations
- [ ] Cache generated prompts to reduce API calls
- [ ] Support for local AI models (Ollama, LM Studio)
