import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/components/Dashboard.css',import.meta.url),'utf8').replace(/#([a-f\d])([a-f\d])([a-f\d])(?![a-f\d])/gi,(_,r,g,b) => `#${r}${r}${g}${g}${b}${b}`);
function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value,16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
}
function contrast(a,b) { const values = [luminance(a),luminance(b)].sort((x,y) => y-x); return (values[0]+.05)/(values[1]+.05); }
function verifyPairs(pairs,minimum) {
  for (const [foreground,background] of pairs) {
    assert.ok(css.includes(`#${foreground}`) && css.includes(`#${background}`),'Tested colors must exist in the stylesheet');
    assert.ok(contrast(foreground,background) >= minimum,`${foreground} on ${background} must meet ${minimum}:1`);
  }
}
test('dashboard text, navigation, actions and status palettes meet WCAG AA contrast',() => {
  verifyPairs([['111833','ffffff'],['626d87','ffffff'],['626d87','f8faff'],['ffffff','5049e7'],['b7bed3','111833'],['18794e','eaf6ef'],['b42318','fff0ee'],['8a5100','fff4de'],['4d5470','f2f3fa'],['453dce','ffffff']],4.5);
});
test('dashboard field boundaries and focus indicators meet non-text contrast',() => {
  verifyPairs([['8490aa','ffffff'],['8490aa','f8faff'],['5049e7','ffffff'],['5049e7','f8faff'],['c4c1ff','111833']],3);
});
test('AI Club reference-inspired light sign-in keeps contrast, access and responsive portal animation',() => {
  const authCss = fs.readFileSync(new URL('../src/components/PortalAuth.css',import.meta.url),'utf8');
  const authJsx = fs.readFileSync(new URL('../src/components/PortalAuth.jsx',import.meta.url),'utf8');
  const portalCss = fs.readFileSync(new URL('../src/components/InnovationPortal.css',import.meta.url),'utf8');
  const portalJsx = fs.readFileSync(new URL('../src/components/InnovationPortal.jsx',import.meta.url),'utf8');
  for (const color of ['#111833','#f8faff','#5049e7','#e5e9f5','#8490aa']) {
    assert.ok(authCss.includes(color),`Light auth palette must include ${color}`);
  }
  assert.ok(contrast('111833','ffffff') >= 4.5,'Card heading must be readable');
  assert.ok(contrast('626d87','ffffff') >= 4.5,'Muted card copy must be readable');
  assert.ok(contrast('ffffff','5049e7') >= 4.5,'Sign-in label needs high contrast');
  assert.match(authCss,/:focus-visible/);
  assert.match(authCss,/@media\(max-width:767px\)/);
  assert.match(portalCss,/@media\(prefers-reduced-motion: reduce\)/);
  assert.match(portalCss,/innovation-portal--paused/);
  assert.match(portalJsx,/visibilitychange/);
  assert.match(portalJsx,/pointermove/);
  assert.match(portalJsx,/aria-hidden="true"/);
  assert.match(authJsx,/<InnovationPortal\s*\/>/);
  assert.match(authJsx,/autoComplete="username"/);
  assert.match(authJsx,/autoComplete="current-password"/);
  assert.match(authJsx,/aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
});
