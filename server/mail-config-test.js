'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('./mail-config');
const smtp={host:'smtp-relay.brevo.com',port:587,user:'login@example.invalid',pass:'chiave-di-prova con spazi',from:'accesso@example.invalid'};
test('La migrazione SMTP conserva le credenziali Gmail precedenti',()=>{
  const c=parse('gioco@example.invalid\r\n abcd efgh ijkl mnop\r\n');
  assert.equal(c.from,'gioco@example.invalid');assert.equal(c.transport.service,'gmail');
  assert.equal(c.transport.auth.pass,'abcdefghijklmnop');
});
test('SMTP autentica il mittente distinto dal login e richiede TLS verificato',()=>{
  for(const port of [465,587,2525]){
    const c=parse(JSON.stringify({...smtp,port}));
    assert.equal(c.from,smtp.from);assert.equal(c.transport.auth.user,smtp.user);
    assert.equal(c.transport.auth.pass,smtp.pass);assert.equal(c.transport.secure,port===465);
    assert.equal(c.transport.requireTLS,true);assert.equal(c.transport.tls.rejectUnauthorized,true);
  }
});
test('Una configurazione SMTP invalida non torna silenziosamente a Gmail',()=>{
  for(const x of [{port:25},{host:'smtp://host'},{from:'Mittente <a@example.invalid>'},{from:'a@example.invalid\r\nBcc: altro@example.invalid'},{pass:''},{user:''}])assert.equal(parse(JSON.stringify({...smtp,...x})),null);
  assert.equal(parse('{non valido'),null);assert.equal(parse(''),null);
});
test('Invio SMTP: riusa il trasporto e rilegge anche una chiave ruotata dello stesso utente',async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  let now=100000,text=JSON.stringify(smtp);const options=[],messages=[];
  const context={module:{exports:{}},process:{env:{}},Date:{now:()=>now},
    require:id=>id==='fs'?{readFileSync:()=>text}:id==='os'?{homedir:()=>'/config-prova'}:
      id==='path'?path:id==='./config'?{DATA_DIR:'/dati-prova'}:id==='./mail-config'?{parse}:
      id==='nodemailer'?{createTransport:o=>{options.push(o);return {close(){},sendMail:async m=>messages.push(m)};}}:(()=>{throw Error('Modulo inatteso');})()};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'posta.js'),'utf8'),context);
  await context.module.exports.send('utente@example.invalid','Prova','Codice fittizio');
  await context.module.exports.send('utente@example.invalid','Prova','Codice fittizio');
  assert.equal(options.length,1);assert.equal(messages[0].from.address,smtp.from);
  now+=61000;text=JSON.stringify({...smtp,pass:'chiave-ruotata-di-prova'});
  await context.module.exports.send('utente@example.invalid','Prova','Codice fittizio');
  assert.equal(options.length,2);assert.equal(options[1].auth.pass,'chiave-ruotata-di-prova');
});
test('Tunnel stabile: accetta un hostname HTTPS e rifiuta configurazione incompleta o URL con segreti',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-tunnel-')),token=path.join(dir,'token'),url=path.join(dir,'url');
  const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
  const slash=p=>p.replace(/\\/g,'/');
  const check=()=>spawnSync(bash,['-c','source "$1"; stable_tunnel_url "$2" "$3"','prova',slash(path.join(__dirname,'../scripts/tunnel-stabile.sh')),slash(token),slash(url)],{encoding:'utf8'});
  try{
    fs.writeFileSync(token,'segreto-fittizio');fs.writeFileSync(url,'https://gioca.example.com/\n');
    let r=check();assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'https://gioca.example.com');
    for(const value of ['http://gioca.example.com','https://utente:password@example.com','https://example.com/?token=segreto','https://localhost']){
      fs.writeFileSync(url,value);r=check();assert.notEqual(r.status,0);assert.equal(r.stdout,'');assert.ok(!r.stderr.includes('password'));
    }
    fs.writeFileSync(token,'');assert.notEqual(check().status,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
