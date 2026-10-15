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
test('authentication pages share the editorial palette without cinematic effects',() => {
  const authCss = fs.readFileSync(new URL('../src/components/PortalAuth.css',import.meta.url),'utf8');
  for (const color of ['#111833','#f8faff','#5049e7','#e5e9f5','#8490aa']) assert.ok(authCss.includes(color),`Authentication palette must include ${color}`);
  assert.doesNotMatch(authCss,/gradient\(|drop-shadow\(|backdrop-filter|admin-orbit/);
  assert.match(authCss,/:focus-visible/);
  assert.match(authCss,/prefers-reduced-motion/);
});
