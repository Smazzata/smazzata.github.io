'use strict';
const crypto=require('node:crypto');
function save(ctx,input,persist,now=Date.now()){
  const fields={};for(const k of ['title','body','nicks','mode','from','before','gift','campaignKey'])fields[k]=String(input[k]||'').slice(0,k==='body'?2000:k==='nicks'?9000:250);
  fields.push=input.push==='on'?'on':'';
  const old=ctx.deliveryDrafts||[],id=old.some(x=>x.id===input.draftId)?input.draftId:crypto.randomUUID();
  if(old.length>=30&&!old.some(x=>x.id===id))throw Error('Hai già 30 bozze: elimina una bozza prima di crearne un’altra.');
  ctx.deliveryDrafts=[...old.filter(x=>x.id!==id),{id,at:now,fields}];
  try{persist();}catch(e){ctx.deliveryDrafts=old;throw e;}return id;
}
function remove(ctx,id,persist){const old=ctx.deliveryDrafts||[];ctx.deliveryDrafts=old.filter(x=>x.id!==id);try{persist();}catch(e){ctx.deliveryDrafts=old;throw e;}}
module.exports={save,remove};
