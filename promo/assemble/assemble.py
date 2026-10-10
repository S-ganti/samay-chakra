#!/usr/bin/env python3
"""Assemble the Flick scene renders into the final 9:16 and 16:9 cuts with the site's raga as the soundtrack.

Flick renders each approved scene on its own (no all-scenes composition, no music). This script:
  1. concatenates the scene MP4s in transcript order (re-encoding once, so every cut is frame-exact);
  2. builds the music track from the per-prahar recordings: a bed under the opening and the closer, and in the
     montage each prahar's own raga, entered on its first downbeat so the cut lands on the beat;
  3. mixes the scenes' own sound effects over the music and normalises to -14 LUFS / -1 dBTP (platform loudness).

Usage: python3 assemble.py [v|h|both] [--first10]     (--first10 also exports the first 10 s of each cut)
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # promo/
FLICK = os.path.join(ROOT, 'flick-output')
AUDIO = os.path.join(ROOT, 'audio')
OUT = os.path.join(ROOT, 'out')
XF = 0.25  # music crossfade at each prahar cut, seconds (centred on the cut)
PRAHAR = ['enter', 'gathering', 'eclipse', 'brahma', 'diamond', 'dispersal', 'zero', 'return']


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stderr[-3000:]}")
    return r.stdout


def has_audio(path):
    return bool(run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path]).strip())


def duration(path):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))


def music_manifest():
    with open(os.path.join(AUDIO, 'manifest.json')) as f:
        m = json.load(f)
    # accept either {"files":[{"file":...}]} / [{"file":...}] / {"a_enter.wav": {...}}
    items = m.get('files', m) if isinstance(m, dict) else m
    if isinstance(items, dict):
        items = [dict(v, file=k) for k, v in items.items()]
    out = {}
    for it in items:
        name = os.path.splitext(os.path.basename(it.get('file') or it.get('name')))[0]
        off = it.get('first_beat_offset_s', it.get('firstBeatOffset', it.get('first_beat_s', 0))) or 0
        out[name] = {'path': os.path.join(AUDIO, name + '.wav'), 'beat': float(off), 'dur': float(it.get('duration', it.get('duration_s', 0)) or 0)}
    return out


def build(fmt, first10):
    with open(os.path.join(FLICK, 'transcript.json')) as f:
        t = json.load(f)
    segs = t['segments'] if fmt == 'v' else t['segments_16x9']
    tmp = tempfile.mkdtemp(prefix='assemble-')

    # 1. scenes → one picture + effects track; scenes without audio get matching silence
    inputs, fc, labels = [], [], []
    for i, s in enumerate(segs):
        p = os.path.join(FLICK, 'scenes', f"{s['id']}-{fmt}", f"{s['id']}-{fmt}.mp4")
        if not os.path.exists(p):
            sys.exit(f'missing scene render: {p}')
        want = s['end'] - s['start']
        got = duration(p)
        if abs(got - want) > 0.07:
            print(f"warning: {s['id']}-{fmt} is {got:.3f}s, transcript says {want:.3f}s")
        inputs += ['-i', p]
        fc.append(f'[{i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v{i}]')
        if has_audio(p):
            fc.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:{got:.4f},asetpts=PTS-STARTPTS[a{i}]')
        else:
            fc.append(f'anullsrc=r=48000:cl=stereo,atrim=0:{got:.4f}[a{i}]')
        labels.append(f'[v{i}][a{i}]')
    fc.append(''.join(labels) + f'concat=n={len(segs)}:v=1:a=1[v][sfx]')
    picture = os.path.join(tmp, 'picture.mkv')
    run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[sfx]',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-c:a', 'pcm_s16le', picture])
    total = duration(picture)

    # 2. music: bed until the montage, one raga per prahar, bed again for the closer
    m = music_manifest()
    bed = m.get('a_bed_long') or m.get('a_diamond')
    first = next(s for s in segs if s['id'] == 'prahar-enter')['start']
    last = next(s for s in segs if s['id'] == 'prahar-return')['end']
    parts = [('bed-open', bed, bed['beat'], 0.0, first)]
    for c in PRAHAR:
        s = next(x for x in segs if x['id'] == f'prahar-{c}')
        a = m[f'a_{c}']
        parts.append((c, a, a['beat'], s['start'], s['end']))
    # the closer continues the bed from where the opening left it (plus a bar), so it doesn't restart the same phrase
    parts.append(('bed-close', bed, bed['beat'] + first + 4.0, last, total))

    mi, mf, ml = [], [], []
    for k, (name, a, src_in, t0, t1) in enumerate(parts):
        # each piece overlaps its neighbours by XF/2 for the crossfade; pieces start on a downbeat at the cut
        pre = XF / 2 if k else 0.0
        post = XF / 2 if k < len(parts) - 1 else 0.0
        start_src = max(0.0, src_in - pre)
        length = (t1 - t0) + pre + post
        mi += ['-i', a['path']]
        fade_in = f'afade=t=in:st=0:d={XF:.3f},' if k else ''
        fade_out = f'afade=t=out:st={length - XF:.3f}:d={XF:.3f},' if k < len(parts) - 1 else ''
        mf.append(f'[{k}:a]atrim={start_src:.4f}:{start_src + length:.4f},asetpts=PTS-STARTPTS,aresample=48000,'
                  f'aformat=channel_layouts=stereo,{fade_in}{fade_out}adelay={int((t0 - pre) * 1000)}|{int((t0 - pre) * 1000)},apad[m{k}]')
        ml.append(f'[m{k}]')
    # the closer settles to -10 dB over the last 1.5 s rather than to silence, so the loop restart isn't abrupt
    mf.append(''.join(ml) + f'amix=inputs={len(parts)}:normalize=0,atrim=0:{total:.4f},'
              f'volume=enable=\'gte(t,{total - 1.5:.3f})\':volume=\'1-0.68*(t-{total - 1.5:.3f})/1.5\':eval=frame[music]')
    music = os.path.join(tmp, 'music.wav')
    run(['ffmpeg', '-y', *mi, '-filter_complex', ';'.join(mf), '-map', '[music]', music])

    # 3. effects over music, loudness-normalised
    os.makedirs(OUT, exist_ok=True)
    name = {'v': 'samay-chakra-teaser-9x16', 'h': 'samay-chakra-teaser-16x9'}[fmt]
    final = os.path.join(OUT, name + '.mp4')
    run(['ffmpeg', '-y', '-i', picture, '-i', music, '-filter_complex',
         '[1:a]volume=0.9[mu];[0:a]volume=1.0[fx];[mu][fx]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[a]',
         '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
         '-movflags', '+faststart', final])
    print(final, f'{duration(final):.2f}s')
    if first10:
        clip = os.path.join(OUT, name + '-first10s.mp4')
        run(['ffmpeg', '-y', '-i', final, '-t', '10', '-c:v', 'libx264', '-crf', '16', '-c:a', 'aac', '-b:a', '256k',
             '-movflags', '+faststart', clip])
        print(clip)


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'both'
    for fmt in (['v', 'h'] if which == 'both' else [which]):
        build(fmt, '--first10' in sys.argv)
