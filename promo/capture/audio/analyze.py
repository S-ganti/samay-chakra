#!/usr/bin/env python3
"""Convert raw float32 captures to 48 kHz stereo 16-bit WAV, analyse them, write promo/audio/manifest.json + analysis.json."""
import json, os, re, subprocess, sys
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', 'audio'))
SR = 48000
DESC = {
 'a_enter':     'Ch1 Enter the Ring, 19:30, Raga Yaman, 108 BPM. Organic downtempo: half-time kick, sub bass, shaker, flute lead, tabla, bells; torch crackle and dusk birds under it. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_gathering': 'Ch2 The Gathering, 22:30, Raga Bihag, 128 BPM. Hypnotic techno: four-on-the-floor kick, rolling bass, offbeat open hats, claps, filtered chord stabs; torch crackle. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_eclipse':   'Ch3 Eclipse, 01:30, Raga Malkauns, 144 BPM. Forest psytrance: kick plus off-beat bass, 16th hats, acid lead, crickets and a far owl. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_brahma':    'Ch4 Brahma Muhurta, 04:30, Raga Lalit, engine clock 72 BPM (beatless). Tanpura drone, wide pad, slow flute and bells; crickets, far owl, temple bell. No drum onsets, so bpm is the engine step clock. Hard edges: fade in/out.',
 'a_diamond':   'Ch5 Diamond Ring, 07:30, Raga Bhairav, 138 BPM. Progressive psytrance sunrise peak: four-on-the-floor, 16th bass, plucked arpeggio lead, bells, claps, 16th hats; songbirds and koel on top. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_dispersal': 'Ch6 Dispersal, 10:30, Raga Todi, 96 BPM. Broken-beat downtempo: syncopated kick, sub bass, shaker, tabla, Rhodes lead; daytime birds, crows and far horns. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_zero':      'Ch7 Zero Point, 13:30, Raga Bhimpalasi, 104 BPM. Dub: sparse kick/bass/hats, santoor lead, long delay and reverb; midday ambience (far horns, crows). Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_return':    'Ch8 The Return, 16:30, Raga Marwa, 116 BPM. Four-on-the-floor with off-beat bass and hats, sarangi lead, tabla, claps; late-afternoon birds, crows, far horns. Cut on the bar-1 downbeat (hard edges: fade in/out).',
 'a_bed_long':  '100 s continuous steady high-energy bed: Diamond Ring (Raga Bhairav, 138 BPM, 07:30), four-on-the-floor psytrance with 16th bass, pluck lead, bells; light dawn birds. 50 bars, no tempo drift. Cut on the bar-1 downbeat (hard edges: fade in/out).',
}
NOMINAL = {'a_enter':108,'a_gathering':128,'a_eclipse':144,'a_brahma':72,'a_diamond':138,'a_dispersal':96,'a_zero':104,'a_return':116,'a_bed_long':138}

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)

def to_wav(name):
    src = os.path.join(RAW, name + '.f32'); dst = os.path.join(OUT, name + '.wav')
    r = run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','f32le','-ar',str(SR),'-ac','2','-i',src,'-c:a','pcm_s16le','-ar',str(SR),'-ac','2',dst])
    if r.returncode: raise RuntimeError(r.stderr)
    return dst

def loudness(wav):
    r = run(['ffmpeg','-hide_banner','-nostats','-i',wav,'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-'])
    j = json.loads(re.search(r'\{[^{}]*"input_i".*?\}', r.stderr, re.S).group(0))
    r2 = run(['ffmpeg','-hide_banner','-nostats','-i',wav,'-af','ebur128=peak=true','-f','null','-'])
    sm = r2.stderr.split('Summary:')[-1]
    g = lambda pat: float(re.search(pat, sm).group(1))
    return dict(lufs=g(r'I:\s+(-?[\d.]+) LUFS'), lra=g(r'LRA:\s+(-?[\d.]+) LU'), true_peak_db=g(r'Peak:\s+(-?[\d.]+) dBFS'), loudnorm_i=float(j['input_i']), loudnorm_tp=float(j['input_tp']))

def silences(wav, noise='-50dB', d=0.5):
    r = run(['ffmpeg','-hide_banner','-nostats','-i',wav,'-af',f'silencedetect=noise={noise}:d={d}','-f','null','-'])
    st = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    out = []
    for i, s in enumerate(st):
        out.append({'start': round(max(s,0),3), 'end': round(en[i],3) if i < len(en) else None})
    return out

def onset_env(x, lo=None, hi=None, nfft=1024, hop=256):
    f, t, Z = signal.stft(x, SR, nperseg=nfft, noverlap=nfft-hop, boundary=None, padded=False)
    M = np.log1p(np.abs(Z) * 30)
    sel = np.ones(len(f), bool)
    if lo is not None: sel &= f >= lo
    if hi is not None: sel &= f <= hi
    M = M[sel]
    flux = np.maximum(0, np.diff(M, axis=1)).sum(0)
    flux = np.concatenate([[0], flux])
    # remove slow trend
    k = max(3, int(0.2*SR/hop)); flux = np.maximum(0, flux - np.convolve(flux, np.ones(k)/k, 'same'))
    return flux, t  # t = frame centre times; frame i covers [t-nfft/2, t+nfft/2]

def bpm_and_phase(x):
    # kick-band + broadband envelope; comb-score over a fine BPM grid
    kick, t = onset_env(x, 35, 180, nfft=2048, hop=256)
    broad, _ = onset_env(x, 150, 9000, nfft=1024, hop=256)
    hopsec = 256/SR
    res = {}
    for label, env in (('kick', kick), ('broad', broad)):
        env = env / (env.max() + 1e-9)
        ac = np.correlate(env - env.mean(), env - env.mean(), 'full')[len(env)-1:]
        best = None
        for bpm in np.arange(60, 181, 0.05):
            P = 60/bpm/hopsec  # frames per beat
            n = int((len(env)-1)/P)
            idx = (np.arange(n)*P).round().astype(int)
            # phase search via folding
            sc, ph = 0, 0
            for p in range(0, int(P)+1, 1):
                ii = idx[idx+p < len(env)] + p
                s = env[ii].mean() if len(ii) else 0
                if s > sc: sc, ph = s, p
            if best is None or sc > best[0]: best = (sc, bpm, ph*hopsec)
        res[label] = best
    return res, kick, broad, t

KICKS = {'four': [0,4,8,12], 'half': [0,7,10], 'broken': [0,7,10,14], 'dub': [0,4,8,12], 'none': []}
KICKPAT = {'a_enter':'half','a_gathering':'four','a_eclipse':'four','a_brahma':'none','a_diamond':'four','a_dispersal':'broken','a_zero':'dub','a_return':'four','a_bed_long':'four'}

def kick_onsets(x, tempo, pat):
    """Locate each scheduled kick (sub-ms: first threshold crossing of the zero-phase low-passed signal) and compare with the engine's step grid."""
    sos = signal.butter(4, 120, 'low', fs=SR, output='sos'); lp = signal.sosfiltfilt(sos, x)
    sd = 60/tempo/4; nbar = int((len(x)/SR)/(sd*16))
    te, tm = [], []
    for bar in range(nbar):
        for q in KICKS[pat]:
            t0 = (bar*16+q)*sd
            if t0 + 0.12 > len(x)/SR: continue
            i0 = max(0, int((t0-0.012)*SR)); i1 = int((t0+0.035)*SR)
            seg = lp[i0:i1]
            if np.abs(seg).max() < 0.02: continue
            e = np.convolve(seg**2, np.ones(24)/24, 'same')   # 0.5 ms energy
            pk = int(np.argmax(e)); lo = float(e[:pk+1].min()); hi = float(e[pk])
            j = int(np.argmax(e > lo + 0.08*(hi-lo)))
            te.append(t0); tm.append((i0+j)/SR)
    return np.array(te), np.array(tm)

def kick_click_timing(x, tempo, pat):
    """Timing steadiness: cross-correlate every kick's 18 ms noise click (>2.5 kHz) with the first one; returns lags in ms (sub-sample)."""
    if pat == 'none': return None
    qs = [q for q in KICKS[pat] if q % 4 == 0 and q != 4 and q != 12][:2] or [0]   # kicks not masked by claps/hats
    hp = signal.sosfiltfilt(signal.butter(4, 2500, 'high', fs=SR, output='sos'), x)
    sd = 60/tempo/4; nb = int(len(x)/SR/(sd*16)) - 1
    pts = [(bar*16+q)*sd for bar in range(1, nb) for q in qs]
    if len(pts) < 6: return None
    def seg(t0): i = int(round(t0*SR)); return hp[i-int(0.004*SR):i+int(0.02*SR)]
    T = seg(pts[0]); T = T/np.linalg.norm(T); pad = int(0.004*SR); lags = []
    for t0 in pts:
        i = int(round(t0*SR)); sgm = hp[i-int(0.004*SR)-pad:i+int(0.02*SR)+pad]
        c = signal.correlate(sgm, T, mode='valid'); k = int(np.argmax(c))
        if 0 < k < len(c)-1:
            y0, y1, y2 = c[k-1], c[k], c[k+1]; k = k + 0.5*(y0-y2)/(y0-2*y1+y2)
        lags.append((k-pad)/SR*1000)
    return np.array(lags)

def analyse(name):
    wav = os.path.join(OUT, name + '.wav')
    f32 = np.fromfile(os.path.join(RAW, name + '.f32'), dtype='<f4').reshape(-1, 2)
    meta = json.load(open(os.path.join(RAW, name + '.json')))
    x = f32.mean(1).astype(np.float64)
    pk_float = float(np.abs(f32).max())
    clip_float = int((np.abs(f32) >= 0.9999).sum())
    import soundfile as sf
    w, sr = sf.read(wav, dtype='int16'); assert sr == SR and w.ndim == 2 and w.shape[1] == 2
    clip16 = int(((w == 32767) | (w == -32768)).sum())
    L = loudness(wav); sil = silences(wav)
    dur = len(w)/SR
    res, kick, broad, t = bpm_and_phase(x)
    nominal = NOMINAL[name]
    # engine truth: recording starts exactly on a bar downbeat of the step clock
    a = {}
    pat = KICKPAT[name]; tempo = meta['plan']['tempo']
    te = tm = np.array([])
    if pat != 'none':
        te, tm = kick_onsets(x, tempo, pat)
    lg = kick_click_timing(x, tempo, pat)
    if lg is not None:
        a['kick_click_timing_ms_std'] = float(lg.std()); a['kick_click_timing_ms_range'] = [float(lg.min()), float(lg.max())]; a['kick_click_count'] = int(len(lg))
    a['kicks_found'] = int(len(te))
    if len(te) > 8:
        dev = tm - te
        A = np.vstack([te, np.ones_like(te)]).T; slope, off = np.linalg.lstsq(A, tm, rcond=None)[0]
        resid = tm - (slope*te + off)
        a['kick_dev_median_ms'] = float(np.median(dev)*1000); a['kick_dev_min_ms'] = float(dev.min()*1000); a['kick_dev_max_ms'] = float(dev.max()*1000)
        a['kick_jitter_ms_std'] = float(np.std(resid)*1000); a['kick_jitter_ms_maxabs'] = float(np.abs(resid).max()*1000)
        a['fitted_bpm_from_kicks'] = float(tempo/slope); a['drift_ppm'] = float((slope-1)*1e6)
        a['first_kick_s'] = float(tm[0])
    a['comb_kick'] = dict(score=res['kick'][0], bpm=res['kick'][1], phase_s=res['kick'][2])
    a['comb_broad'] = dict(score=res['broad'][0], bpm=res['broad'][1], phase_s=res['broad'][2])
    a['engine_bpm'] = meta['plan']['tempo']
    has_kick = a['kicks_found'] > 8
    if has_kick: bpm = a['fitted_bpm_from_kicks']; src = 'kick-onset regression (independent of engine value)'; first_beat = 0.0; a['first_kick_detector_s'] = a['first_kick_s']   # recording is cut sample-exactly on the engine's bar-1 downbeat; detector value is biased by the sine kick's rise
    else: bpm = float(tempo); src = 'engine clock (beatless chapter, no drum onsets)'; first_beat = 0.0
    a['bpm_source'] = src
    a['dc_offset'] = float(f32.mean())
    a['rms_dbfs'] = float(20*np.log10(np.sqrt((f32.astype(np.float64)**2).mean())+1e-12))
    # ending/starting levels (click check at the cut points)
    a['first_sample_abs'] = float(np.abs(f32[:4]).max()); a['last_sample_abs'] = float(np.abs(f32[-4:]).max())
    # short-term loudness steadiness
    r = run(['ffmpeg','-hide_banner','-nostats','-i',wav,'-af','ebur128=peak=true','-f','null','-'])
    ts = [(float(m.group(1)), float(m.group(2))) for m in re.finditer(r't:\s*([\d.]+)\s+TARGET:-23 LUFS\s+M:\s*-?[\d.]+\s+S:\s*(-?[\d.]+)', r.stderr)]
    st = [v for tt, v in ts if tt >= 3.5 and v > -100]
    a['shortterm_lufs_min'] = min(st) if st else None; a['shortterm_lufs_max'] = max(st) if st else None
    ent = dict(file=name + '.wav', duration=round(dur, 3), lufs=round(L['lufs'], 1), true_peak_db=round(L['true_peak_db'], 1), bpm=round(bpm, 1), first_beat_offset_s=round(float(first_beat), 3), silences=sil, description=DESC[name])
    full = dict(entry=ent, loudness=L, clipping=dict(float_peak=pk_float, float_samples_ge_0dBFS=clip_float, int16_samples_at_full_scale=clip16), analysis=a,
                recording=dict(workletGaps=meta.get('workletGaps'), frames=meta['frames'], late_notes=meta['state1']['sched'], event_loop_lag=meta['state1']['lag'], wx=meta['state0']['wx'], weights=meta['state0']['w'], clock_h=[meta['state0']['t'], meta['state1']['t']], tempo_samples=sorted(set(s['tempo'] for s in meta['samples']))))
    return full

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = [n for n in NOMINAL if os.path.exists(os.path.join(RAW, n + '.f32'))]
    if len(sys.argv) > 1: names = [n for n in names if n in sys.argv[1:]]
    fulls = []
    for n in names:
        to_wav(n); f = analyse(n); fulls.append(f)
        e = f['entry']; a = f['analysis']
        print(f"{n}: {e['duration']}s LUFS {e['lufs']} TP {e['true_peak_db']} BPM {e['bpm']} (nom {NOMINAL[n]}, {a['bpm_source']}) beat0 {e['first_beat_offset_s']} sil {len(e['silences'])} clip16 {f['clipping']['int16_samples_at_full_scale']} floatpk {f['clipping']['float_peak']:.3f} click-jitter {a.get('kick_click_timing_ms_std')} st-LUFS {a.get('shortterm_lufs_min')}..{a.get('shortterm_lufs_max')}")
    json.dump({'files': [f['entry'] for f in fulls]}, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump(fulls, open(os.path.join(HERE, 'analysis.json'), 'w'), indent=1, ensure_ascii=False)
