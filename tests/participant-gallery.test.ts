import test from 'node:test';
import assert from 'node:assert/strict';
import {createGalleryToken,verifyGalleryToken,sessionDateFromCode} from '../lib/participant-gallery-token';
test('날짜코드를 달력상 유효한 날짜로 해석한다',()=>{assert.equal(sessionDateFromCode('20261114'),'2026-11-14');assert.equal(sessionDateFromCode('20261121'),'2026-11-21');for(const code of ['20260230','20261301','2026111','abcd1114','2026-11-14'])assert.equal(sessionDateFromCode(code),null);});
test('완보자 사진방 토큰은 유효한 회차에 한정되고 변조·다른 키·만료를 거부한다',()=>{
 const id='00000000-0000-4000-8000-000000000002',now=Date.now(),secret='fixture-only-server-secret';const token=createGalleryToken(id,secret,now);
 assert.equal(verifyGalleryToken(token,secret,now)?.sessionId,id);assert.equal(verifyGalleryToken(token,secret,now+4*60*60*1000),null);assert.equal(verifyGalleryToken(token,'other-key',now),null);assert.equal(verifyGalleryToken(token+'extra',secret,now),null);assert.equal(verifyGalleryToken('broken',secret,now),null);
 const parts=token.split('.');parts[0]=Buffer.from(JSON.stringify({sessionId:'00000000-0000-4000-8000-000000000003',expires:now+1000})).toString('base64url');assert.equal(verifyGalleryToken(parts.join('.'),secret,now),null);
});
