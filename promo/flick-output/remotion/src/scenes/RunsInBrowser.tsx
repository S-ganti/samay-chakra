import type {CSSProperties, FC, ReactNode} from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, tracked} from '../lib/tokens';
import {easeInOut, ramp} from '../lib/motion';
import {useFormat} from '../lib/format';
import {RingDial} from '../lib/RingDial';
import {Grain} from '../lib/Footage';
import {WipeLine} from '../lib/Type';
import {Sfx, URL_TEXT} from './c_common';

// Frames into ui_{v,h}_dial_scrub.mp4 to start from (set from the capture manifest).
const VIDEO_START = 0;

const TYPE_A = 6; // address bar starts typing
const TYPE_B = 58; // last character lands
const ENTER = TYPE_B + 4; // Enter: click sfx + load hairline
const EXIT = 32; // frames at the end spent zooming out / dissolving to ink

/** Minimal browser chrome in the site's ink/hairline language. Not a mock of any real browser. */
const Browser: FC<{
  w: number; vpH: number; mobile: boolean; typed: string; caret: boolean; load: number; children: ReactNode; style?: CSSProperties;
}> = ({w, vpH, mobile, typed, caret, load, children, style}) => {
  const barH = mobile ? 92 : 56;
  const pillH = mobile ? 58 : 34;
  const fs = mobile ? 28 : 19;
  const icon = mobile ? 30 : 20;
  return (
    <div style={{width: w, height: barH + vpH, borderRadius: mobile ? 46 : 18, overflow: 'hidden', background: C.ink2,
      border: `1.5px solid ${C.hair2}`, boxShadow: '0 40px 120px rgba(0,0,0,.65), 0 0 0 1px rgba(15,13,11,.8)', position: 'relative', ...style}}>
      <div style={{height: barH, display: 'flex', alignItems: 'center', padding: mobile ? '0 22px' : '0 18px', gap: mobile ? 0 : 18, borderBottom: `1px solid ${C.hair}`, position: 'relative'}}>
        <div style={{flex: 1, height: pillH, borderRadius: pillH / 2, border: `1px solid ${C.hair}`, background: 'rgba(237,227,209,.05)',
          display: 'flex', alignItems: 'center', padding: `0 ${pillH * 0.4}px`, gap: pillH * 0.3, ...(mobile ? {} : {maxWidth: w * 0.62, margin: '0 auto'})}}>
          <RingDial size={icon} draw={1} spokes={1} color={C.ember} arcWidth={4} />
          <div style={{fontFamily: FONT.sans, fontWeight: 400, fontSize: fs, letterSpacing: '0.03em', color: C.bone, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center'}}>
            {typed}
            <span style={{display: 'inline-block', width: 2, height: fs * 1.05, marginLeft: 3, background: C.ember, opacity: caret ? 1 : 0}} />
          </div>
        </div>
        {/* load hairline along the bar's lower edge */}
        <div style={{position: 'absolute', left: 0, bottom: -1, height: 2, width: `${Math.min(1, load * 1.05) * 100}%`, background: C.ember, opacity: load > 0 && load < 1 ? 1 : 0}} />
      </div>
      <div style={{width: w, height: vpH, position: 'relative', background: C.ink}}>{children}</div>
    </div>
  );
};

const Struck: FC<{at: number; children: ReactNode; weight: number}> = ({at, children, weight}) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 7);
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <span style={{position: 'absolute', left: '-4%', top: '53%', height: weight, width: `${108 * p}%`, background: C.sindoor, boxShadow: `0 0 14px ${C.sindoor}`}} />
    </span>
  );
};

export const RunsInBrowser: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames: dur} = useVideoConfig();
  const {v, u, width, height} = useFormat();

  const nChars = Math.round(URL_TEXT.length * ramp(frame, TYPE_A, TYPE_B, (t) => t));
  const typed = URL_TEXT.slice(0, nChars);
  const typing = frame >= TYPE_A && frame < ENTER;
  const caret = frame < ENTER + 6 && (typing || Math.floor(frame / 7) % 2 === 0);
  const load = ramp(frame, ENTER, ENTER + 16, easeInOut);

  const exit = ramp(frame, dur - EXIT, dur, easeInOut);
  const textOut = ramp(frame, dur - EXIT, dur - EXIT + 14, easeInOut);

  // browser geometry
  const bw = v ? 580 : 1180;
  const barH = v ? 92 : 56;
  const vpH = Math.round(v ? (bw * 16) / 9 : (bw * 9) / 16);
  const bx = v ? (width - bw) / 2 : width - bw - 80;
  const by = v ? 520 : (height - (barH + vpH)) / 2;
  const scale = 1 - 0.14 * exit;

  const tLine = (size: number): CSSProperties => ({...tracked(size, 0.34, 500), color: C.bone, whiteSpace: 'nowrap'});
  const s1 = (v ? 46 : 38) * u;
  const s3 = (v ? 64 : 50) * u;
  const textBox: CSSProperties = v
    ? {position: 'absolute', left: 0, right: 0, top: 190, textAlign: 'center'}
    : {position: 'absolute', left: 120, top: 0, bottom: 0, width: bx - 120 - 40, display: 'flex', flexDirection: 'column', justifyContent: 'center'};

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Grain opacity={0.05} />
      <AbsoluteFill style={{background: `radial-gradient(ellipse at ${((bx + bw / 2) / width) * 100}% 50%, rgba(255,122,47,.07) 0%, rgba(255,122,47,0) 55%)`}} />

      <div style={{position: 'absolute', left: bx, top: by, transform: `scale(${scale})`, transformOrigin: '50% 50%', opacity: 1 - exit}}>
        <Browser w={bw} vpH={vpH} mobile={v} typed={typed} caret={caret} load={load}>
          <OffthreadVideo
            src={staticFile(`footage/ui_${v ? 'v' : 'h'}_dial_scrub.mp4`)}
            startFrom={VIDEO_START}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </Browser>
      </div>

      <div style={{...textBox, opacity: 1 - textOut}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: v ? 'center' : 'flex-start', gap: (v ? 14 : 12) * u}}>
          <WipeLine at={10} dur={12}>
            <div style={tLine(s1)}>No <Struck at={28} weight={Math.max(3, s1 * 0.09)}>app.</Struck></div>
          </WipeLine>
          <WipeLine at={36} dur={12}>
            <div style={tLine(s1)}>No <Struck at={54} weight={Math.max(3, s1 * 0.09)}>download.</Struck></div>
          </WipeLine>
          <div style={{height: (v ? 26 : 20) * u}} />
          <WipeLine at={70} dur={18}>
            <div style={{fontFamily: FONT.disp, fontSize: s3, letterSpacing: '0.12em', lineHeight: 1.2, color: C.bone, textTransform: 'uppercase',
              textAlign: v ? 'center' : 'left', textShadow: '0 2px 24px rgba(15,13,11,.55)'}}>
              It runs in<br />your browser.
            </div>
          </WipeLine>
        </div>
      </div>

      <Sfx file="Click.mp3" at={ENTER} db={-16} />
    </AbsoluteFill>
  );
};
