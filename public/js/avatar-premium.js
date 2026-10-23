/* Illustrazioni delle rarità superiori: materiali, ritratti e scene dedicati. */
'use strict';
(function(root) {
  const P=(d,fill='none',stroke='#344650',w=1.2)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const C=(x,y,r,fill,stroke='none',w=1)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
  const E=(x,y,rx,ry,fill,stroke='none')=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}"/>`;
  const G=name=>`url(#__AV__-${name})`;
  const star=(x,y,r=4,color='#ffe5a5')=>P(`m${x} ${y-r} 1.2 ${r-1.2} ${r-1.2} 1.2-${r-1.2} 1.2-1.2 ${r-1.2}-1.2-${r-1.2}-${r-1.2}-1.2 ${r-1.2}-1.2Z`,color,'none');
  const jewel=(x,y,r=5,color=G('gem'))=>P(`m${x} ${y-r} ${r*.8} ${r} -${r*.8} ${r*1.25}-${r*.8}-${r*1.25}Z`,color,'#b99251',.9)+P(`m${x-r*.5} ${y} ${r*.5}-${r*.7} ${r*.5} ${r*.7}`, 'none','#fff5cc',.7);
  const eye=(x,y,color='#4a9487',tilt=0)=>`<g transform="rotate(${tilt} ${x} ${y})">${P(`M${x-6} ${y}q6-7 12 0-6 6-12 0Z`,'#fff4df','#493f46',1)}${E(x+1,y,2.8,3,color)}${E(x+1,y,1.3,2.6,'#253443')}${C(x+.3,y-1.3,.8,'#fff')}${P(`m${x-6} ${y} -2-2`, 'none','#493f46',1)}</g>`;
  const animalEyes=(x=49,y=59,color='#4b9f91')=>eye(x,y,color,-6)+eye(128-x,y,color,6);
  const smile=(x=64,y=78)=>P(`M${x-5} ${y}q5 3 10-1`,'none','#88624d',1.2);
  const suit=(type,x,y,s,color='#edd69a')=>{
    const shapes={heart:'M8 4C2-3-5 6 8 15 21 6 14-3 8 4Z',spade:'M8 0C5 5 0 6 0 10c0 5 5 5 8 1 3 4 8 4 8-1C16 6 11 5 8 0Zm0 10-3 6h6Z',diamond:'m8 0 8 8-8 8L0 8Z',club:'M8 0a4 4 0 0 0-3 7c-7-3-7 8-1 7 2 0 3-1 4-3 1 2 2 3 4 3 6 1 6-10-1-7A4 4 0 0 0 8 0Zm0 10-3 6h6Z'};
    return `<g transform="translate(${x} ${y}) scale(${s/16})">${P(shapes[type]||shapes.spade,color,'none')}</g>`;
  };
  function definitions(a) {
    const palettes={
      dragon:['#183a48','#2d826d','#a4dcc1'],fox:['#604057','#e3b794','#fff4df'],cat:['#333653','#7c8dba','#d5d5ec'],owl:['#353152','#9983af','#efddc2'],deer:['#203d56','#81b5b2','#eff4d6'],wolf:['#223c61','#91bed0','#f0f4e8'],tiger:['#203f45','#79a99b','#e6edd4'],unicorn:['#4a365d','#bca5c8','#fff4e8'],griffin:['#26394a','#c4a46a','#f4e9bb'],phoenix:['#5b2846','#d5835d','#ffe2a0'],octopus:['#263958','#6f9bab','#c9dbe0'],mantis:['#233d3b','#79a796','#d1dfb7'],human:['#3d3559','#a98baf','#f0d6b0'],jester:['#302b52','#9884b6','#e9d4a9'],card:['#18394d','#87abb8','#fff0c1'],lion:['#4b2d30','#bd8351','#ffe2a0']
    };
    const variants={
      'drago-zaffiro':['#233854','#6e9fc6','#d0e7ef'],
      'drago-porpora':['#482b58','#a574b4','#e8cfed'],
      'drago-imperatore':['#123e40','#419780','#c9ead2'],
      'fenice':['#183d51','#548e91','#fff1c9'],
      'fenice-crepuscolo':['#302b59','#9a78b3','#efd0d8'],
      'fenice-solare':['#713c39','#d18b51','#fff0bb'],
      'kitsune-corallo':['#623c57','#d69b92','#fff0dd'],
      'volpe-nove-code':['#583b53','#bd936a','#fff6da']
    };
    const [dark,mid,light]=variants[a.id]||palettes[a.design]||palettes.human;
    const grad=(id,colors,radial=false)=>`<${radial?'radialGradient':'linearGradient'} id="__AV__-${id}" ${radial?'cx="35%" cy="25%" r="80%"':'x1="0" y1="0" x2="1" y2="1"'}>${colors.map((c,i)=>`<stop offset="${i/(colors.length-1)*100}%" stop-color="${c}"/>`).join('')}</${radial?'radialGradient':'linearGradient'}>`;
    return `<defs>${grad('bg',[mid,dark],true)}${grad('fur',[light,mid])}${grad('cloth',[mid,dark])}${grad('gold',['#fff1af','#dcad59','#93612d'])}${grad('ivory',['#fffaf0','#e2cda9'])}${grad('gem',['#e6fff4','#68b6ab','#356a89'])}${grad('skin',['#fbe0ba',a.color||'#bd8d73'])}${grad('metal',['#f0eee4','#9daeba','#5c7383'])}${grad('magic',['#e9e5ff','#a595d8','#6a75a7'])}${grad('hair',[dark,'#192d3c'])}${grad('flame',['#fff3ba','#e2a650','#b8584a'])}</defs>`;
  }
  function scene(a,legend=false) {
    const stars=[[16,24,2],[107,19,3],[21,83,2],[111,67,2],[40,12,1.5],[89,103,2]];
    let art=C(64,64,64,G('bg'));
    if(legend) {
      art+=P('M-2 92C11 48 2 13 46 6M73-3c47 13 70 57 52 102', 'none','#e3c88a',1.2);
      art+=P('M6 95q-10-32 8-52m99 57q16-25 5-48','none','#c9b477',.65);
      art+=stars.map(([x,y,r])=>star(x,y,r)).join('');
      art+=P('M8 83c22 8 9 27 32 30m80-29c-22 8-9 27-32 30','none','#d8c69e',.7);
    } else art+=P('M6 85C-5 28 40 10 64 13c45-1 70 39 56 76','none','#d6cbd4',.65)+stars.slice(0,3).map(([x,y,r])=>star(x,y,r*.7,'#c8c9df')).join('');
    return art;
  }
  function mantle(a,legend=false) {
    const outline=legend?'#d3b276':'#a6a6bb';
    let art=P('M15 128 22 106Q27 89 48 88h32q21 1 26 18l7 22Z',G('cloth'));
    art+=P('m27 103 18-13 19 16 19-16 18 13-10 25H37Z',G('cloth'),outline,1.4);
    art+=P('m45 91 19 15 19-15m-44 12 13 25m37-25-13 25','none',outline,1.3);
    art+=jewel(64,108,5,legend?G('gem'):G('gold'));
    if(legend)for(const side of [-1,1])art+=`<g transform="translate(${side<0?0:128} 0) scale(${side<0?1:-1} 1)">${P('M23 102q8 0 12 8-13-2-12 9m8-15q8 0 12 8-12-3-11 8','none','#e0c58a',1)}</g>`;
    return art;
  }
  const necklace=(y=88)=>P(`M44 ${y}q20 23 40 0`,'none',G('gold'),2)+[46,54,64,74,82].map((x,i)=>C(x,y+[4,10,13,10,4][i],2.3,G('ivory'),'#a88a51',.7)).join('');
  function feline(a,legend=false) {
    let art='';
    if(a.design==='fox' && (legend||a.gear==='tails')) {
      const angles=legend?[-75,-56,-38,-19,0,19,38,56,75]:[-55,-28,0,28,55];
      art+=angles.map(angle=>`<g transform="rotate(${angle} 64 108)">${P('M58 110C20 85 36 40 53 16 66 31 72 63 67 105Z',G('ivory'),'#c1a77a',1)}${P('M53 16c-13 15-17 29-17 40q15-5 25-18Z',G('gold'),'none')}${P('M52 28q-12 31 7 65','none','#d9bf8c',.8)}</g>`).join('');
    }
    art+=mantle(a,legend);
    if(a.design==='lion') {
      art+=Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 64 63)">${P('M55 58Q34 24 58 10 75 27 72 59Z',G('gold'),'#8b663f',1)}${P('M58 20q-5 17 4 31','none','#f7dea0',.8)}</g>`).join('');
    }
    const fox=a.design==='fox'||a.design==='wolf';
    art+=P(fox?'M32 48 21 12l32 19q13-4 25 0l29-19-9 38 2 25-23 24H53L29 75Z':'M32 44 29 17l21 16q15-6 30 0l20-16-2 27q12 29-6 46-27 22-55 0-18-17-5-46Z',G('fur'));
    art+=P(fox?'m29 22 12 22-15 6m72-28-12 22 16 6':'m35 26 7 15-8 4m59-19-7 15 9 4',a.design==='cat'?'#a790ae':'#b69a98','#705a6b',.8);
    art+=P('M31 66 57 73q8 5 15 0l25-7q-5 32-32 34-27-1-34-34Z',G('ivory'),'#a58c78',.8);
    if(a.design==='tiger')art+=P('m60 33 4 16 5-16m-37 9 18 12-20-3m66-9L78 54l20-3M31 63l14 4m52-4-14 4','none','#304e4c',3.5);
    art+=animalEyes(49,60,a.design==='wolf'?'#6792b0':'#4b947e');
    art+=P('m57 76 7 5 7-5q-7-4-14 0Z','#6f5260','none')+P('M64 81v5m-7 1q7 5 14-1','none','#786663',1.1);
    if(a.design==='cat')art+=P('M37 77 19 73m18 11-19 3m73-10 18-4m-18 11 19 3','none','#d4c5b7',.8);
    if(legend&&a.design==='fox')art+=P('m40 65 7 4-9 2m50-6-7 4 9 2','#cb7e71','none')+P('M42 39q22 12 44 0','none',G('gold'),2)+jewel(64,44,5);
    if(a.gear==='wizard') art+=P('M24 44 52 5l15 8-5 4 29 23Z',G('cloth'),'#b2a0c2',1.3)+P('M18 46q43-18 88 0','none',G('gold'),4)+suit('spade',55,20,13,'#e8d69a');
    if(a.gear==='gem')art+=jewel(64,34,6);
    if(legend&&a.design==='lion')art+=P('m43 34-5-19 16 7 10-16 10 16 16-7-5 19Z',G('gold'),'#88613b',1.1)+jewel(64,27,4);
    if(a.design==='wolf')art+=P('M35 44 25 35l5 22m63-13 10-9-5 22','none','#eff4eb',1.4);
    return art;
  }
  function antler(a,legend=false) {
    let art='';
    const branch=side=>`<g transform="translate(${side<0?0:128} 0) scale(${side<0?1:-1} 1)">${P('M48 40C26 32 24 14 29 1M32 25 15 15l-1-12m22 30L9 29l-6-8m24-4 12-7 2-8','none',legend?G('gold'):'#c8b9a1',2.6)}${[[14,7],[28,3],[39,8],[7,27]].map(([x,y])=>legend?jewel(x,y,2.7,G('magic')):C(x,y,1.8,'#eae5d5')).join('')}</g>`;
    art+=branch(-1)+branch(1)+mantle(a,legend);
    art+=P('M46 49C29 43 21 31 24 23q20-1 27 13m31 13c17-6 25-18 22-26-20-1-27 13Z',G('fur'));
    art+=P('M48 39q17-13 32 2l4 32-13 24H56L44 73Z',G('ivory'));
    art+=P('m28 29 17 13m54-13L82 42','none','#cdaea2',2.5);
    art+=animalEyes(53,61,'#659ab1');
    art+=E(65,83,10,9,G('fur'),'#ab9b8b')+P('m61 81 5 3 5-3','#77616a','none')+smile(65,91);
    art+=C(55,49,1.7,'#fff5d9')+C(74,49,1.7,'#fff5d9')+jewel(64,47,3,G('gold'));
    if(legend)art+=P('M9 68q15 6 17 23M117 68q-15 6-17 23','none','#b5d3db',.8)+[18,37,88,109].map((x,i)=>star(x,[76,24,25,76][i],2.5)).join('');
    return art;
  }
  function reptile(a,legend=false) {
    let art='';
    if(legend)art+=P('M105 117C123 100 112 84 92 85 56 88 83 126 48 116 14 104 26 87 16 73c-7 30 12 59 43 55 39-4 12-39 37-33 13 3 12 15 9 22Z',G('fur'),'#355c58',1.3);
    art+=P('M32 88C9 77 9 48 6 30l29 27-2-32 22 39m41 24c23-11 23-40 26-58L93 57l2-32-22 39',G('cloth'),'#a1b3ac',1.1);
    art+=mantle(a,legend);
    art+=P('M43 45C23 41 17 16 27 5c-4 19 10 19 23 22m35 18c20-4 26-29 16-40 4 19-10 19-23 22Z',G('gold'),'#9f844d',1.1);
    art+=P('M45 32q19-17 37 4l4 29-8 26H48L37 65Z',G('fur'));
    art+=P('m39 49-19-7 5 21 20 11m42-25 20-7-6 21-20 11',G('cloth'),'#acc1ab',1.1);
    art+=P('m46 44 6-10 7 8 6-15 7 15 7-8 7 10',G('gold'),'#a48e57',.9);
    art+=animalEyes(50,58,legend?'#d8a54e':'#58aab4');
    art+=P('M44 72q19-12 39 0l2 12q-21 20-43 0Z',G('ivory'),'#b6a58a',.9)+P('M51 76v2m24-2v2M53 89q11 4 23-1','none','#647266',1.2);
    art+=Array.from({length:5},(_,i)=>P(`m${51+i*5} ${48-(i%2)*3} 2-2 2 2-2 2Z`,G('gold'),'none')).join('');
    if(a.id==='drago-zaffiro')art+=P('m23 106 15-12 12 15-12 16Zm55 3 12-15 15 12-11 19Z',G('metal'),'#c2cce0',1)+jewel(38,109,4,G('gem'))+jewel(90,109,4,G('gem'));
    if(a.id==='drago-porpora')art+=P('M43 32C15 28 7 16 14 3c1 14 17 12 30 13m41 16c28-4 36-16 29-29-1 14-17 12-30 13',G('ivory'),'#c6ac93',1)+P('M19 99q-9-22 1-34m89 34q9-22-1-34','none',G('magic'),2)+star(18,62,4)+star(110,62,4);
    if(legend)art+=P('M95 121 102 71','none',G('gold'),3)+C(102,65,9,G('gem'),'#d6bc7c',2)+C(99,62,2.3,'#eaf9e4')+P('m95 75 7 4 7-4','none','#ecd89a',1.4);
    return art;
  }
  function avian(a,legend=false) {
    if(a.design==='owl') {
      let art=mantle(a,legend)+P('m31 42-5-24 25 18q13-4 26 0l25-18-5 24 1 35q-6 27-34 25-29 1-35-25Z',G('fur'));
      art+=P('M32 44q20-12 32 4 12-16 32-4l-2 29q-10 24-30 11-20 13-30-11Z',G('ivory'),'#b2a395',1);
      for(const x of [47,81])art+=C(x,63,13,'#e7d7b2','#c3ad87',1)+C(x,63,9,G('gem'),'#617c76',1)+E(x,63,3,7,'#293f49')+C(x-2,59,2,'#fff9df');
      art+=P('m57 77 7 13 7-13Z',G('gold'),'#a88852',1)+P('M41 92q6 5 10 1m26 0q4 4 10-1','none','#dfc79c',1.2);
      art+=P('m38 34 2-18 14 9 10-17 10 17 14-9 2 18Z',G('gold'),'#977e50',1)+E(64,28,7,4,G('magic'),'#b6a3cc')+C(64,28,2,'#6c6a98');
      art+=P('M20 119 27 72','none',G('gold'),2)+C(26,68,7,G('magic'),'#cab0d5',1.4);
      return art;
    }
    if(a.id==='fenice') {
      // Fenice dorata in volo di profilo: ali arcuate e coda fluente.
      let art=P('M60 91C19 89-3 52 9 8l17 26-4-28 21 30 2-27 17 32 13-20-1 44Z',G('gold'),'#977748',1.2);
      art+=P('M52 86C30 74 17 49 16 27l18 23-2-26 18 29 2-21 15 30Z',G('flame'),'#b18b4e',.8);
      art+=P('M20 25q-4 30 28 53m-16-49q-1 27 22 45M46 28q0 23 14 38','none','#fff2bd',1.1);
      art+=P('M68 94c29-21 36-41 34-59l18 13c-1 22-18 41-43 50Z',G('gold'),'#b18c4f',1);
      art+=P('M65 99C16 94 5 117 18 128c8-25 32-13 48-11C40 108 27 124 41 128l31-11c10 4 11 8 11 11 15-15-3-26-18-29Z',G('gold'),'#b18c4f',1);
      art+=P('M71 113C42 103 39 77 53 60l10-18C59 18 84 13 94 29l18 7-18 9c-5 23-17 37-10 56Z',G('flame'),'#987043',1.1);
      art+=P('M63 46c-5 21-22 32-2 51-8-23 14-35 17-52Z',G('ivory'),'none');
      art+=P('m70 24-7-14 13 8 4-17 7 17 14-9-8 18',G('gold'),'#b79a58',.9);
      art+=eye(83,34,'#4d9e9a',-9)+P('m94 29 19 7-19 6Z',G('ivory'),'#b99c63',.9)+jewel(79,53,3,G('gem'));
      return art;
    }
    const solar=a.id==='fenice-solare';
    let art=solar?`<g opacity=".7">${C(64,39,35,G('gold'))}${C(64,39,39,'none','#f5d58c',.8)}${Array.from({length:24},(_,i)=>`<g transform="rotate(${i*15} 64 39)">${P('M64-7v5','none','#efd08b',1.2)}</g>`).join('')}</g>`:'';
    art+=P(solar?'M63 101C14 96 1 61 6 18l26 24L22 7l29 27L64 4l13 30 29-27-10 35 26-24c5 43-8 78-57 83Z':'M60 105C17 108-1 78 5 45l21 12C8 39 10 19 16 3l25 31C32 9 45-1 52 0l13 27L90 4c-3 23 1 33 16 44l17-9c6 35-13 62-55 66Z',G('flame'),'#96633e',1.1);
    for(const side of [-1,1])art+=`<g transform="translate(${side<0?0:128} 0) scale(${side<0?1:-1} 1)">${P('M60 94C34 91 16 65 14 38l17 19-4-22 19 25-2-22 17 30Z',G('gold'),'#d4a558',.8)}${P('M52 92C32 78 25 65 22 51m33 35C43 71 40 64 38 52','none','#fff1b3',1)}</g>`;
    art+=P('M54 116 47 128l17-7 17 7-8-12M52 69c-7 32-5 48 12 51 17-3 19-19 12-51Z',G('flame'),'#9e7f49',1)+P('M56 37C42 50 47 76 64 86c20-10 24-36 8-49L64 19Z',G('ivory'),'#b4975f',1);
    art+=eye(57,56,'#609a7d',-15)+eye(75,56,'#609a7d',15)+P('m61 65 3 12 6-12Z',G('gold'),'#9c733e',1);
    art+=P('M57 36 49 19l14 9 1-24 8 23 14-8-12 18',G('gold'),'#bb9654',.9)+jewel(66,44,3);
    if(legend)art+=Array.from({length:7},(_,i)=>star(16+i*16,97+(i%2)*7,2.5)).join('');
    return art;
  }
  function human(a,legend=false) {
    const queen=/regina|strega|guardiana/.test(a.id),king=a.id==='re-del-mazzo';
    let art=P('M25 107C5 49 26 9 64 12c34-1 55 36 39 92Z',G('hair'))+mantle(a,legend);
    art+=P('M47 84v11q17 13 34-1l-5-14Z',G('skin'),'#b79175',.9);
    art+=P('M43 40C40 16 85 13 88 41L85 67c-5 15-15 23-24 22-11-2-19-15-22-27Z',G('skin'),'#98796a',1.1);
    art+=P('M39 55C23 24 51 4 75 16c24 6 27 28 11 42l-3-20Q68 37 60 25 54 41 39 55Z',G('hair'),'#2a3547',1);
    art+=eye(51,56,queen?'#8296b3':'#6d9b87',-8)+eye(75,54,queen?'#8296b3':'#6d9b87',6)+P('m64 59-3 10 5 1','none','#ac806b',.85)+P('M57 77q8 3 15-2-8-4-15 2Z',queen?'#b66d74':'#ab7b6b','none');
    art+=P('M41 40q-9 22 4 45m43-47q10 24-6 48','none','#9082a0',1.4);
    if(king)art+=P('M44 69q5 11 17 12 14 0 23-14l-4 17-15 10-16-10Z',G('hair'),'#4b4651',.8)+P('M52 75q9-9 18-1','none','#63514b',2.2);
    if(queen)art+=C(42,69,2.2,G('gold'))+C(86,67,2.2,G('gold'))+jewel(42,75,3)+jewel(86,73,3);
    if(a.gear==='witch') {
      art+=P('M19 43 50 0l25 4-12 8 31 25Z',G('cloth'),'#a596bb',1.1)+P('M8 48q51-27 106-4','none',G('cloth'),8)+P('M25 40q35-15 65-3','none',G('gold'),2);
      art+=P('M61 8C45 9 49 28 65 25c-11-4-10-12-4-17Z','#e4d6a2','none');
    } else if(a.gear==='veil') {
      art+=P('M32 103C0 36 32-7 64 8c34-15 66 27 37 90l-7-48C88 14 48 10 36 50Z',G('magic'),'#b6b1cb',1.1)+P('M34 45Q61 3 94 44','none',G('gold'),1.4)+necklace();
    } else if(a.gear==='armor') {
      art+=P('M27 94 12 109l13 18h28l11-15 11 15h28l13-18-15-15-21 9-16-11-16 11Z',G('metal'),'#d4c594',1.2)+P('m28 101 18 12m54-12-18 12','none',G('gold'),2)+jewel(64,111,7,G('gold'));
    } else if(legend&&queen) {
      art+=P('m38 35-4-20 15 9 11-22 10 20 18-12-2 23Z',G('gold'),'#b69a68',1)+jewel(60,23,5,G('magic'))+P('M39 39q26 12 49-3','none','#ddce9e',1.2);
      art+=P('M35 45C10 59 17 85 35 97m57-56c29 11 27 43 7 59','none','#b0b4dc',1.3)+necklace(87);
      art+=[[24,68],[103,53],[93,97],[31,33],[71,12]].map(([x,y])=>star(x,y,3)).join('');
    } else {
      art+=P('m38 35-3-17 14 7 13-20 11 18 17-10-3 20Z',G('gold'),'#a18151',1.1)+jewel(62,25,4,a.suit==='heart'?'#cb7d78':G('gem'));
      if(queen)art+=necklace(87);
    }
    if(king) {
      art+=P('M27 111 18 94l-11 7 11 21m9-11-1-22 15-2 2 30m-16-6 12-20 14 6-11 21',G('ivory'),'#ad915f',1);
      art+=suit('heart',11,102,8,'#b76b5d')+suit('spade',29,96,8,'#547a76')+suit('diamond',41,101,8,'#b76b5d');
    }
    if(a.gear==='oracle')art+=P('M105 127 105 75','none',G('gold'),2)+C(105,70,8,G('gem'),'#e0c88c',1.8);
    return art;
  }
  function unicorn(a) {
    return P('M32 124C8 91 13 34 59 18 91 5 112 32 107 71L85 124Z',G('magic'),'#9a8cb0',1.1)+P('M53 29C28 31 38 56 26 76 12 93 43 105 63 88l25-22-4-30Z',G('ivory'),'#b3a598',1.1)+P('m43 31 4-23 12 17m17 0L87 5l1 31',G('ivory'),'#b3a598',1)+P('m62 29 9-29 4 31Z',G('gold'),'#ab915c',1)+P('m67 12 6 3m-8 4 8 3','none','#fff0c1',.8)+eye(53,53,'#9685b5',-12)+P('M30 77q10-8 19-4l-7 18c-13 7-23 0-16-11Z','#dfd1c8','#baaba0',.9)+C(33,79,1.6,'#a08480')+P('M70 30C113 24 79 78 97 110M85 30C119 54 86 97 89 123M77 34c24 36-14 67-1 90','none','#eee4eb',2)+necklace(93)+jewel(64,109,6,G('magic'));
  }
  function jolly(a,legend=false) {
    let art=mantle(a,legend)+P('M39 35q25-23 49 3l-1 33q-6 19-24 20-21-5-24-24Z',G('ivory'),'#a79688',1.1);
    art+=P('M64 29q23-8 24 9l-1 33q-6 19-23 20Z',G('gold'),'none');
    art+=P('M37 52q10-16 25 0 11-16 27 0l-3 14-22-7-24 8Z',G('cloth'),'#746580',1)+eye(49,55,'#8cb7af',-10)+eye(77,55,'#8c7eaf',10)+P('M54 76q13 11 24-4-14 8-24 4Z','#ac6f70','none');
    art+=P('M33 42 15 12C37-3 53 12 63 25 74-1 94-2 114 14L97 43l-16-9-17 5-15-6Z',G('cloth'),'#b6a3c1',1.2)+P('M64 26C50 5 62-1 68-2l18 36Z',G('gold'),'#a98b56',1);
    art+=P('M32 42q31-11 66 1','none',G('gold'),3)+[15,114,67].map((x,i)=>C(x,[13,15,1][i],4,G('gold'),'#b09259',.8)).join('');
    art+=P('m41 88 10 12 13-8 12 8 12-12-4 18-11 5-9-8-9 8-11-5Z',G('ivory'),'#d1bf9f',.8);
    art+=suit('diamond',54,111,13,G('gold'));
    if(legend)art+=P('M11 89C-1 70 14 52 24 57m77 10c19-8 32 10 16 26','none','#dfc88a',1.2)+C(18,98,9,G('magic'),'#d9be7c',1.2)+[[-4,0,'heart'],[0,-4,'spade'],[4,0,'diamond'],[0,4,'club']].map(([x,y,s])=>suit(s,14+x,94+y,7,'#fff3cb')).join('');
    return art;
  }
  function livingCard(a,legend=false) {
    let art=P('M32 104C0 102 2 67 7 37l31 26-9-48 30 30m37 59c32-2 30-37 25-67L90 63l9-48-30 30',G('cloth'),'#d4c9ae',1.1);
    art+=P('M31 8h66q7 0 7 7v101q0 7-7 7H31q-7 0-7-7V15q0-7 7-7Z',G('gold'),'#a1844c',1.3)+P('M34 15h60q3 0 3 3v95q0 3-3 3H34q-3 0-3-3V18q0-3 3-3Z',G('ivory'),'#ddc394',.8);
    art+=P('m36 34 5-13 5 13m-8-4h7m41 64 5 13 5-13m-8 4h7','none','#96723e',1.5);
    art+=suit(a.suit||'spade',42,44,44,legend?G('gold'):G('cloth'));
    art+=eye(55,67,'#79a99b',-8)+eye(76,67,'#79a99b',8)+P('M56 93q9 7 18-2','none','#b58c4b',1.5);
    for(const [x,y,s] of [[36,19,1],[92,19,-1],[36,110,1],[92,110,-1]])art+=`<g transform="translate(${x} ${y}) scale(${s} ${y>60?-1:1})">${P('M0 10Q0 0 11 0M3 10q0-7 7-7','none','#b99a5d',.9)}</g>`;
    if(legend)art+=P('M7 92 12 72l13 3-5 20ZM106 84l12-6 8 19-13 6Z',G('gold'),'#b69a61',1)+suit('heart',12,79,8,'#bf7c6c')+suit('club',113,86,8,'#466f70')+jewel(64,22,5,G('gem'))+jewel(64,113,4,G('gem'));
    return art;
  }
  function otherMyth(a) {
    if(a.design==='octopus')return P('M35 90C3 86-4 125 16 120c18-5 8-24 21-17-7 24 21 36 22 12 4 24 31 18 27-4 12 23 39 3 23-13-9-9-13 10-20-4Z',G('fur'),'#5f7f94',1.2)+P('M30 60C17 7 111 7 98 60l-7 37H38Z',G('fur'),'#4a657a',1.2)+E(47,64,10,13,G('ivory'),'#a7b6bd')+E(81,64,10,13,G('ivory'),'#a7b6bd')+animalEyes(49,64,'#a9a8c5')+smile(64,85)+P('M21 37 32 21 45 18l9-12h24l9 12 14 3 7 16-20 7H42Z',G('cloth'),'#d7c39b',1.4)+suit('spade',56,15,17,G('gold'))+P('M23 36q42-12 83 0','none',G('gold'),2)+P('M27 113 18 88l17-6 10 25Z',G('ivory'),'#b7aa91',1)+suit('diamond',25,92,10,'#bd8575');
    if(a.design==='mantis')return mantle(a)+P('M36 33 22 4m70 29L106 4','none',G('gold'),2)+P('m17 43 47-24 47 24-24 45H41Z',G('fur'),'#628d7e',1.2)+E(38,49,13,19,G('ivory'),'#a9c0a2')+E(90,49,13,19,G('ivory'),'#a9c0a2')+eye(40,51,'#86a873',-15)+eye(88,51,'#86a873',15)+P('m49 70 15 8 15-8','none','#668b70',1.1)+P('M41 117 26 86l-13 25 12-9m62 15 15-31 13 25-12-9','none',G('gold'),3)+jewel(64,36,4);
    // Grifone: becco e collare di penne, diverso dal muso del drago.
    return mantle(a)+P('M35 99C7 74 4 45 5 23l26 27-3-30 27 31m38 48c28-25 31-54 30-76L97 50l3-30-27 31',G('gold'),'#bca173',1)+P('M38 67C20 29 49 6 73 20 96 19 103 54 87 81l-25 19Z',G('ivory'),'#b8a783',1)+P('M42 39 29 20l25 10 13-18 3 19 22-11-7 24',G('gold'),'#b39a60',1)+animalEyes(49,54,'#698f82')+P('M55 64Q79 52 90 74L65 95 52 76Z',G('gold'),'#a88c56',1.1)+P('m61 69 13 1-7 13','none','#fff1be',1)+P('M38 76 46 92l8-7 8 15 8-15 11 7 7-16',G('ivory'),'#b5a483',.9);
  }
  function normalize(a) {
    const originals={
      're-cuori':{design:'human',color:'#d7aa84',accent:'#b27870',suit:'heart'},
      'regina-picche':{design:'human',color:'#e9c8a4',accent:'#8599b1',suit:'spade'},
      'jolly-corallo':{design:'jester',color:'#cf8f80',accent:'#829c91',suit:'diamond'},
      'jolly-zaffiro':{design:'jester',color:'#8f9fbb',accent:'#a999bc',suit:'diamond'},
      'leone':{design:'lion',color:'#d3ad68',accent:'#8da3af',suit:'spade'},
      'drago':{design:'dragon',color:'#6d9d86',accent:'#97b7aa',suit:'diamond'},
      'fenice':{design:'phoenix',color:'#dda85e',accent:'#c58267',suit:'heart'}
    };
    return {...a,...originals[a.id]};
  }
  function rareArt(a,fallback) {
    // Il ritratto rimane leggibile e sobrio: stoffe, fibbie, oro e luce modellata.
    const background=C(32,32,32,G('bg'))+P('M4 52Q3 12 32 7q31 4 28 45','none','#aac1c8',.45);
    const cloth=P('M10 64 16 49l13-6 3 9 4-9 13 6 5 15Z',G('cloth'),'#c5bb9d',.7)+P('m17 50 9 7m21-7-9 7M32 53v10','none','#d9c38b',.8)+jewel(32,55,2.3,G('gold'));
    const primary=({'re-cuori':'#f3ca96','regina-picche':'#f6d7b1','jolly-corallo':'#d67c63','jolly-zaffiro':'#689fb2',leone:'#edc46f'})[a.id]||a.color;
    const body=({'re-cuori':'#c76b54','regina-picche':'#5b8da1',leone:'#6999ae'})[a.id]||a.accent;
    let art=fallback.replaceAll(`fill="${primary}"`,`fill="${G(a.design==='human'?'skin':'fur')}"`).replaceAll(`fill="${body}"`,`fill="${G('cloth')}"`).replaceAll('fill="#fff0cb"',`fill="${G('ivory')}"`);
    const vest=P('M13 64 15 55l8-4 9 8 9-8 8 4 2 9Z',G('cloth'),'#a6a89c',.65)+P('m17 57 8 7m22-7-8 7','none','#ddc38a',.7)+jewel(32,58,2.3,G('gold'));
    let prop='';
    if(['wizard','moon','nightcap'].includes(a.gear))prop=P('M8 63 9 43','none',G('gold'),1.1)+C(9,40,4,G('magic'),'#d5bf8f',.8)+star(11,38,1,'#fff3c4');
    if(['tophat','pirate','admiral'].includes(a.gear))prop=P('m46 56 3-14 9 2-3 14Z',G('ivory'),'#aa946a',.6)+suit(a.suit,49,47,5,'#ad8571');
    if(a.gear==='goggles')prop=P('M8 61 8 50l-2-3h7l-2 3v11Z',G('gem'),'#b7a77e',.6)+P('M7 56h4','none','#d6e8d2',.7);
    return `<g>${background}${cloth}${art}${vest}${prop}${P('M14 44q2 8 6 9m30-9q-2 8-6 9','none','#fff1ce',.7)}${star(52,14,2,'#f1dc9c')}</g>`;
  }
  function art(entry,fallback) {
    if(entry.rarity==='common')return fallback;
    const a=normalize(entry),legend=a.rarity==='legendary';
    if(a.rarity==='rare')return definitions(a)+rareArt(a,fallback);
    let portrait;
    if(['fox','cat','wolf','tiger','lion'].includes(a.design))portrait=feline(a,legend);
    else if(a.design==='deer')portrait=antler(a,legend);
    else if(a.design==='dragon')portrait=reptile(a,legend);
    else if(a.design==='owl'||a.design==='phoenix')portrait=avian(a,legend);
    else if(a.design==='human')portrait=human(a,legend);
    else if(a.design==='unicorn')portrait=unicorn(a);
    else if(a.design==='jester')portrait=jolly(a,legend);
    else if(a.design==='card')portrait=livingCard(a,legend);
    else portrait=otherMyth(a);
    return definitions(a)+`<g transform="scale(.5)">${scene(a,legend)}${portrait}</g>`;
  }
  const api={art};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SmazzataAvatarPremium=api;
})(typeof globalThis!=='undefined'?globalThis:this);
