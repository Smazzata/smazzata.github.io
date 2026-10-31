'use strict';
const crypto=require('node:crypto'),D=require('./deliveries');
function configure(ctx,data,persist,now=Date.now(),confirmationId=null){
  const p=D.normalize({...data,mode:'all',push:false});
  if(!p.campaignKey||!p.gifts.length)throw Error('Il benvenuto richiede un codice campagna e un regalo');
  D.checkCampaign(ctx,p);const before=ctx.welcomeCampaign;
  // Modificare il testo della stessa campagna attiva non esclude iscritti ancora da accreditare.
  ctx.welcomeCampaign={...p,enabled:true,confirmationId,activatedAt:before?.enabled&&before.campaignKey===p.campaignKey?before.activatedAt:now};
  try{persist();}catch(e){ctx.welcomeCampaign=before;throw e;}
}
function disable(ctx,persist){const before=ctx.welcomeCampaign;ctx.welcomeCampaign=before?{...before,enabled:false}:null;try{persist();}catch(e){ctx.welcomeCampaign=before;throw e;}}
function grant(ctx,token,persist,now=Date.now()){
  const p=ctx.welcomeCampaign,s=ctx.sessions.get(token);
  if(!p?.enabled||!s?.nick||!D.date(s)||D.date(s)<p.activatedAt||!D.eligible(s,p))return null;
  const id='welcome-'+crypto.createHash('sha256').update(p.campaignKey+'\0'+token).digest('hex').slice(0,48);
  return D.deliver(ctx,id,p,[token],persist,now);
}
module.exports={configure,disable,grant};
