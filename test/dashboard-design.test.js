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
test('AI Club sign-in theme preserves readable contrast, keyboard focus and mobile layout',() => {
  const authCss = fs.readFileSync(new URL('../src/components/PortalAuth.css',import.meta.url),'utf8');
  const authJsx = fs.readFileSync(new URL('../src/components/PortalAuth.jsx',import.meta.url),'utf8');
  for (const color of ['#080e20','#eef3ff','#f6f8ff','#aebfdf','#a8a5ff']) {
    assert.ok(authCss.includes(color),`New authentication theme should include ${color}`);
  }
  assert.ok(contrast('f6f8ff','1e274b') >= 4.5,'Card heading must be legible');
  assert.ok(contrast('aebfdf','1e274b') >= 4.5,'Card supporting text must be legible');
  assert.ok(contrast('ffffff','6561f3') >= 4.5,'Submit label must contrast against its background');
  assert.match(authCss,/:focus-visible/);
  assert.match(authCss,/prefers-reduced-motion/);
  assert.match(authCss,/@media\(max-width:830px\)/);
  assert.match(authCss,/@media\(max-width:480px\)/);
  assert.match(authJsx,/autocomplete|autoComplete="username"/i);
  assert.match(authJsx,/autoComplete="current-password"/);
  assert.match(authJsx,/aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
});
