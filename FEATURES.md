# Complete Feature Reference

## 🎙️ Voice Selection (28 Premium Voices)

### American Female Voices (11)
- **af_heart** ❤️ - Premium, emotional and warm
- **af_bella** 🔥 - Premium, dynamic and expressive
- **af_nicole** 🎧 - Professional, studio quality
- af_alloy, af_aoede, af_jessica, af_kore, af_nova, af_river, af_sarah, af_sky

### American Male Voices (9)
- **am_adam** - Premium, natural and clear
- **am_fenrir** - Deep and authoritative
- **am_michael** - Warm and friendly
- am_puck, am_echo, am_eric, am_liam, am_onyx, am_santa

### British Female Voices (4)
- **bf_emma** 👔 - Professional and polished
- bf_alice, bf_isabella, bf_lily

### British Male Voices (4)
- bm_george, bm_fable, bm_lewis, bm_daniel

---

## ⚙️ Control Sliders

### Speed Control (0.5x - 2.0x)
- **0.5x**: Slow, deliberate speech (audiobooks, children's stories)
- **1.0x**: Natural conversational speed (default)
- **1.5x**: Faster pace (presentations, summaries)
- **2.0x**: Maximum speed (note-taking, fast reviews)

### Pitch Control (0.5 - 2.0)
- **0.5**: Lower, deeper tone
- **1.0**: Natural voice tone (default)
- **2.0**: Higher, lighter tone
- *Note: Cosmetic adjustment—real emotion comes from expressive tags*

### Volume Control (0% - 100%)
- **0%**: Silent (debugging)
- **50%**: Standard listening level
- **100%**: Maximum (amplified output)

---

## 🎭 Expressive Tags

Add emotional variation to your speech by embedding these tags:

### Emotion Tags
```
[laughter]  - Laughing variation
[gasp]      - Gasping surprise
[whisper]   - Whispered tone
[shout]     - Shouted/emphasized
[sigh]      - Sighing resignation
[cry]       - Crying/sadness
[chuckle]   - Soft laughter
```

### Real-World Examples

**Dramatic Moment:**
```
She opened the box and gasped [gasp]. Inside was everything she'd ever wanted.
```

**Dialogue:**
```
"You're joking [laughter]! That's absolutely hilarious!"
```

**Intimate Moment:**
```
[whisper] I've been waiting for this moment for so long...
```

---

## ⏸ Natural Pauses

Pauses are automatically inserted at these markers:

### Pause Types
| Marker | Duration | Use Case |
|--------|----------|----------|
| `...` | 300ms | Dramatic pauses, trailing thoughts |
| `—` | 200ms | Em-dash breaks, topic transitions |
| `,,` | 150ms | Short breath, list continuations |

### Examples

**Dramatic Buildup:**
```
The secret was... right there all along.
```
→ Creates tension with a 300ms silence

**Conversational Break:**
```
First point — then second point — and finally...
```
→ Natural rhythm with 200ms pauses

---

## 📝 Long-Form Processing

### Supported Limits
- **Maximum**: 15,000 words (~60 minutes of audio)
- **Automatic chunking**: 250 words per chunk
- **Smart splitting**: On sentence boundaries (not mid-word)

### Processing Example
```
Input: 5,000-word document
    ↓
Chunks: 20 chunks × 250 words each
    ↓
Batches: 7 parallel batches of 3
    ↓
Time: ~45 seconds (with WebGPU)
    ↓
Output: Single seamless .wav file
```

### Memory Efficiency
- No temporary files created
- All processing in browser RAM
- Audio automatically garbage collected after stitching
- Maximum memory footprint: ~100MB

---

## 🎬 Audio Player

### Playback Controls
- **Play/Pause**: Toggle audio playback
- **Download**: Save as .wav file
- **Scrub Bar**: Click to seek position
- **Volume Control**: Browser native control

### Downloaded Files
- **Format**: WAV (16-bit PCM, mono)
- **Sample Rate**: 24 kHz
- **Size**: ~48 KB per minute
- **Filename**: `tts-{timestamp}.wav`

---

## 💾 Generation History

### Features
- **Auto-save**: Every generation saved automatically
- **Limit**: Last 50 generations stored
- **Persistent**: Stored in browser localStorage
- **Actions per item**:
  - Play: Replay audio instantly
  - Download: Save to disk
  - Delete: Remove from history

### History Metadata
Each saved item includes:
- Original text
- Voice used
- Speed setting
- Pitch setting
- Volume setting
- Timestamp
- Full audio (base64 encoded)

### Clearing History
Delete individual items by clicking the trash icon, or clear all by:
```javascript
// In browser console:
localStorage.removeItem('tts-history');
location.reload();
```

---

## 🗣️ Voice Cloning Tab

### Features
- **Record Option**: Capture 5-10 second reference sample via microphone
- **Upload Option**: Import existing .mp3, .wav, or .webm files
- **Live Playback**: Preview recorded/uploaded audio
- **Clear Button**: Discard and record/upload new sample

### How It Works (Backend Integration Ready)
1. Upload reference audio (your voice)
2. Extract voice characteristics (embeddings)
3. Use embeddings as "prompt" for custom voice synthesis
4. Generate speech with your unique voice characteristics

### Current Status
✅ UI fully implemented
⏳ Server-side voice extraction (ready for implementation)
🚀 Recommended backend: Voice cloning models (e.g., Faster-Whisper + embeddings)

---

## 🚀 Performance Features

### Acceleration Methods

#### WebGPU Mode (Modern Browsers)
- Automatic detection: Chrome 113+, Edge 113+, Firefox 121+ (coming)
- Backend: GPU-accelerated inference
- Precision: Full fp32 for maximum quality
- Speed: ~2-3x faster than WASM
- Status indicator: "⚡ WebGPU acceleration enabled"

#### WASM Mode (Universal Fallback)
- Threading: Multi-threaded via `navigator.hardwareConcurrency`
- Quantization: q8 (8-bit integer) for efficiency
- Memory: Optimized for lower-end hardware
- Compatibility: Works on any modern browser
- Status indicator: "⚙️ Multi-threaded WASM mode"

### Parallel Processing
- **Batch Size**: 3 chunks processed simultaneously
- **Benefit**: 2-2.5x speedup vs. sequential
- **Memory**: Constant ~50MB runtime overhead
- **Smart Scaling**: Automatically adjusts to CPU cores

---

## 🎯 Usage Workflows

### Workflow 1: Quick Audio Note
```
1. Paste text (100-200 words)
2. Select voice
3. Click "Generate Speech"
4. Listen/Download
⏱ Time: 3-5 seconds
```

### Workflow 2: Long Audiobook
```
1. Paste full chapter (5,000+ words)
2. Add emotional tags: [laughter], [gasp], [whisper]
3. Adjust speed for readability
4. Generate (shows progress "Processing chunk 15 of 40...")
5. Download complete .wav
6. Share or archive
⏱ Time: 30-60 seconds depending on length
```

### Workflow 3: Video Voiceover
```
1. Split script into scenes
2. Use different voices per character
3. Generate per-scene .wavs
4. Download all
5. Import into video editor
⏱ Time: 2-5 minutes for full script
```

### Workflow 4: Accessibility Conversion
```
1. Paste article/blog post
2. Choose clear voice (e.g., af_bella, bf_emma)
3. Adjust speed to 0.9x for clarity
4. Generate with natural pauses
5. Share accessible audio version
⏱ Time: 20-40 seconds for 2,000 words
```

---

## 📱 Compatibility

### Tested Platforms
- ✅ Windows 10/11 Chrome, Edge
- ✅ macOS Safari, Chrome, Firefox
- ✅ Linux Chrome, Firefox
- ✅ iOS Safari (WASM mode)
- ✅ Android Chrome
- ⏳ Android Firefox (slower)

### Browser Requirements
- **Minimum**: ES2020 (modern JavaScript)
- **Recommended**: WebGPU support for best performance
- **Audio**: Web Audio API support (standard)

---

## 🔐 Privacy & Security

### 100% Local Processing
✅ All TTS generation runs in YOUR browser
✅ No audio uploaded to servers
✅ No personal data collected
✅ Works completely offline (after model download)
✅ Text never sent anywhere

### Model Download
- ~80MB ONNX model (one-time download)
- Cached in browser for reuse
- No telemetry or tracking

---

## ⌨️ Keyboard Shortcuts (Future Enhancement)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Generate speech |
| `Space` | Play/pause |
| `Ctrl+S` | Save/download |
| `Ctrl+H` | Toggle history |

*Note: Currently implement via button clicks*

---

## 📊 Quality Tips

### Best Practices for Natural Sound
1. **Use proper punctuation** for natural pacing
2. **Add emotional tags** to critical moments
3. **Break long paragraphs** into 2-3 sentence chunks
4. **Test voices** (af_bella, af_heart, am_adam are premium quality)
5. **Set speed to 0.9-1.0x** for the most natural sound
6. **Use volume=1.0** for consistent levels

### What Works Best
✅ Novels and storytelling
✅ Articles and blog posts
✅ Audiobook narration
✅ Educational content
✅ Presentations and talks

### What to Avoid
❌ Fast poetry (poetry-specific tags would be needed)
❌ Heavy technical jargon (consider simplifying)
❌ Multiple languages in one text
❌ Extremely short texts (<50 words) - overhead not worth it

---

**Happy narrating! 🎙️**
