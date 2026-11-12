/* =========================================================================
   PLAYLIST — the listening room. A visitor pastes a YouTube or Spotify link and it plays in that service's own
   player, docked over the world. Nothing is loaded from either service until a link is given.
   The players are other sites' frames: the page cannot hear them, so the world does not move to their beat, and while
   one is loaded the raga engine steps back (the sounds of the hour stay).
   ========================================================================= */
// the event's own playlist: put a YouTube or Spotify link here and it is offered to every visitor. A link can also carry one: ?list=<link>
const EVENT_PLAYLIST = '';
const PL = { url: '', kind: '', genWas: null };
// turn a pasted link into the service's embed address, or null. Only ids of the documented shapes are accepted, and the
// address is always rebuilt from the id, so nothing else from the pasted text reaches the frame
function playlistEmbed(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch (e) { return null; }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, ''), id = (s, re) => (s && re.test(s) ? s : null);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    const list = id(u.searchParams.get('list'), /^[A-Za-z0-9_-]{10,64}$/);
    let v = host === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || (u.pathname.match(/^\/(?:embed|live|shorts)\/([^/?]+)/) || [])[1];
    v = id(v, /^[A-Za-z0-9_-]{11}$/);
    if (!list && !v) return null;
    return { kind: 'youtube', h: 200, src: 'https://www.youtube-nocookie.com/embed/' + (v || 'videoseries') + (list ? '?list=' + list + '&' : '?') + 'rel=0&playsinline=1' };
  }
  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{22})/);
    if (!m) return null;
    return { kind: 'spotify', h: m[1] === 'track' || m[1] === 'episode' ? 152 : 352, src: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] + '?theme=0' };
  }
  return null;
}
function playlistLoad(raw, quiet) {
  const e = playlistEmbed(raw), box = $('plFrame');
  if (!e) { if (!quiet) toast('That is not a YouTube or Spotify link. Paste the address of a playlist, album or video.', 4200); return false; }
  box.textContent = '';
  const f = document.createElement('iframe');
  f.src = e.src; f.title = e.kind === 'youtube' ? 'YouTube player' : 'Spotify player'; f.height = String(e.h); f.loading = 'lazy';
  f.allow = 'autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture'; f.referrerPolicy = 'strict-origin-when-cross-origin';
  box.appendChild(f); $('plist').classList.add('has');
  PL.url = String(raw).trim(); PL.kind = e.kind;
  try { localStorage.setItem('samay.playlist', PL.url); } catch (x) { }
  // the raga engine steps back while a playlist is loaded
  if (PL.genWas === null) PL.genWas = PARAM.gen;
  PARAM.gen = 0; $('rGen').value = 0; $('oGen').textContent = '0%';
  $('plNote').textContent = e.kind === 'spotify' ? 'Press play in the Spotify player. Spotify decides what plays: full tracks if you are signed in there, otherwise previews.' : 'Press play in the YouTube player.';
  return true;
}
function playlistClear() {
  $('plFrame').textContent = ''; $('plist').classList.remove('has'); PL.url = ''; PL.kind = '';
  try { localStorage.removeItem('samay.playlist'); } catch (x) { }
  if (PL.genWas !== null) { PARAM.gen = PL.genWas || 1; $('rGen').value = PARAM.gen; $('oGen').textContent = Math.round(PARAM.gen * 100) + '%'; PL.genWas = null; }
  $('plNote').textContent = 'The raga of the hour is playing again.';
}
function setupPlaylist() {
  const card = $('plist'), b = $('bList'), inp = $('plUrl');
  const open = (on) => { card.classList.toggle('open', on); b.classList.toggle('on', on); b.setAttribute('aria-expanded', String(on)); if (on && !PL.url) inp.focus(); };
  b.onclick = () => open(!card.classList.contains('open'));
  $('plClose').onclick = () => open(false);
  $('plForm').addEventListener('submit', (e) => { e.preventDefault(); if (playlistLoad(inp.value)) inp.value = ''; });
  $('plBack').onclick = playlistClear;
  // keys typed in the field are not world shortcuts
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  let saved = ''; try { saved = new URLSearchParams(location.search).get('list') || localStorage.getItem('samay.playlist') || ''; } catch (x) { }
  const first = saved || EVENT_PLAYLIST;
  if (first && playlistEmbed(first)) { inp.value = first; $('plNote').textContent = 'A playlist is ready. Press Load to bring in its player.'; }
}
