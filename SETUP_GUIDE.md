# Setup Guide - Fish Audio TTS

## What Changed?

✅ **Replaced** Web Speech API (robotic voices)  
✅ **Added** Fish Audio S2.1 Pro API (natural AI voices)  
✅ **Added** Voice preview button  
✅ **Improved** Clean, modern UI  
✅ **Added** 6 curated professional voices  

---

## Quick Start

### 1. Get Your Free API Key

1. Go to **[Fish Audio](https://fish.audio/go-api/)**
2. Sign up for a free account
3. Get your API key (8,000 free credits per month)

### 2. Run the App

```bash
npm run dev
```

Open http://localhost:3000

### 3. Enter Your API Key

- The app will show a banner asking for your API key
- Paste your Fish Audio API key
- Click "Save" - it's stored in your browser

### 4. Generate Speech

1. **Choose a voice** - Click on any voice card
2. **Preview it** - Click the play button to hear a sample
3. **Type your text** - Enter what you want to say
4. **Adjust speed** - Use the slider (0.5x - 2.0x)
5. **Generate** - Click "Generate Speech"
6. **Download** - Save as MP3

---

## Features

### 🎙️ 6 Professional Voices

- **Bella** - Warm, friendly female voice
- **Alex** - Professional, clear male voice
- **Emma** - Energetic, upbeat female voice
- **David** - Deep, documentary-style male voice
- **Sophie** - Calm, soothing female voice
- **James** - Formal business male voice

### ⚡ Fast Generation

- **Real-time** - Speech generates in seconds
- **MP3 format** - Small file size, high quality
- **No downloads** - No model files to load

### 🎛️ Controls

- **Speed control** - 0.5x to 2.0x playback speed
- **Voice preview** - Test before generating
- **History** - Last 20 generations saved
- **Download** - Save as MP3 file

---

## Free Tier Limits

Fish Audio free tier includes:
- ✅ **8,000 credits per month**
- ✅ **~500 characters per generation**
- ✅ **All voices available**
- ✅ **Commercial use allowed**

**Example:** 8,000 credits = ~80-100 generations of average text

---

## Voice IDs (If You Want to Add More)

To add more voices, find them on [fish.audio](https://fish.audio) and add to the `VOICES` array in `app/page.tsx`:

```typescript
{
  id: 'voice-id-from-url',  // Copy from fish.audio voice page
  name: 'Display Name',
  preview_text: 'Sample text for preview',
  language: 'English',
  tags: ['tag1', 'tag2'],
  description: 'Brief description',
}
```

---

## Troubleshooting

### "API Error: 401"
- Your API key is invalid
- Get a new key from fish.audio

### "API Error: 402"
- You're out of credits
- Wait for next month's reset or upgrade plan

### "API Error: 429"
- Rate limit hit
- Wait a minute and try again

### No audio plays
- Check browser volume
- Try downloading the file instead
- Check browser console for errors

---

## Why Fish Audio?

### Previous Issues (Web Speech API)
- ❌ Robotic, unnatural voices
- ❌ Limited quality
- ❌ Inconsistent across browsers

### Current Solution (Fish Audio)
- ✅ Natural, human-like voices
- ✅ Professional quality
- ✅ Fast generation
- ✅ Generous free tier
- ✅ Commercial use allowed

---

## Cost Comparison

| Service | Free Tier | Quality |
|---------|-----------|---------|
| **Fish Audio** | 8,000 credits/month | ⭐⭐⭐⭐⭐ Excellent |
| Web Speech API | Unlimited | ⭐⭐ Poor (robotic) |
| ElevenLabs | 10,000 chars/month | ⭐⭐⭐⭐⭐ Excellent |
| Google Cloud TTS | $4/million chars | ⭐⭐⭐⭐ Very Good |

**Verdict:** Fish Audio offers the best balance of quality and free tier.

---

## Next Steps

Want to improve it further?

1. **Add more voices** - Browse fish.audio and add voice IDs
2. **Add voice cloning** - Upload audio to clone custom voices
3. **Add emotional tags** - Use Fish Audio's emotion control
4. **Add streaming** - Use WebSocket API for real-time playback
5. **Add batch processing** - Generate multiple files at once

---

## Support

- **Fish Audio Docs:** https://docs.fish.audio
- **Discord:** Join Fish Audio community
- **Email:** support@fish.audio

---

**You're all set!** 🎉 

Get your API key and start generating natural AI voices.
