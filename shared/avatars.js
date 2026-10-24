/* Catalogo degli avatar: identità e rarità condivise tra server e interfaccia. */
'use strict';
(function (root) {
  const RARITIES = [
    { id: 'common', name: 'Comune', plural: 'Comuni', color: '#687e70' },
    { id: 'rare', name: 'Raro', plural: 'Rari', color: '#397eaa' },
    { id: 'epic', name: 'Epico', plural: 'Epici', color: '#8c5ead' },
    { id: 'legendary', name: 'Leggendario', plural: 'Leggendari', color: '#a87520' }
  ];
  const original = [
    ['re-cuori','😎','Re di cuori','rare'], ['regina-picche','😇','Regina di picche','rare'],
    ['fante-quadri','🤠','Fante di quadri','common'], ['dama-fiori','🧐','Dama di fiori','common'],
    ['jolly-corallo','🥳','Jolly corallo','rare'], ['jolly-zaffiro','🤓','Jolly zaffiro','rare'],
    ['mazziere','😀','Il mazziere','common'], ['volpe','🦊','Volpe del fante','common'],
    ['gatto','😺','Gatto di cuori','common'], ['gufo','🦉','Gufo stratega','common'],
    ['orso','🐻','Orso fortunato','common'], ['tartaruga','🐢','Tartaruga zen','common'],
    ['leone','🦁','Leone reale','rare'], ['panda','🐼','Panda di fiori','common'],
    ['drago','🐸','Drago smeraldo','epic'], ['fenice','🔥','Fenice dorata','legendary'],
    ['asso-cuori','♥️','Asso di cuori','common'], ['asso-picche','♠️','Asso di picche','common'],
    ['asso-quadri','♦️','Asso di quadri','common'], ['asso-fiori','♣️','Asso di fiori','common']
  ].map(([id,e,name,rarity]) => ({id,e,name,rarity}));
  // Ogni ritratto ha una composizione: specie, abito, copricapo e simbolo.
  const rows = [
    // 27 comuni: forme pulite, accessori quotidiani, colori morbidi.
    ['coniglio-gentile','Coniglio gentile','rabbit','#d7c9b5','#729c85','bow','heart'],
    ['cane-compagno','Cane compagno','dog','#c4996f','#7099ad','scarf','club'],
    ['procione-curioso','Procione curioso','raccoon','#9caaa5','#c88a71','cap','diamond'],
    ['lontra-allegra','Lontra allegra','otter','#a17858','#7ba3aa','bow','heart'],
    ['riccio-trifoglio','Riccio del trifoglio','hedgehog','#977454','#86a677','leaf','club'],
    ['scoiattolo-ghianda','Scoiattolo della ghianda','squirrel','#bc7952','#b49b6e','scarf','diamond'],
    ['topo-lettore','Topolino lettore','mouse','#b4aba5','#8d92ad','glasses','spade'],
    ['koala-rilassato','Koala rilassato','koala','#a4b1ad','#7ea58e','leaf','club'],
    ['pinguino-elegante','Pinguino elegante','penguin','#405d62','#c28370','bow','heart'],
    ['anatra-marina','Anatra marina','duck','#e5d6a4','#699bad','sailor','diamond'],
    ['tasso-tranquillo','Tasso tranquillo','badger','#a5a79c','#9aa17f','scarf','club'],
    ['rana-laghetto','Rana del laghetto','frog','#8bad79','#c89b68','flower','heart'],
    ['panda-rosso','Panda rosso','redpanda','#bb7350','#83a6a1','bow','diamond'],
    ['cerbiatto-timido','Cerbiatto timido','deer','#c39b70','#b28fa2','flower','heart'],
    ['cane-barista','Cagnolino barista','dog','#d2b284','#7e9d88','chef','club'],
    ['gatto-tigrato','Gatto tigrato','cat','#cb9c63','#7d9ca6','cap','spade'],
    ['orso-miele','Orsetto del miele','bear','#c89a5d','#c68a70','flower','heart'],
    ['gufo-lettore','Gufo lettore','owl','#a27c5d','#7899aa','glasses','spade'],
    ['volpe-viaggiatrice','Volpe viaggiatrice','fox','#cf8659','#8ea781','explorer','diamond'],
    ['apprendista-carte','Apprendista delle carte','human','#e8be96','#7397ad','cap','spade'],
    ['pittrice-corallo','Pittrice corallo','human','#a46d50','#c68474','beret','heart'],
    ['giardiniere-fiori','Giardiniere di fiori','human','#d8a778','#7da075','straw','club'],
    ['marinaia-coppe','Marinaia di cuori','human','#bb805f','#729fae','sailor','heart'],
    ['postino-cuori','Postino dei cuori','human','#e5bd94','#b78771','cap','heart'],
    ['pasticciera-vaniglia','Pasticciera vaniglia','human','#aa7355','#ae9db1','chef','diamond'],
    ['esploratore-mazzo','Esploratore del mazzo','human','#c18a64','#91a17a','explorer','club'],
    ['musicista-tavolo','Musicista del tavolo','human','#edcba3','#789898','beret','spade'],
    // 25 rari: materiali preziosi e mestieri fantastici.
    ['volpe-lunare','Volpe lunare','fox','#b4c7cf','#778cae','moon','spade'],
    ['gatto-zaffiro','Gatto zaffiro','cat','#79a6bc','#9a88b5','gem','diamond'],
    ['gufo-astronomo','Gufo astronomo','owl','#7a8d9e','#7f75a3','wizard','spade'],
    ['coniglio-prestigiatore','Coniglio prestigiatore','rabbit','#e4dbc5','#688b9c','tophat','heart'],
    ['procione-assi','Procione degli assi','raccoon','#8b9f9f','#658c85','pirate','spade'],
    ['lontra-perle','Lontra delle perle','otter','#bb9879','#86b0ab','pearls','heart'],
    ['cervo-bosco','Cervo del bosco','deer','#b59c70','#73a18b','leaf','club'],
    ['lupo-argento','Lupo d’argento','wolf','#b4c6ca','#7398ae','scarf','spade'],
    ['tigre-ambra','Tigre d’ambra','tiger','#d5a25b','#a38876','gem','diamond'],
    ['panda-imperiale','Panda imperiale','panda','#ecdfc6','#9a7d91','crown','club'],
    ['koala-sognatore','Koala sognatore','koala','#a1aebd','#8b81ab','nightcap','spade'],
    ['pinguino-ammiraglio','Pinguino ammiraglio','penguin','#405d6a','#7093ac','admiral','diamond'],
    ['tartaruga-maestra','Tartaruga maestra','turtle','#90b397','#b8a06b','glasses','club'],
    ['riccio-rame','Riccio di rame','hedgehog','#b3835d','#8aa99d','goggles','diamond'],
    ['drago-giovane','Drago giovane','dragon','#83b39e','#6e9db1','gem','diamond'],
    ['dama-perle','Dama delle perle','human','#f0cda6','#7c9da8','pearls','heart'],
    ['cavaliere-picche','Cavaliere di picche','human','#b77e5b','#849ba9','knight','spade'],
    ['capitano-quadri','Capitano di quadri','human','#cd9a70','#729a9c','pirate','diamond'],
    ['incantatrice-fiori','Incantatrice di fiori','human','#b57756','#9a86b2','wizard','club'],
    ['viandante-carte','Viandante delle carte','human','#e0b48b','#7b9b90','hood','spade'],
    ['alchimista-mazzo','Alchimista del mazzo','human','#ad7658','#aa9775','goggles','diamond'],
    ['jolly-giada','Jolly di giada','jester','#8abda6','#b7a169','jester','club'],
    ['asso-velluto','Asso di velluto','card','#8d738c','#7799ad','cape','spade'],
    ['cigno-lago','Cigno del lago','swan','#f2e4c8','#87b0b3','pearls','heart'],
    ['pavone-giada','Pavone di giada','peacock','#71a99b','#7395b3','gem','club'],
    // 19 epici: silhouette più ricche, abiti e ornamenti dedicati.
    ['kitsune-corallo','Kitsune corallo','fox','#dfb29a','#aa7f99','tails','heart'],
    ['gatto-stregone','Gatto stregone','cat','#849cb5','#9c7cad','wizard','spade'],
    ['gufo-oracolo','Gufo oracolo','owl','#c6b7a0','#9582b1','oracle','spade'],
    ['cervo-luce','Cervo di luce','deer','#e4ce9e','#8db1ac','antlers','diamond'],
    ['lupo-boreale','Lupo boreale','wolf','#d4e3df','#779dc0','aurora','spade'],
    ['tigre-giada','Tigre di giada','tiger','#9cc4ac','#829aaf','armor','club'],
    ['drago-zaffiro','Drago zaffiro','dragon','#7dabc5','#a18cb7','armor','diamond'],
    ['drago-porpora','Drago porpora','dragon','#b28eb7','#92b7b2','horns','heart'],
    ['unicorno-perlaceo','Unicorno perlaceo','unicorn','#f0dddb','#97adb9','pearls','diamond'],
    ['grifone-dorato','Grifone dorato','griffin','#d2b675','#94a8b1','wings','spade'],
    ['fenice-crepuscolo','Fenice del crepuscolo','phoenix','#b58fae','#759eb7','moon','heart'],
    ['kraken-mazzo','Kraken del mazzo','octopus','#92b1bd','#aa91b1','pirate','spade'],
    ['guardiana-cuori','Guardiana dei cuori','human','#b87958','#c4969d','oracle','heart'],
    ['paladino-quadri','Paladino di quadri','human','#edc49b','#b49a73','armor','diamond'],
    ['regina-nebbie','Regina delle nebbie','human','#d2a380','#9caec6','veil','spade'],
    ['strega-luna','Strega della luna','human','#99664e','#9f8ab6','witch','spade'],
    ['maestro-jolly','Maestro dei jolly','jester','#8a9bbd','#d2b16c','jester','diamond'],
    ['asso-stellare','Asso stellare','card','#9caecc','#ac91bf','stars','diamond'],
    ['mantide-smeraldo','Mantide smeraldo','mantis','#83b79b','#b7a46e','armor','club'],
    // 9 leggendari: ritratti cerimoniali, luce dorata e dettagli celesti.
    ['drago-imperatore','Drago imperatore','dragon','#71a98a','#e1c073','imperial','diamond'],
    ['fenice-solare','Fenice solare','phoenix','#e7b965','#d58a6c','sun','heart'],
    ['volpe-nove-code','Volpe dalle nove code','fox','#f1d5b8','#c9a16d','nine-tails','heart'],
    ['leone-sovrano','Leone sovrano','lion','#d2ae67','#9ca5b2','imperial','spade'],
    ['cervo-celeste','Cervo celeste','deer','#d5e1d7','#bc9ac4','celestial','diamond'],
    ['regina-costellazioni','Regina delle costellazioni','human','#a56f55','#9c9cbe','celestial','spade'],
    ['re-del-mazzo','Re del mazzo','human','#e5be94','#b77d72','imperial','heart'],
    ['jolly-eterno','Jolly eterno','jester','#9db4c8','#d3ad68','eternal','diamond'],
    ['asso-destino','Asso del destino','card','#dbc17a','#879fa7','destiny','spade']
  ];
  const fallback = { human:'😎',rabbit:'😺',dog:'🐶',raccoon:'🐻',otter:'🐻',hedgehog:'🐻',squirrel:'🦊',mouse:'😺',koala:'🐼',penguin:'🦉',duck:'🦉',badger:'🐼',frog:'🐸',redpanda:'🦊',deer:'🦄',cat:'😺',bear:'🐻',owl:'🦉',fox:'🦊',wolf:'🐶',tiger:'🐯',panda:'🐼',turtle:'🐢',dragon:'🐸',jester:'🥳',card:'♠️',swan:'🦉',peacock:'🦉',unicorn:'🦄',griffin:'🦁',phoenix:'🔥',octopus:'🐙',mantis:'🐸',lion:'🦁' };
  const PREVIOUS = original.concat(rows.map(([id,name,design,color,accent,gear,suit],i) => ({id,name,design,color,accent,gear,suit,rarity:i<27?'common':i<52?'rare':i<71?'epic':'legendary',e:fallback[design]})));
  // Cinquanta ritratti curati; i vecchi ID vengono ricondotti alla stessa famiglia.
  const curated = {
    common: 'fante-quadri dama-fiori mazziere volpe gatto gufo orso tartaruga giardiniere-fiori asso-cuori asso-picche asso-quadri asso-fiori coniglio-gentile marinaia-coppe procione-curioso lontra-allegra riccio-trifoglio scoiattolo-ghianda topo-lettore koala-rilassato pinguino-elegante pasticciera-vaniglia panda-rosso',
    rare: 're-cuori regina-picche jolly-corallo jolly-zaffiro leone volpe-lunare gatto-zaffiro gufo-astronomo coniglio-prestigiatore panda-imperiale lupo-argento pinguino-ammiraglio incantatrice-fiori alchimista-mazzo pavone-giada',
    epic: 'drago kitsune-corallo gatto-stregone gufo-oracolo unicorno-perlaceo grifone-dorato kraken-mazzo regina-nebbie',
    legendary: 'fenice drago-imperatore volpe-nove-code'
  };
  const oldById = new Map(PREVIOUS.map(a=>[a.id,a]));
  const LIST = Object.entries(curated).flatMap(([rarity,ids])=>ids.split(' ').map(id=>({...oldById.get(id),rarity,art:'art/avatars/'+id+'.webp',frames:rarity==='legendary'?3:1})));
  const byId = new Map(LIST.map(a=>[a.id,a]));
  const aliases = {};
  const previousDesigns={'fante-quadri':'human','dama-fiori':'human',mazziere:'human',volpe:'fox',gatto:'cat',gufo:'owl',orso:'bear',tartaruga:'turtle',panda:'panda','re-cuori':'human','regina-picche':'human','jolly-corallo':'jester','jolly-zaffiro':'jester',leone:'lion',drago:'dragon',fenice:'phoenix','asso-cuori':'card','asso-picche':'card','asso-quadri':'card','asso-fiori':'card'};
  const canonicalDesign=a=>a.design||previousDesigns[a.id];
  const nearest={panda:'koala-rilassato','cane-compagno':'orso','anatra-marina':'pinguino-elegante','tasso-tranquillo':'procione-curioso','rana-laghetto':'tartaruga','cerbiatto-timido':'coniglio-gentile','pittrice-corallo':'dama-fiori','marinaia-coppe':'dama-fiori','pasticciera-vaniglia':'dama-fiori','cervo-bosco':'pavone-giada','tigre-ambra':'leone','koala-sognatore':'panda-imperiale','drago-giovane':'lupo-argento','asso-velluto':'jolly-zaffiro','cigno-lago':'pavone-giada','cervo-luce':'unicorno-perlaceo','lupo-boreale':'kitsune-corallo','tigre-giada':'grifone-dorato','fenice-crepuscolo':'grifone-dorato','maestro-jolly':'gatto-stregone','asso-stellare':'kraken-mazzo','mantide-smeraldo':'drago','regina-costellazioni':'volpe-nove-code','leone-sovrano':'drago-imperatore'};
  for(const old of PREVIOUS) if(!byId.has(old.id)) {
    const candidates=LIST.filter(a=>a.rarity===old.rarity);
    const next=byId.get(nearest[old.id]) || candidates.find(a=>canonicalDesign(a)===old.design) || (old.rarity==='common'?byId.get('fante-quadri'):candidates[0]);
    aliases[old.id]=next.id;
    byId.set(old.id,next);
  }
  const legacy = new Map();
  for (const a of original) for (const key of [a.e,a.e.replace(/\uFE0F/g,'')]) legacy.set(key,byId.get(a.id));
  for (const [key,id] of Object.entries({'🐶':'orso','🐯':'leone','🐵':'fante-quadri','🦄':'regina-picche','🐙':'jolly-zaffiro','🌻':'dama-fiori','🍀':'panda','⭐':'fenice'})) legacy.set(key,byId.get(id));
  const STARTER_IDS = ['fante-quadri', 'dama-fiori', 'giardiniere-fiori', 'pasticciera-vaniglia'];
  function resolve(value,name='') {
    if(byId.has(value)) return byId.get(value);
    if(legacy.has(value)) return legacy.get(value);
    let hash=0;for(const char of String(name))hash=(hash*31+char.codePointAt(0))>>>0;
    const starters=STARTER_IDS.map(id=>byId.get(id));
    return starters[hash%starters.length];
  }
  const isSelectable = id => STARTER_IDS.includes(byId.get(id)?.id);
  // Il server è l'autorità: nessun possesso proviene da parametri della richiesta.
  function ownedIds(profile={}) {
    const ids=new Set(STARTER_IDS);
    for(const id of Array.isArray(profile.avatarOwned)?profile.avatarOwned:[]) if(byId.has(id)) ids.add(byId.get(id).id);
    const current=profile.avatar;
    if(current && (current.id || current.e)) ids.add(resolve(current.id || current.e,profile.nick).id);
    return [...ids];
  }
  const api={LIST,RARITIES,STARTER_IDS,byId,resolve,isSelectable,ownedIds,aliases};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SmazzataAvatarCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
