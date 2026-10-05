const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');

test('Renderer responds to navigation, quantity input, and add-worker button',async()=>{
  const state={workers:[{id:'worker-1',name:'Nguyễn Văn A',status:'ACTIVE',createdAt:'2026-10-01'}],products:[{id:'product-1',name:'Mô hình A',currentPrice:10000,status:'ACTIVE'}],production:[],debts:[],payments:[],periods:[],audit:[]};
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'..','src','index.html'),'utf8'),{runScripts:'outside-only'});
  dom.window.api={getData:async()=>({data:JSON.parse(JSON.stringify(state))}),addWorker:async name=>{state.workers.push({id:'worker-2',name,status:'ACTIVE',createdAt:'2026-10-05'})},openFolder:async()=>{}};
  const source=fs.readFileSync(path.join(__dirname,'..','src','app.js'),'utf8');
  const bootError=dom.window.eval(`(()=>{try{\n${source}\nreturn ''}catch(error){return error.stack||String(error)}})()`);
  assert.equal(bootError,'');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(dom.window.document.querySelector('#app-status').textContent,'Giao diện sẵn sàng');
  dom.window.document.querySelector('[data-page="production"]').click();
  assert.equal(dom.window.document.querySelector('#page-title').textContent,'Nhập sản lượng');
  const quantity=dom.window.document.querySelector('.quantity');
  quantity.value='4';quantity.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(dom.window.document.querySelector('#grand-total').textContent,'40.000đ');
  dom.window.document.querySelector('[data-page="workers"]').click();
  dom.window.document.querySelector('#add-worker').click();
  assert.ok(dom.window.document.querySelector('#worker-name'),'Thêm công nhân should open its form');
  dom.window.document.querySelector('#worker-name').value='Nguyễn Văn B';
  dom.window.document.querySelector('#save-worker').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(dom.window.document.querySelector('#content').textContent,/Nguyễn Văn B/);
  dom.window.close();
});
