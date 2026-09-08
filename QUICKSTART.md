# Quick Start Guide

## 🚀 Get Started in 2 Minutes

### 1. Start the Development Server
```bash
npm run dev
```
Open http://localhost:3000 in your browser.

### 2. Wait for Model Download
- First load: ~80MB ONNX model downloads (~2-5 minutes on broadband)
- Status bar shows progress: "Loading Kokoro TTS model... (45%)"
- After download: "✓ Model ready" appears at top

### 3. Choose a Voice
```
Click "Premium Voices" tab (default)
↓
Select from dropdown: 28 voices available
(af_heart ❤️, af_bella 🔥, am_adam, etc.)
```

### 4. Paste or Type Text
```
Click the text area
↓
Paste any text (up to 15,000 words)
↓
See word count update live
```

### 5. Adjust Controls (Optional)
- **Speed**: 0.5x to 2.0x (default 1.0x)
- **Pitch**: 0.5 to 2.0 (cosmetic only)
- **Volume**: 0% to 100% (default 100%)

### 6. Generate Speech
```
Click "Generate Speech" button
↓
See progress: "Processing chunk 3 of 20..."
↓
Hear audio in player
```

### 7. Download or Share
```
Click Download button (🔻)
↓
File saves as: tts-{timestamp}.wav
↓
Ready to use anywhere
```

---

## 💡 Pro Tips

### Tip 1: Add Natural Pauses
```
❌ Bad:
"The answer is right here. Nobody expected it."

✅ Good:
"The answer is right here... Nobody expected it."
(adds 300ms pause for impact)
```

### Tip 2: Add Emotion
```
❌ Flat:
"I can't believe it! That's amazing!"

✅ Expressive:
"I can't believe it [gasp]! That's [laughter] amazing!"
(adds emotional variation)
```

### Tip 3: Choose Quality Voices
**Premium voices (best quality):**
- af_heart ❤️ (emotional female)
- af_bella 🔥 (energetic female)
- am_adam (confident male)
- bf_emma 👔 (professional female)
- bf_emma (professional female)

### Tip 4: Adjust Speed for Content
- **0.7x**: Audiobooks, dramatic readings
- **1.0x**: Default, conversational (best for most)
- **1.3x**: Presentations, lectures
- **1.8x**: Fast reviews, skimming

### Tip 5: Use History for Retakes
```
Don't like the result? History saves it anyway.
Try different voice/speed without re-generating text.
(History panel: top right → click "History")
```

---

## 🎬 Common Tasks

### Task: Convert Article to Podcast
```
1. Copy article text (1,000-3,000 words)
2. Paste into text area
3. Select voice: af_bella or bf_emma (clear, professional)
4. Set speed: 0.95x (slightly slower for readability)
5. Generate
6. Download
7. Add to podcast app or audio player
⏱ Time: ~20 seconds + download
```

### Task: Create Audiobook Chapter
```
1. Paste chapter text (5,000-8,000 words)
2. Add emotional tags: [laughter], [gasp], etc.
3. Use pauses: Replace important "..." with ellipses
4. Select voice: af_heart or am_adam (narrative quality)
5. Generate (shows "Processing chunk 15 of 32...")
6. Download complete chapter
7. Chain chapters together with simple audio editor
⏱ Time: 45 seconds per chapter
```

### Task: Voiceover for Video
```
1. Write video script (one scene = ~200 words)
2. Generate audio for scene 1
3. Download (save as "scene-1.wav")
4. Repeat for each scene
5. Import into video editor (Premiere, DaVinci, CapCut, etc.)
6. Sync to video
7. Done!
⏱ Time: 2-3 minutes for 10-minute video
```

### Task: Save Voice for Brand
```
1. Choose "your" voice (e.g., af_bella for female brand)
2. Always use same voice + speed (e.g., 1.0x)
3. Save all outputs (auto-saves in History)
4. Download collection for internal use
5. Consistent voice across all audio content
✅ Creates brand identity through voice
```

---

## 🛠️ Troubleshooting

### Issue: Model Stuck Loading
```
❌ Problem: Progress bar frozen at 45% for 5+ minutes
✅ Solution:
  1. Open DevTools (F12)
  2. Check Console for errors
  3. Clear browser cache: Settings → Clear browsing data
  4. Refresh page (Ctrl+Shift+R, force refresh)
  5. Try in Incognito window to rule out extensions
```

### Issue: No Audio Playing
```
❌ Problem: Generated but player is silent
✅ Solution:
  1. Check browser volume (not muted 🔇)
  2. Check tab volume (macOS/Chrome detail)
  3. Check volume slider in app (should be >50%)
  4. Try downloading + playing with desktop player
  5. Check browser console for audio errors
```

### Issue: Generation Takes Too Long
```
❌ Problem: "Processing chunk 1 of 50..." stuck for 30s+
✅ Solution:
  1. Check browser task manager (too many tabs?)
  2. Close other CPU-intensive applications
  3. Try WebGPU browser (Chrome 113+, Edge 113+)
  4. If on older browser: try smaller batch sizes
  5. Reduce text length and test
```

### Issue: Emotional Tags Not Working
```
❌ Tags appear in output:
  "I said [laughter] hello"

✅ Solution:
  1. Tags are case-sensitive: use lowercase [laughter]
  2. Remove spaces: [laughter] not [ laughter ]
  3. Supported tags:
     [laughter], [gasp], [whisper], [shout], [sigh], [cry], [chuckle]
  4. For unsupported emotions, use pause markers instead:
     "Wait... [pause 500ms]" → just use ellipses "Wait..."
```

### Issue: Voice Clone Tab Not Working
```
Status: Voice cloning UI ready, backend not yet implemented
✅ To add voice cloning:
  1. Implement server-side voice feature extraction
  2. Use Whisper or similar for embedding extraction
  3. Pass embeddings to TTS model as "prompt"
  4. See OPTIMIZATIONS.md for architecture
```

---

## 📈 Performance Expectations

### Timeline by Text Length

| Length | Words | Chunks | Est. Time |
|--------|-------|--------|-----------|
| Tweet | 50 | 1 | 1-2s |
| News Article | 500 | 2 | 3-5s |
| Blog Post | 2,000 | 8 | 12-18s |
| Short Story | 5,000 | 20 | 30-45s |
| Novel Chapter | 8,000 | 32 | 48-72s |
| Full Book | 50,000 | 200 | 5-8 min |
| **Long Script** | **15,000** | **60** | **90-120s** |

**Note:** Times assume WebGPU. WASM mode 1.5-2x slower.

---

## 🎓 Learning Resources

### Documentation Files
- **FEATURES.md** — Complete feature reference
- **OPTIMIZATIONS.md** — Technical deep-dive into speed/quality optimizations
- **CLAUDE.md** — Original design specifications

### Code Structure
```
app/
├── page.tsx (1200 lines)
│   ├── Expressive pause injection
│   ├── Emotional tag extraction
│   ├── Text chunking utility
│   ├── Audio stitching (WAV encoding)
│   ├── Parallel batch processing
│   ├── WebGPU device selection
│   └── React UI components
│
next.config.ts
├── WASM/ONNX webpack rules
├── WebGPU async handling
└── Module fallbacks
```

---

## 💬 Tips for Best Results

### Write for Audio, Not Reading
❌ Don't write: "In conclusion, the aforementioned paradigm necessitates..."
✅ Write: "So, to sum up — this approach is better because..."

### Use Short Sentences
❌ Too long: "The company, which was founded in 1995 and has offices in twelve countries, announced today that..."
✅ Better: "Founded in 1995 with offices in 12 countries... the company announced something big today."

### Add Personality
❌ Bland: "This is a great feature."
✅ Engaging: "[laughter] This feature is absolutely amazing — you have to try it!"

### Break Up Dense Text
❌ Wall of text:
```
Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor 
incididunt ut labore et dolore magna aliqua...
```

✅ Better structure:
```
Let's dive in.

First point here — important context.
Second point here... pause for effect.
Final thought brings it home.
```

---

## 🚀 Next Steps

1. **Try it** — Load the app and generate your first audio
2. **Experiment** — Test different voices, speeds, and tags
3. **Integrate** — Add TTS to your projects (download .wav files)
4. **Share** — Create content others enjoy listening to
5. **Optimize** — Fine-tune voice choice and pacing for your audience

---

## 📞 Support

### Getting Help
- Check FEATURES.md for detailed feature info
- Review OPTIMIZATIONS.md for technical questions
- Check browser console (F12) for error messages
- Try Incognito mode to rule out extensions

### Report Issues
- Note browser + version (Chrome 120, Safari 17, etc.)
- Include error message from console
- Describe exact steps to reproduce
- Mention text length and complexity

---

**Happy creating! 🎙️**

*ElevenLabs TTS Clone powered by Kokoro (82M) • WebGPU-accelerated • 100% local processing*
