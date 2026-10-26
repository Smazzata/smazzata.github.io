'use strict';
module.exports=async({cdp,shot,step})=>{
 const result=await cdp.run(`
  const calls=[],original=emit;
  emit=async(event,...args)=>{const at=performance.now();const r=await original(event,...args);if(event.startsWith('tournament'))calls.push({event,ms:Math.round(performance.now()-at),ok:r.ok,error:r.error,timeout:r.timeout});return r;};
  const waitFor=async selector=>{
   const until=Date.now()+15000;
   while(Date.now()<until){const el=document.querySelector(selector);if(el&&el.isConnected&&!el.disabled)return;await __W(100);}
   throw Error('Torneo: attesa '+selector+' '+JSON.stringify({calls,modal:S.modalKind,connected:S.connected,syncPending:S.syncPending,text:document.querySelector('#modal .modal-content')?.textContent.slice(0,500),notice:document.querySelector('#toast')?.textContent}));
  };
  try{
   await __menu('tournaments');await waitFor('#modal #tourform');
   document.querySelector('#tourname').value='Coppa del robot';
   __tap('#modal [name=toursize][value="4"]');__tap('#modal #tourform button');
   await waitFor('#modal [data-act=tourFill]');__tap('#modal [data-act=tourFill]');
   await waitFor('#modal [data-act=tourStart]');__tap('#modal [data-act=tourStart]');
   await waitFor('#modal .bracket [data-act=tourPlay]');
   return {calls,bracket:!!document.querySelector('#modal .bracket'),play:!!document.querySelector('#modal .bracket [data-act=tourPlay]')};
  }finally{emit=original;}
 `,60000);
 if(!result.bracket||!result.play)throw Error('Tabellone torneo incompleto: '+JSON.stringify(result));
 await shot('05-torneo');
 step('torneo: creazione, riempimento, avvio e tabellone confermati '+JSON.stringify(result.calls));
};
