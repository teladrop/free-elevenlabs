# Deployment Guide - free-elevenlabs to Vercel

## Prerequisites
- GitHub account (free at github.com)
- Vercel account (free at vercel.com)

## Step 1: Create GitHub Repository ✅ DONE
Git repo is initialized locally.

## Step 2: Push to GitHub
### Option A: Using GitHub CLI (Recommended)
```bash
# Install GitHub CLI from https://cli.github.com/
# Then run:
gh repo create free-elevenlabs --public --source=. --remote=origin --push
```

### Option B: Manual GitHub Push
1. Go to github.com and create new repo named `free-elevenlabs`
2. Copy the repo URL (e.g., `https://github.com/YOUR_USERNAME/free-elevenlabs.git`)
3. Run:
```bash
cd "c:\Users\VICTOR FX\Desktop\free-elevenlabs"
git remote add origin https://github.com/YOUR_USERNAME/free-elevenlabs.git
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel
1. Go to vercel.com
2. Sign up / Log in with GitHub
3. Click "Import Project"
4. Select the `free-elevenlabs` repository
5. Click "Deploy" (default settings work fine)

**Wait 2-3 minutes for build...**

## Step 4: Test Live App
Your app will be live at: `https://free-elevenlabs-RANDOM.vercel.app`

- Click "Preview Voice" → should play demo sine wave
- Click "Generate Speech" → should generate demo audio
- With internet on Vercel server, Kokoro will download and real TTS works!

## Features
- ✅ 28 voices (American/British male/female)
- ✅ AI script parser (emotion detection, pause injection)
- ✅ Speed/pitch/volume controls
- ✅ Voice preview
- ✅ History storage (browser LocalStorage)
- ✅ Server-side Kokoro TTS (when internet available)
- ✅ Demo fallback (sine wave when offline)

## Notes
- First request takes ~30-60s (downloading 82M Kokoro model)
- Subsequent requests are instant (cached)
- Uses 28 premium voices from ElevenLabs voice library
- 10,000 word limit per generation
- All processing 100% local (no cloud processing fees)
