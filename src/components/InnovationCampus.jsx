import { useEffect, useRef } from 'react';
import './InnovationCampus.css';

// Decorative vector illustration, not a 3D engine. Detailed layered isometric
// campus with animated holographic elements; no animation runs in React renders.
const trees = [
  [88,473,.8],[110,502,.78],[142,438,.65],[158,536,.78],
  [206,574,.67],[474,548,.85],[536,482,.82],[567,512,1],
  [599,447,.7],[610,544,.8],
];
const stars = [
  [92,215,2],[118,258,2.7],[194,126,1.7],[291,103,2],
  [410,128,2.5],[548,180,2],[602,310,2.2],[579,400,2],
  [485,101,1.5],[240,375,1.5],[641,372,1.6],[72,388,1.7],
];

function CampusTree({x,y,s=1}) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="3" rx="17" ry="7" fill="#5963C0" opacity=".18"/>
    <path d="M-1 0v-35" stroke="#746E83" strokeWidth="3.3" strokeLinecap="round"/>
    <path d="M-16-32c-5-13 4-18 12-18 5-11 18-11 21-1 12 0 17 15 6 22-3 10-15 14-25 9-9 5-17-1-14-12Z" fill="url(#campus-tree)" stroke="#86B996" strokeWidth="1.5"/>
    <path d="M-9-39c12-12 21-8 27-2" stroke="#D3F3DC" strokeWidth="2" strokeLinecap="round" opacity=".65"/>
  </g>;
}

export default function InnovationCampus() {
  const sceneRef=useRef(null);
  useEffect(()=>{
    const scene=sceneRef.current;
    if(!scene)return;
    const host=scene.closest('.admin-login__visual')||scene;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer=window.matchMedia('(pointer: fine)');
    let frame=0;
    const move=event=>{
      if(motion.matches||document.hidden||!pointer.matches)return;
      const r=host.getBoundingClientRect();
      const x=(event.clientX-r.left)/Math.max(1,r.width)-.5;
      const y=(event.clientY-r.top)/Math.max(1,r.height)-.5;
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        scene.style.setProperty('--campus-x',`${(x*12).toFixed(1)}px`);
        scene.style.setProperty('--campus-y',`${(y*9).toFixed(1)}px`);
      });
    };
    const reset=()=>{cancelAnimationFrame(frame);scene.style.setProperty('--campus-x','0px');scene.style.setProperty('--campus-y','0px');};
    const visibility=()=>scene.classList.toggle('innovation-campus--paused',document.hidden);
    host.addEventListener('pointermove',move,{passive:true});
    host.addEventListener('pointerleave',reset);
    document.addEventListener('visibilitychange',visibility);
    visibility();
    return ()=>{
      cancelAnimationFrame(frame);
      host.removeEventListener('pointermove',move);
      host.removeEventListener('pointerleave',reset);
      document.removeEventListener('visibilitychange',visibility);
    };
  },[]);
  return <div className="innovation-campus" ref={sceneRef} aria-hidden="true">
    <div className="innovation-campus__aura"/>
    <svg viewBox="0 0 700 710" xmlns="http://www.w3.org/2000/svg" fill="none" focusable="false" className="innovation-campus__art">
      <defs>
        <linearGradient id="campus-metal" x1="68" y1="350" x2="630" y2="660" gradientUnits="userSpaceOnUse"><stop stopColor="#FBFEFF"/><stop offset=".24" stopColor="#C0E1FF"/><stop offset=".48" stopColor="#9DAAFB"/><stop offset=".67" stopColor="#EAF7FF"/><stop offset="1" stopColor="#8189E9"/></linearGradient>
        <linearGradient id="campus-side" x1="180" y1="530" x2="490" y2="642" gradientUnits="userSpaceOnUse"><stop stopColor="#9CA6E8"/><stop offset=".33" stopColor="#D1E5FF"/><stop offset=".61" stopColor="#777FCB"/><stop offset="1" stopColor="#D6EFFF"/></linearGradient>
        <linearGradient id="campus-panel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#A5F5FF" stopOpacity=".65"/><stop offset=".28" stopColor="#537FEA" stopOpacity=".84"/><stop offset=".68" stopColor="#455FCA" stopOpacity=".91"/><stop offset="1" stopColor="#C1B5FF" stopOpacity=".76"/></linearGradient>
        <linearGradient id="campus-panel-border" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FDFFFF"/><stop offset=".45" stopColor="#94CCFF"/><stop offset="1" stopColor="#9B7BF4"/></linearGradient>
        <linearGradient id="campus-stairs" x1="395" y1="470" x2="606" y2="639" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF"/><stop offset=".5" stopColor="#A5C4F4"/><stop offset="1" stopColor="#EAFFFF"/></linearGradient>
        <linearGradient id="campus-tree" x1="0" y1="-60" x2="20" y2="-17" gradientUnits="userSpaceOnUse"><stop stopColor="#B3EDC4"/><stop offset=".5" stopColor="#5BA58A"/><stop offset="1" stopColor="#43866C"/></linearGradient>
        <radialGradient id="campus-globe" cx=".36" cy=".24" r=".84"><stop stopColor="#EDFAFF"/><stop offset=".16" stopColor="#B5D9FF"/><stop offset=".38" stopColor="#5E98F9"/><stop offset=".63" stopColor="#445FE7"/><stop offset=".83" stopColor="#4435BE"/><stop offset="1" stopColor="#AB66FF"/></radialGradient>
        <radialGradient id="campus-globe-core"><stop stopColor="#FCFFFF" stopOpacity=".85"/><stop offset=".25" stopColor="#9FD9FF" stopOpacity=".44"/><stop offset=".7" stopColor="#796AE9" stopOpacity=".21"/><stop offset="1" stopColor="#8F86FF" stopOpacity="0"/></radialGradient>
        <radialGradient id="campus-beam"><stop stopColor="#E9FCFF" stopOpacity=".95"/><stop offset=".27" stopColor="#94BDFF" stopOpacity=".46"/><stop offset="1" stopColor="#A6BFFF" stopOpacity="0"/></radialGradient>
        <linearGradient id="campus-continents" x1="250" y1="192" x2="438" y2="398" gradientUnits="userSpaceOnUse"><stop stopColor="#F1FEFF" stopOpacity=".92"/><stop offset=".5" stopColor="#BDE7FF" stopOpacity=".88"/><stop offset="1" stopColor="#D6B8FF" stopOpacity=".86"/></linearGradient>
        <filter id="campus-shadow" x="-70%" y="-100%" width="240%" height="300%"><feGaussianBlur stdDeviation="17"/></filter>
        <filter id="campus-bloom" x="-90%" y="-90%" width="280%" height="280%"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="campus-glass-shadow" x="-45%" y="-45%" width="190%" height="190%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#647DE6" floodOpacity=".35"/></filter>
        <clipPath id="campus-world-clip"><circle cx="351" cy="283" r="102"/></clipPath>
      </defs>
      {/* Transparent hologram columns and supporting environment. */}
      <path d="M193 83 243 65v355l-50 18Z" fill="#9DABFB" opacity=".075"/>
      <path d="M477 34 536 17v396l-59 8Z" fill="#768BDF" opacity=".09"/>
      <path d="M547 0h56v421l-56 20Z" fill="#9BACEE" opacity=".08"/>
      <path d="M352 0h35v376l-35 15Z" fill="#879AF4" opacity=".08"/>
      <path d="M243 66v355M536 20v393M604 0v421" stroke="#F4FFFF" strokeOpacity=".45" strokeWidth="2"/>
      <g className="innovation-campus__particles">
        {stars.map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} fill={i%2?'#899DF9':'#C3A3FB'} opacity={.35+i%3*.16}/>)}
      </g>

      {/* Platform elevation: shadow, glass walls and triple luminous disk. */}
      <ellipse cx="354" cy="606" rx="288" ry="46" fill="#8096F1" opacity=".18" filter="url(#campus-shadow)"/>
      <path d="M67 490c0 78 129 156 289 156s285-72 285-153v-38c-32 74-142 110-285 110S99 536 67 455Z" fill="url(#campus-side)" stroke="#B8D6FF" strokeWidth="3"/>
      <path d="M70 496c18 74 140 135 284 135s267-59 285-132" stroke="#FCFDFF" strokeWidth="11" opacity=".75"/>
      <path d="M70 514c33 72 150 115 286 115 153 0 259-49 281-115" stroke="#7B6BEC" strokeWidth="8" opacity=".78"/>
      <path className="innovation-campus__light-strip" d="M73 519c38 80 151 119 282 119 138 0 242-47 282-118" stroke="#F1B8FF" strokeWidth="3.5" strokeDasharray="132 40 67 115" opacity=".9"/>
      <ellipse cx="354" cy="475" rx="288" ry="124" fill="url(#campus-metal)" stroke="#EDF9FF" strokeWidth="9" filter="url(#campus-glass-shadow)"/>
      <ellipse cx="354" cy="463" rx="259" ry="100" fill="#EEF9FF" fillOpacity=".68" stroke="#A4B4F8" strokeWidth="6"/>
      <ellipse cx="354" cy="460" rx="227" ry="79" fill="#C4DAFF" fillOpacity=".48" stroke="#F9FFFF" strokeWidth="8"/>
      <ellipse cx="354" cy="458" rx="193" ry="67" fill="#8FB8FD" fillOpacity=".28" stroke="#8196E7" strokeWidth="4"/>
      <ellipse cx="354" cy="455" rx="164" ry="54" fill="#E9F6FF" fillOpacity=".46" stroke="#E7FFFF" strokeWidth="7"/>
      <ellipse cx="354" cy="453" rx="140" ry="44" stroke="#A7A4FF" strokeWidth="8" opacity=".68"/>
      <ellipse cx="354" cy="451" rx="106" ry="34" fill="#B8D0FF" fillOpacity=".58" stroke="#F9FFFF" strokeWidth="7"/>
      <ellipse className="innovation-campus__halo" cx="354" cy="452" rx="78" ry="25" stroke="#7D55FA" strokeWidth="9" opacity=".85"/>
      <ellipse cx="354" cy="452" rx="55" ry="16" fill="#D8C3FF" opacity=".64" filter="url(#campus-bloom)"/>
      <ellipse cx="354" cy="452" rx="47" ry="14" stroke="#FFFFFF" strokeWidth="5" opacity=".8"/>
      <ellipse cx="354" cy="452" rx="21" ry="6" fill="#FFF" opacity=".95"/>

      {/* Orbiting network ribbons in the architecture. */}
      <g className="innovation-campus__platform-trail">
        <ellipse cx="354" cy="505" rx="298" ry="117" stroke="#BA90FF" strokeWidth="2.7" strokeOpacity=".65" strokeDasharray="200 75 95 138" transform="rotate(-4 354 505)"/>
        <ellipse cx="354" cy="486" rx="266" ry="97" stroke="#8DDCFF" strokeWidth="2" strokeOpacity=".8" strokeDasharray="110 320 200 190" transform="rotate(9 354 486)"/>
      </g>

      {/* Monolithic front display, mounted on the campus structure. */}
      <g filter="url(#campus-glass-shadow)">
        <path d="M187 458 287 469l9 126-111-33Z" fill="#A2C9FF" stroke="#F8FFFF" strokeWidth="5"/>
        <path d="M195 466 283 476l6 105-96-29Z" fill="#263E93" stroke="#B4D1FF" strokeWidth="3"/>
        <path d="M196 467 237 473 232 557 195 552Z" fill="#85B8F2" fillOpacity=".15"/>
        <g transform="matrix(1 .09 0 1 -2 -21)" fill="#F2FDFF" fontFamily="system-ui,sans-serif" fontWeight="750" fontSize="11.7" letterSpacing=".1">
          <text x="204" y="496">INNOVATE</text>
          <text x="204" y="515">LEARN</text>
          <text x="204" y="534" fontSize="11">COLLABORATE</text>
        </g>
      </g>

      {/* Campus's stepped approach with transparent railings. */}
      <g className="innovation-campus__stairs" filter="url(#campus-glass-shadow)">
        <path d="M422 476 465 487 599 623 549 606Z" fill="url(#campus-stairs)" stroke="#EAF9FF" strokeWidth="4"/>
        <path d="M464 486 481 479l141 126-23 18Z" fill="#A5C8FF" fillOpacity=".42" stroke="#E2F4FF" strokeWidth="3"/>
        <path d="M444 483 560 607M450 477 583 609" stroke="#FFF" strokeWidth="3.5" opacity=".64"/>
        {Array.from({length:12},(_,i)=>{
          const x=467+i*10, y=497+i*10.2;
          return <path key={i} d={`M${x} ${y}l-34 -10`} stroke="#849BDF" strokeWidth="2.3" opacity=".7"/>;
        })}
        <path d="M448 467 577 603M473 468 610 604" stroke="#F3FFFF" strokeWidth="2.3" opacity=".9"/>
        {Array.from({length:7},(_,i)=><path key={i} d={`M${456+i*18} ${468+i*18}v-14`} stroke="#D4F2FF" strokeWidth="2"/>)}
      </g>

      {/* Miniature trees and landscaping distributed around the platform. */}
      <g>{trees.map(([x,y,s],i)=><CampusTree key={i} x={x} y={y} s={s}/>)}</g>
      <g fill="#63B88E" opacity=".67">
        <ellipse cx="130" cy="505" rx="30" ry="8"/><ellipse cx="537" cy="501" rx="34" ry="8"/>
        <ellipse cx="164" cy="550" rx="25" ry="7"/><ellipse cx="590" cy="540" rx="24" ry="7"/>
      </g>

      {/* Holographic projection with real grid and illustrated continental silhouettes. */}
      <path d="M351 425 351 183" stroke="#ACCDFF" strokeWidth="23" strokeOpacity=".35" filter="url(#campus-bloom)"/>
      <ellipse cx="351" cy="298" rx="139" ry="139" fill="url(#campus-beam)" opacity=".46"/>
      <g className="innovation-campus__globe-float">
        <circle cx="351" cy="283" r="112" fill="#A4B2FF" opacity=".39" filter="url(#campus-bloom)"/>
        <circle cx="351" cy="283" r="103" fill="url(#campus-globe)" stroke="#CFF9FF" strokeWidth="4"/>
        <circle cx="351" cy="283" r="104" fill="url(#campus-globe-core)" opacity=".34"/>
        <g clipPath="url(#campus-world-clip)" className="innovation-campus__globe-grid">
          <g stroke="#D1F6FF" strokeOpacity=".57" strokeWidth="1.4">
            <ellipse cx="351" cy="283" rx="22" ry="105"/>
            <ellipse cx="351" cy="283" rx="50" ry="105"/>
            <ellipse cx="351" cy="283" rx="78" ry="105"/>
            <path d="M248 283h206"/>
            <ellipse cx="351" cy="283" rx="105" ry="30"/>
            <ellipse cx="351" cy="283" rx="104" ry="65"/>
          </g>
          <g className="innovation-campus__continents" fill="url(#campus-continents)" stroke="#F2FCFF" strokeWidth="1.1" strokeLinejoin="round" opacity=".92">
            {/* Europe, Asia and the Americas as distinct geographic silhouettes. */}
            <path d="m274 221 19-11 19 4 9 12 17 1 7 15-9 15-22 6-4 20-16 1-12-22-21-4-4-20Z"/>
            <path d="m326 219 21-9 20 6 11-8 20 9 25 8 7 18-13 19 9 14-17 17-12 17-20-4-7-15-18-11-17-19-18-2 2-19Z"/>
            <path d="m300 296 18-5 27 11 10 28-16 17-2 20-16 14-9-27-13-23-12-17Z"/>
            <path d="m386 309 21-4 16 9 4 20-10 18-17 7-14-23Z"/>
            <path d="m258 289 12-3 12 16-7 11-14-7Z"/>
            <path d="m429 290 12 4-3 17-15 5-3-10Z"/>
            <path d="m345 370 5-6 12 4 7 7-11 8Z"/>
          </g>
          <g stroke="#D4F8FF" strokeWidth=".9" opacity=".6" strokeDasharray="2 4">
            <path d="M265 242q85 28 173-1M252 315q102-34 199 4M280 354q77-20 144 11"/>
          </g>
        </g>
        <circle cx="351" cy="283" r="103" stroke="#E7FFFF" strokeOpacity=".82" strokeWidth="2.8"/>
        <path d="M296 205q50-46 112-1" stroke="#FFF" strokeWidth="5" strokeLinecap="round" opacity=".62"/>
        <circle cx="310" cy="235" r="72" fill="#FFF" opacity=".06"/>
      </g>
      <g className="innovation-campus__globe-orbits">
        <ellipse cx="351" cy="287" rx="178" ry="55" transform="rotate(-19 351 287)" stroke="#C7A4FF" strokeWidth="2.8" strokeDasharray="210 55 88 95" opacity=".75"/>
        <ellipse cx="351" cy="294" rx="200" ry="64" transform="rotate(20 351 294)" stroke="#9FE7FF" strokeWidth="2" strokeDasharray="140 220 130 140" opacity=".82"/>
        <ellipse cx="351" cy="284" rx="154" ry="43" transform="rotate(-2 351 284)" stroke="#F7FFFF" strokeWidth="2" strokeDasharray="175 120 65 115" opacity=".85"/>
        <circle cx="523" cy="253" r="5" fill="#FFF" stroke="#C4A7FF" strokeWidth="3"/>
        <circle cx="206" cy="321" r="4" fill="#C0EFFF"/>
      </g>

      {/* Four detached illuminated glass panels: collaboration, analytics, cloud, code. */}
      <g className="innovation-campus__panel innovation-campus__panel--people" filter="url(#campus-glass-shadow)">
        <rect x="151" y="161" width="102" height="91" rx="8" transform="skewY(-13)" fill="url(#campus-panel)" stroke="url(#campus-panel-border)" strokeWidth="2.8"/>
        <g transform="translate(151 -33) skewY(-13)" stroke="#F7FFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <rect x="27" y="200" width="52" height="45" rx="4" strokeOpacity=".75"/>
          <circle cx="46" cy="217" r="8"/><path d="M31 236c1-12 28-12 30 0"/>
          <path d="M64 225c6 0 10 4 12 9" opacity=".75"/>
        </g>
      </g>
      <g className="innovation-campus__panel innovation-campus__panel--analytics" filter="url(#campus-glass-shadow)">
        <rect x="469" y="100" width="113" height="82" rx="9" fill="url(#campus-panel)" stroke="url(#campus-panel-border)" strokeWidth="3"/>
        <g stroke="#F9FFFF" strokeLinecap="round" strokeWidth="3.2">
          <path d="M492 157v-28m0 28h69"/>
          <rect x="503" y="143" width="10" height="14" rx="2"/>
          <rect x="520" y="132" width="10" height="25" rx="2"/>
          <rect x="537" y="123" width="10" height="34" rx="2"/>
          <path d="m503 135 14-11 15 3 14-15" strokeWidth="2.3"/>
        </g>
      </g>
      <g className="innovation-campus__panel innovation-campus__panel--cloud" filter="url(#campus-glass-shadow)">
        <path d="m119 305 96 13v83l-96-23Z" fill="url(#campus-panel)" stroke="url(#campus-panel-border)" strokeWidth="3"/>
        <path d="M141 354c-3-11 3-19 14-21 6-14 26-11 30 3 14 0 18 19 5 23h-43c-8-1-10-3-6-5Z" stroke="#FAFFFF" strokeWidth="3.3" strokeLinejoin="round"/>
        <path d="M165 362v17m-8-8 8 8 8-8" stroke="#F9FFFF" strokeWidth="3" strokeLinecap="round"/>
      </g>
      <g className="innovation-campus__panel innovation-campus__panel--code" filter="url(#campus-glass-shadow)">
        <path d="m484 304 101-30v87l-101 32Z" fill="url(#campus-panel)" stroke="url(#campus-panel-border)" strokeWidth="3"/>
        <path d="m514 331-15 13 15 12m34-38 14 8-14 19m-9-26-11 36" stroke="#FAFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>

      {/* Ground sparkles and the projected luminous pulse. */}
      <circle className="innovation-campus__central-pulse" cx="354" cy="452" r="36" fill="url(#campus-beam)" opacity=".45"/>
      <g className="innovation-campus__particles" fill="#AAB7FF">
        <circle cx="148" cy="267" r="3"/><circle cx="547" cy="214" r="3"/>
        <circle cx="423" cy="153" r="2.5"/><circle cx="256" cy="155" r="2"/>
        <circle cx="560" cy="368" r="2"/><circle cx="112" cy="420" r="2"/>
      </g>
    </svg>
  </div>;
}
