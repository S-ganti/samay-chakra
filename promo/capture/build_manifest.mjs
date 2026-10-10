// Builds promo/footage/manifest.json (ffprobe + capture meta + notes.json) and contact_sheet.jpg (mid-frame tiles).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const FOOT = path.resolve(new URL('../footage', import.meta.url).pathname);
const notes = fs.existsSync(path.join(FOOT, 'notes.json')) ? JSON.parse(fs.readFileSync(path.join(FOOT, 'notes.json'), 'utf8')) : {};
const probe = (f) => {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames,codec_name,pix_fmt:format=duration', '-of', 'json', f]).toString());
  const s = j.streams[0]; const [a, b] = s.r_frame_rate.split('/').map(Number);
  return { width: s.width, height: s.height, fps: a / b, frames: +s.nb_read_frames, duration: +(+j.format.duration).toFixed(3), codec: s.codec_name, pix_fmt: s.pix_fmt };
};
const files = fs.readdirSync(FOOT).filter(f => f.endsWith('.mp4')).sort();
const out = { generated: new Date().toISOString(), captureNotes: notes._global || {}, files: {} };
const mids = [];
for (const f of files) {
  const name = f.replace(/\.mp4$/, ''), p = probe(path.join(FOOT, f));
  const mf = path.join(FOOT, 'meta', name + '.json'), meta = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  const n = notes[name] || {};
  out.files[name] = { file: f, ...p, quality: meta.quality || 'med', style: meta.style || 'real', hourStart: meta.hourStart !== undefined ? +meta.hourStart.toFixed(2) : undefined, hourEnd: meta.hourEnd !== undefined ? +meta.hourEnd.toFixed(2) : undefined,
    renderedAt: meta.renderFps ? `${meta.renderFps} fps, motion-interpolated (${meta.interpolated}) to 30 fps` : '30 fps, every frame rendered', description: n.description || meta.desc || '', cameraCuts: n.cameraCuts !== undefined ? n.cameraCuts : (meta.cuts && meta.cuts.length ? meta.cuts : 'none'), shotNames: meta.shots, bestStart: n.bestStart, issues: n.issues || undefined };
  const mid = path.join('/tmp/claude-0', `mid_${name}.png`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(p.duration / 2), '-i', path.join(FOOT, f), '-frames:v', '1', '-vf', 'scale=360:360', mid]);
  mids.push({ name, mid });
}
for (const f of fs.readdirSync(FOOT).filter(f => f.endsWith('.png'))) { const name = f.replace(/\.png$/, ''); const im = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(FOOT, f)]).toString().trim().split(','); out.files[name] = { file: f, width: +im[0], height: +im[1], type: 'still', description: (notes[name] || {}).description || '' }; }
fs.writeFileSync(path.join(FOOT, 'manifest.json'), JSON.stringify(out, null, 2));
// contact sheet: 6 columns, labelled
const cols = 6, rows = Math.ceil(mids.length / cols);
const args = ['-y', '-loglevel', 'error']; mids.forEach(m => args.push('-i', m.mid));
const lab = mids.map((m, i) => `[${i}:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${m.name}':fontsize=15:fontcolor=white:box=1:boxcolor=black@0.6:x=6:y=6[l${i}]`).join(';');
const lay = mids.map((_, i) => `${(i % cols) * 360}_${Math.floor(i / cols) * 360}`).join('|');
args.push('-filter_complex', `${lab};${mids.map((_, i) => `[l${i}]`).join('')}xstack=inputs=${mids.length}:layout=${lay}:fill=black[o]`, '-map', '[o]', '-frames:v', '1', '-q:v', '3', path.join(FOOT, 'contact_sheet.jpg'));
execFileSync('ffmpeg', args);
console.log('manifest + contact sheet written;', mids.length, 'clips');
