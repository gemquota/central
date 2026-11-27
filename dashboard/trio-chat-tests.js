// Static regression checks for Trio Chat frontend. Run: node dashboard/trio-chat-tests.js
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/trio-chat.html','utf8');
const start=html.indexOf('<script>')+8,end=html.indexOf('</script>',start);
assert.ok(start>7&&end>start,'script tag exists');
new Function(html.slice(start,end));
for(const id of ['newChat','settingsBtn','selectMode','send','searchMessagesBtn','connectAllBtn','folderAdd','connectDialog','searchDialog','folderDialog'])assert.ok(html.includes('id="'+id+'"'),'missing '+id);
for(const marker of ['trio-local-v1','trioNewChat','trioLocalAction','manageChat','searchResults','Connect everything','branch-msg','bookmark-msg','reply-msg','edit-msg','archive','restore'])assert.ok(html.includes(marker),'missing '+marker);
assert.ok(html.includes('localStorage'),'local persistence');
assert.ok(html.includes('aria-label'),'accessible names');
assert.ok(html.includes('min-height:44px'),'touch target CSS');
assert.ok(!html.includes('onmouseover'),'no hover-only handlers');
console.log('Trio Chat Phase A static checks passed.');
