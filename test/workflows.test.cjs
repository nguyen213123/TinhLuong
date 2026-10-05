const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ExcelJS=require('exceljs');

test('Excel workflow: price snapshots, daily merge, debt selection, locked periods, reload',async()=>{
  const root=path.resolve(__dirname,'..'),documents=path.join(root,'.test-documents');
  assert.ok(documents.startsWith(root+path.sep),'test data must stay inside the project');
  fs.rmSync(documents,{recursive:true,force:true});
  const handlers={};
  let injectedRenderer='';
  class BrowserWindow{static getAllWindows(){return[]}constructor(){this.webContents={on(){},openDevTools(){},executeJavaScript:async script=>{injectedRenderer=script}}}loadFile(){return Promise.resolve()}}
  const fakeElectron={app:{whenReady:()=>Promise.resolve(),getPath:()=>documents,on(){},quit(){}},BrowserWindow,ipcMain:{handle:(name,fn)=>handlers[name]=fn},dialog:{},shell:{openPath:async()=>''}};
  const originalLoad=Module._load;
  Module._load=function(request,parent,isMain){if(request==='electron')return fakeElectron;return originalLoad.call(this,request,parent,isMain)};
  try{
    require('../src/main.cjs');
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(injectedRenderer,/Giao diện sẵn sàng/);
    const call=(name,payload)=>handlers[name](null,payload);
    await call('worker:add','Nguyễn Văn A');
    let data=(await call('data:get')).data;
    const worker=data.workers[0];
    await call('product:add',{name:'Sản phẩm A',price:10000});
    data=(await call('data:get')).data;
    const product=data.products[0];
    await call('production:save',{workerId:worker.id,date:'2026-10-01',lines:[{productId:product.id,quantity:10}]});
    await assert.rejects(async()=>call('production:save',{workerId:worker.id,date:'2026-10-01',lines:[{productId:product.id,quantity:1}]}),/DUPLICATE/);
    await call('production:save',{workerId:worker.id,date:'2026-10-01',mode:'ADD',lines:[{productId:product.id,quantity:3}]});
    await call('product:update',{id:product.id,name:'Sản phẩm A',price:12000});
    await call('production:save',{workerId:worker.id,date:'2026-10-02',lines:[{productId:product.id,quantity:2}]});
    await call('debt:add',{workerId:worker.id,date:'2026-10-02',amount:200000,note:'Nợ vượt lương'});
    data=(await call('data:get')).data;
    await assert.rejects(async()=>call('payment:pay',{workerId:worker.id,date:'2026-10-05',debtIds:[data.debts[0].id]}),/lớn hơn tiền lương/);
    await call('debt:add',{workerId:worker.id,date:'2026-10-03',amount:15000,note:'Ứng tiền'});
    data=(await call('data:get')).data;
    const selected=data.debts[1].id;
    const payment=await call('payment:pay',{workerId:worker.id,date:'2026-10-05',debtIds:[selected]});
    assert.equal(payment.productionTotal,154000);
    assert.equal(payment.debtDeducted,15000);
    assert.equal(payment.actualReceived,139000);
    data=(await call('data:get')).data;
    assert.deepEqual(data.production.map(x=>[x.date,Number(x.quantity),Number(x.unitPrice),Number(x.totalAmount),x.status]),[['2026-10-01',13,10000,130000,'PAID'],['2026-10-02',2,12000,24000,'PAID']]);
    assert.deepEqual(data.debts.map(x=>x.status),['CHUA_TRU','DA_TRU']);
    assert.equal(data.periods[0].status,'CLOSED');
    await assert.rejects(async()=>call('production:delete',{workerId:worker.id,date:'2026-10-01'}),/không thể xóa/);
    const periodFile=path.join(documents,'QuanLyLuong','Luong','Nguyen-Van-A','Dot-01-10-2026_02-10-2026.xlsx');
    assert.ok(fs.existsSync(periodFile));
    const period=new ExcelJS.Workbook();await period.xlsx.readFile(periodFile);
    assert.deepEqual(period.worksheets.map(sheet=>sheet.name),['Production','Payment','Debt','Summary']);
    assert.equal((await call('data:get')).data.payments.length,1);
  }finally{
    Module._load=originalLoad;
    fs.rmSync(documents,{recursive:true,force:true});
  }
});
