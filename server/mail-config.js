'use strict';
// Configurazione privata: formato Gmail storico oppure SMTP con TLS obbligatorio.
function parse(text) {
  const value=String(text||'').trim();
  if(!value)return null;
  if(!value.startsWith('{')){
    const [user,pass]=value.split(/\r?\n/).map(x=>x.trim());
    return user&&pass?{from:user,transport:{service:'gmail',auth:{user,pass:pass.replace(/\s+/g,'')}}}:null;
  }
  try{
    const x=JSON.parse(value),port=Number(x.port||587);
    if(typeof x.host!=='string'||!/^[a-zA-Z0-9.-]+$/.test(x.host)||![465,587,2525].includes(port))return null;
    if(typeof x.user!=='string'||!x.user.trim()||typeof x.pass!=='string'||!x.pass)return null;
    if(typeof x.from!=='string'||!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(x.from))return null;
    return {from:x.from,transport:{host:x.host,port,secure:port===465,requireTLS:true,
      auth:{user:x.user,pass:x.pass},tls:{minVersion:'TLSv1.2',rejectUnauthorized:true},
      connectionTimeout:15000,greetingTimeout:15000,socketTimeout:30000}};
  }catch{return null;}
}
module.exports={parse};
