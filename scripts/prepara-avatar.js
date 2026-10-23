'use strict';
// Ottimizza i singoli originali generati: nessuna credenziale o chiamata a servizi.
// node scripts/prepara-avatar.js manifest-locale.json /percorso/node_modules/sharp
const fs=require('fs'),path=require('path');
const catalog=require('../shared/avatars');
async function main(){
  const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const sharp=require(process.argv[3]||'sharp');
  const root=path.resolve(__dirname,'..');
  for(const a of catalog.LIST){
    const source=manifest[a.id];
    if(!source)continue;
    const dest=path.join(root,'public',a.art);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    const meta=await sharp(source).metadata();
    if(Math.abs(meta.width/meta.height-a.frames)>.05)throw Error('Proporzioni inattese: '+a.id);
    await sharp(source).resize(512*a.frames,512).webp({quality:88,effort:5}).toFile(dest);
  }
  const missing=catalog.LIST.filter(a=>!fs.existsSync(path.join(root,'public',a.art))).map(a=>a.id);
  console.log(JSON.stringify({preparati:catalog.LIST.length-missing.length,mancanti:missing}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
