import { useEffect, useRef } from 'react';
import './InnovationPortal.css';

// Purely decorative, GPU-friendly SVG portal. No WebGL, network requests, or
// React frame loop; pointer parallax only adjusts two CSS transform variables.
export default function InnovationPortal() {
  const rootRef = useRef(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const section = node.closest('.admin-login__visual') || node;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    let raf = 0;

    const move = (event) => {
      if (media.matches || !finePointer.matches || document.hidden) return;
      const r = section.getBoundingClientRect();
      const x = (event.clientX - r.left) / Math.max(r.width, 1) - .5;
      const y = (event.clientY - r.top) / Math.max(r.height, 1) - .5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        node.style.setProperty('--portal-parallax-x', `${(x * 15).toFixed(1)}px`);
        node.style.setProperty('--portal-parallax-y', `${(y * 13).toFixed(1)}px`);
      });
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      node.style.setProperty('--portal-parallax-x', '0px');
      node.style.setProperty('--portal-parallax-y', '0px');
    };
    const visibility = () => node.classList.toggle('innovation-portal--paused', document.hidden);
    section.addEventListener('pointermove', move, { passive: true });
    section.addEventListener('pointerleave', reset);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener('pointermove', move);
      section.removeEventListener('pointerleave', reset);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  return (
    <div className="innovation-portal" ref={rootRef} aria-hidden="true">
      <div className="innovation-portal__ambient" />
      <svg className="innovation-portal__svg" viewBox="0 0 640 660" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          <linearGradient id="ip-glass" x1="143" y1="75" x2="505" y2="550" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E7FDFF" stopOpacity=".96"/>
            <stop offset=".14" stopColor="#6D9EF9" stopOpacity=".8"/>
            <stop offset=".36" stopColor="#D7E9FF" stopOpacity=".92"/>
            <stop offset=".52" stopColor="#5062E3" stopOpacity=".7"/>
            <stop offset=".7" stopColor="#CEAAFF" stopOpacity=".93"/>
            <stop offset=".88" stopColor="#74C7FF" stopOpacity=".84"/>
            <stop offset="1" stopColor="#FCFFFF" stopOpacity=".95"/>
          </linearGradient>
          <linearGradient id="ip-ring-fill" x1="180" y1="80" x2="433" y2="591" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A5D9FF" stopOpacity=".14"/>
            <stop offset=".35" stopColor="#7594F7" stopOpacity=".27"/>
            <stop offset=".63" stopColor="#8269E9" stopOpacity=".15"/>
            <stop offset="1" stopColor="#B3E8FF" stopOpacity=".36"/>
          </linearGradient>
          <linearGradient id="ip-violet" x1="116" y1="468" x2="503" y2="144" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6FBFFB"/><stop offset=".48" stopColor="#7077ED"/><stop offset=".78" stopColor="#AB81FF"/><stop offset="1" stopColor="#CBEEFF"/>
          </linearGradient>
          <linearGradient id="ip-blue" x1="170" y1="176" x2="451" y2="482" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F8FFFF"/><stop offset=".24" stopColor="#9BBFF8"/><stop offset=".65" stopColor="#7184EB"/><stop offset="1" stopColor="#DBECFF"/>
          </linearGradient>
          <radialGradient id="ip-orb-glow"><stop stopColor="#B0A4FF" stopOpacity=".85"/><stop offset="1" stopColor="#B8CDFF" stopOpacity="0"/></radialGradient>
          <radialGradient id="ip-bulb-light"><stop stopColor="#FFF" /><stop offset=".15" stopColor="#F7DCFF"/><stop offset=".38" stopColor="#C7A6FF" stopOpacity=".75"/><stop offset="1" stopColor="#A2BDFF" stopOpacity="0"/></radialGradient>
          <linearGradient id="ip-cube" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
            <stop stopColor="#E4F7FF" stopOpacity=".94"/><stop offset=".34" stopColor="#8FB4FF" stopOpacity=".85"/><stop offset="1" stopColor="#837AE7" stopOpacity=".84"/>
          </linearGradient>
          <linearGradient id="ip-panel" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#E4E6FF" stopOpacity=".92"/><stop offset=".55" stopColor="#788AEE" stopOpacity=".85"/><stop offset="1" stopColor="#7364D5" stopOpacity=".88"/>
          </linearGradient>
          <filter id="ip-soft-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="8"/>
          </filter>
          <filter id="ip-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="18"/>
          </filter>
          <filter id="ip-point-glow" x="-250%" y="-250%" width="600%" height="600%">
            <feGaussianBlur stdDeviation="3.5"/>
          </filter>
          <filter id="ip-tile-shadow" x="-50%" y="-50%" width="200%" height="220%">
            <feDropShadow dx="1" dy="9" stdDeviation="11" floodColor="#4B5CC3" floodOpacity=".3"/>
          </filter>
        </defs>

        {/* Elliptical illumination anchors the portal above the page. */}
        <ellipse cx="319" cy="583" rx="207" ry="27" fill="#7389F8" opacity=".14" filter="url(#ip-shadow)"/>
        <ellipse cx="320" cy="577" rx="210" ry="31" stroke="#B4B9FF" strokeOpacity=".26" strokeWidth="2"/>
        <ellipse cx="320" cy="577" rx="156" ry="17" stroke="#D5E7FF" strokeOpacity=".45" strokeWidth="2"/>
        <ellipse cx="320" cy="578" rx="100" ry="12" fill="#96ABFF" opacity=".08"/>

        {/* Moving light arcs behind the glass. */}
        <g className="innovation-portal__trails">
          <ellipse cx="311" cy="327" rx="253" ry="88" transform="rotate(-26 311 327)" stroke="#E7F8FF" strokeWidth="2" strokeOpacity=".74" strokeDasharray="230 80 140 220"/>
          <ellipse cx="321" cy="330" rx="274" ry="97" transform="rotate(23 321 330)" stroke="#BFA1FF" strokeWidth="1.7" strokeOpacity=".52" strokeDasharray="190 140 90 360"/>
          <ellipse cx="318" cy="333" rx="256" ry="90" transform="rotate(33 318 333)" stroke="#B7C8FF" strokeWidth="1.5" strokeOpacity=".7" strokeDasharray="95 270 170 180"/>
        </g>

        {/* Three nested dimensional glass hoops. Their animated highlights run oppositely. */}
        <g className="innovation-portal__ring-outer" transform="rotate(27 321 315)">
          <ellipse cx="321" cy="315" rx="171" ry="241" fill="url(#ip-ring-fill)" opacity=".36"/>
          <ellipse cx="321" cy="315" rx="171" ry="241" stroke="#758FF1" strokeOpacity=".14" strokeWidth="40" filter="url(#ip-soft-glow)"/>
          <ellipse cx="321" cy="315" rx="177" ry="247" stroke="#7D9DEB" strokeOpacity=".33" strokeWidth="21"/>
          <ellipse cx="321" cy="315" rx="169" ry="239" stroke="url(#ip-glass)" strokeWidth="18"/>
          <ellipse cx="321" cy="315" rx="156" ry="226" stroke="#E8F9FF" strokeOpacity=".85" strokeWidth="3"/>
          <ellipse cx="321" cy="315" rx="184" ry="254" stroke="#E6FCFF" strokeOpacity=".77" strokeWidth="2"/>
          <ellipse cx="321" cy="315" rx="176" ry="245" stroke="url(#ip-violet)" strokeOpacity=".67" strokeWidth="5" strokeDasharray="310 120 135 430" className="innovation-portal__glint"/>
          <ellipse cx="321" cy="315" rx="179" ry="249" stroke="#FFF" strokeOpacity=".77" strokeWidth="1.5" strokeDasharray="115 700 46 400"/>
        </g>
        <g className="innovation-portal__ring-middle" transform="rotate(32 321 315)">
          <ellipse cx="321" cy="315" rx="147" ry="214" stroke="url(#ip-blue)" strokeOpacity=".88" strokeWidth="12"/>
          <ellipse cx="321" cy="315" rx="143" ry="207" stroke="#FFF" strokeOpacity=".78" strokeWidth="2"/>
          <ellipse cx="321" cy="315" rx="149" ry="216" stroke="#8172F6" strokeOpacity=".64" strokeWidth="3" strokeDasharray="165 340 170 480" className="innovation-portal__glint innovation-portal__glint--reverse"/>
        </g>
        <g className="innovation-portal__ring-inner" transform="rotate(22 321 315)">
          <ellipse cx="321" cy="315" rx="122" ry="190" stroke="#CBDCFF" strokeOpacity=".56" strokeWidth="8"/>
          <ellipse cx="321" cy="315" rx="121" ry="189" stroke="#FFF" strokeOpacity=".54" strokeWidth="1.8"/>
          <ellipse cx="321" cy="315" rx="128" ry="194" stroke="#827DFA" strokeOpacity=".4" strokeWidth="3" strokeDasharray="150 220 90 370" className="innovation-portal__glint"/>
        </g>

        {/* The innovation bulb sits at the center of the glass rings. */}
        <g className="innovation-portal__lightbulb">
          <circle cx="335" cy="322" r="76" fill="url(#ip-bulb-light)" opacity=".54"/>
          <path d="M337 254c-31 0-52 23-52 50 0 22 10 32 22 47 7 9 9 16 10 27h38c0-12 6-22 15-33 11-14 20-26 20-42 0-27-22-49-53-49Z" fill="#D9E5FF" fillOpacity=".2" stroke="#B5B8FF" strokeOpacity=".83" strokeWidth="5"/>
          <path d="M304 288c11-27 46-35 65-13" stroke="#FFF" strokeWidth="6" strokeOpacity=".72" strokeLinecap="round"/>
          <path d="m321 325 14 19 15-19m-15 18v31" stroke="#F7ECFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M316 381h39m-37 9h35m-30 9h26" stroke="#8279DD" strokeWidth="7" strokeLinecap="round"/>
          <ellipse cx="335" cy="329" rx="18" ry="25" fill="#EFCEFF" opacity=".56" filter="url(#ip-point-glow)"/>
          <circle cx="335" cy="329" r="7" fill="#FFF" className="innovation-portal__bulb-spark"/>
        </g>

        {/* 3D AI cube: side, top and translucent front. */}
        <g className="innovation-portal__float innovation-portal__float--ai" filter="url(#ip-tile-shadow)">
          <path d="m159 205 48-29 44 27-50 29Z" fill="#DDF3FF" fillOpacity=".92" stroke="#F5FFFF" strokeWidth="2"/>
          <path d="m201 232 50-29-2 67-50 29Z" fill="#6273D9" fillOpacity=".8" stroke="#CFDFFF" strokeWidth="2"/>
          <path d="m159 205 42 27-2 67-43-26Z" fill="url(#ip-cube)" stroke="#E0F5FF" strokeWidth="2"/>
          <path d="m167 214 27 17-1 53-28-16Z" stroke="#F5FFFF" strokeOpacity=".65" strokeWidth="1"/>
          <text x="183" y="257" fill="#FFF" fontFamily="system-ui,sans-serif" fontWeight="750" fontSize="25" textAnchor="middle" transform="rotate(29 183 257)">AI</text>
        </g>

        {/* Translucent code panel. */}
        <g className="innovation-portal__float innovation-portal__float--code" filter="url(#ip-tile-shadow)">
          <rect x="427" y="226" width="88" height="76" rx="11" transform="rotate(12 427 226)" fill="url(#ip-panel)" stroke="#DFECFF" strokeWidth="2"/>
          <path d="m454 244-14 15 14 15m38-26 14 15-14 15m-15-34-10 40" transform="rotate(12 466 256)" stroke="#F8FFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        </g>

        {/* Microchip and document card in front of glass. */}
        <g className="innovation-portal__float innovation-portal__float--chip" filter="url(#ip-tile-shadow)" transform="rotate(20 447 413)">
          <rect x="416" y="385" width="65" height="65" rx="8" fill="#8B94ED" fillOpacity=".78" stroke="#DCE9FF" strokeWidth="3"/>
          <rect x="429" y="397" width="39" height="39" rx="5" fill="#5363C8" stroke="#C6D6FF" strokeWidth="3"/>
          <rect x="439" y="407" width="20" height="20" rx="3" fill="#9EA8FF"/>
          <path d="M427 375v10m14-10v10m14-10v10m14-10v10m-42 65v10m14-10v10m14-10v10m14-10v10m12-73h9m-9 14h9m-9 14h9m-77-28h9m-9 14h9m-9 14h9" stroke="#7B89E0" strokeWidth="4" strokeLinecap="round"/>
        </g>
        <g className="innovation-portal__float innovation-portal__float--document" filter="url(#ip-tile-shadow)" transform="rotate(16 201 434)">
          <rect x="160" y="396" width="82" height="82" rx="11" fill="url(#ip-panel)" stroke="#E3EFFF" strokeWidth="2"/>
          <path d="M179 422h25m-25 11h43m-43 11h36" stroke="#FFF" strokeWidth="5" strokeLinecap="round"/>
        </g>

        {/* Floating shards, spheres and points (animated with small CSS transforms). */}
        <g className="innovation-portal__float innovation-portal__float--particles">
          <circle cx="385" cy="85" r="15" fill="url(#ip-glass)" stroke="#D8E6FF" strokeOpacity=".8"/>
          <circle cx="111" cy="279" r="6" fill="#7EACF3" opacity=".85"/>
          <circle cx="537" cy="193" r="7" fill="#A68AF7" opacity=".68"/>
          <path d="m133 471 13-11 17 8-3 19-17 7-10-11Z" fill="#9C8EF0" fillOpacity=".72" stroke="#D1C2FF" strokeWidth="2"/>
          <path d="m516 487 15-13 17 6 1 17-16 11-16-8Z" fill="#87B1F2" fillOpacity=".75" stroke="#C6E9FF" strokeWidth="2"/>
          <path d="m393 504 10-8 10 5-1 11-10 5-9-6Z" fill="#7C7EEA" stroke="#D7CEFF" strokeWidth="1.8"/>
          <path d="m112 153 7-5 7 4v7l-8 5-6-5Z" fill="#93B4FF"/>
          <path d="m530 366 8-6 7 3 1 9-8 5-8-5Z" fill="#AFA0FC"/>
          <circle cx="162" cy="110" r="2.5" fill="#ACCBFF"/>
          <circle cx="465" cy="111" r="3.2" fill="#E1D4FF"/>
          <circle cx="572" cy="345" r="2.5" fill="#B19FFF"/>
          <circle cx="136" cy="371" r="2.5" fill="#B6D3FF"/>
          <circle cx="484" cy="543" r="2.5" fill="#8C98FE"/>
          <circle cx="262" cy="520" r="2.3" fill="#A4B8FF"/>
        </g>
      </svg>
      <span className="innovation-portal__static-caption">INNOVATE · EXPLORE · CREATE</span>
    </div>
  );
}
