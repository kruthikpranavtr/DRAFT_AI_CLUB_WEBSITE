import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'src/components/ScrollVideoStory.jsx'),'utf8');
const names=['hero-particle-ribbon-web.mp4','section-discover.mp4','section-create.mp4','section-connect.mp4'];

test('homepage videos are playable browser assets, never Git LFS pointer text',()=>{
  assert.doesNotMatch(source,/\/api\/public\/media\//);
  for(const name of names){
    assert.ok(source.includes('/web-video/'+name),'Missing video reference: '+name);
    const file=path.join(root,'public','web-video',name);
    const size=fs.statSync(file).size;
    assert.ok(size>100_000 && size<25_000_000,name+' must remain web-optimized');
    const fd=fs.openSync(file,'r');
    try {
      const header=Buffer.alloc(12);
      assert.equal(fs.readSync(fd,header,0,12,0),12);
      assert.equal(header.toString('ascii',4,8),'ftyp',name+' is not an MP4');
    } finally { fs.closeSync(fd); }
  }
});

test('original high-quality LFS masters remain untouched by the web versions',()=>{
  const attr=fs.readFileSync(path.join(root,'.gitattributes'),'utf8');
  assert.match(attr,/public\/\*\.mp4 filter=lfs/);
  assert.match(attr,/public\/web-video\/\*\.mp4 -filter -diff -merge -text/);
  for(const name of names)assert.ok(fs.existsSync(path.join(root,'public',name)),name+' source missing');
});
