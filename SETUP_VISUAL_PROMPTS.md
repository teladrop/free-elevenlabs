# How to Fix Visual Prompts Generation

## The Problem
You're seeing: `❌ Error: OpenRouter error (404): This model is unavailable for free`

This happens because many OpenRouter models that were previously free are no longer free.

## Quick Fix (3 Steps)

### Step 1: Get a Fresh OpenRouter API Key
1. Go to https://openrouter.ai/
2. Sign up for a new account (or log into your existing one)
3. Go to https://openrouter.ai/keys
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

### Step 2: Update Your `.env.local` File
Open `.env.local` and update line 3:

```bash
OPENROUTER_API_KEY=sk-or-v1-YOUR_NEW_KEY_HERE
```

Replace `YOUR_NEW_KEY_HERE` with the key you copied.

### Step 3: Verify Model Configuration
Make sure these lines are in your `.env.local`:

```bash
# Working free models as of 2024
SCRIPT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
ANALYSIS_MODEL=nvidia/nemotron-3-super-120b-a12b:free
TITLES_MODEL=nvidia/nemotron-3-super-120b-a12b:free
VISUAL_MODEL=nvidia/nemotron-3-super-120b-a12b:free
FALLBACK_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

### Step 4: Restart the Dev Server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Testing Visual Prompts

1. Go to http://localhost:3000/visuals/prompts
2. Paste a short script (2-3 sentences)
3. Select a visual style
4. Click "Generate Prompts"
5. Wait 30-60 seconds

**Expected result:** Each line should show a detailed visual prompt description.

## If You Still See Errors

### Error: "Rate limit reached"
**Solution:** Wait 1-2 minutes and try again. Free models have limits.

### Error: "Model unavailable for free"
**Solution:** The model is no longer free. Update to a working model:

```bash
# Try these alternatives:
VISUAL_MODEL=meta-llama/llama-3.1-8b-instruct:free
# or
VISUAL_MODEL=google/gemini-2.0-flash-lite:free
```

### Error: "No endpoints found"
**Solution:** The model name is wrong. Use one of the verified models above.

## Upgrading to Paid (Recommended for Production)

If you need reliable, fast generation without rate limits:

1. Go to https://openrouter.ai/credits
2. Add credits (minimum $5)
3. Remove `:free` from model names in `.env.local`:

```bash
VISUAL_MODEL=nvidia/nemotron-3-super-120b-a12b
```

**Cost:** ~$0.001-0.01 per visual prompt (very affordable)

## Finding Available Free Models

To see all currently free models:

```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '.data[] | select(.pricing.prompt == "0") | .id'
```

Or visit: https://openrouter.ai/models?pricing=free

## Important Notes

1. **Free models change often** - A model that's free today might not be tomorrow
2. **Rate limits vary by model** - Some free models have stricter limits
3. **Quality varies** - Paid models generally produce better results
4. **Cache your prompts** - The app saves generated prompts to avoid regeneration

## Need Help?

Check the console logs:
```bash
# In your terminal where npm run dev is running
# Look for lines starting with [visuals/generate]
```

The logs will show:
- Which model is being used
- What errors occurred
- The actual API responses

## Current Configuration Status

Your app is configured to use:
- **API Provider:** OpenRouter
- **Visual Model:** nvidia/nemotron-3-super-120b-a12b:free
- **Fallback Model:** nvidia/nemotron-3-super-120b-a12b:free
- **Rate Limits:** Yes (free tier)
- **Requires Credits:** No

## Support

If visual prompts still don't work after following these steps:
1. Check the browser console (F12 → Console tab)
2. Check the terminal logs where `npm run dev` is running
3. Try a different model from the free models list
4. Consider adding $5-10 credits to OpenRouter for testing
