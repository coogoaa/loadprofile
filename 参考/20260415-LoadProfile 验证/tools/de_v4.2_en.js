// Germany Load + System Calculator v4.2 · DE · English
// v4.2 integrated with V1.13:
// 1) Keeps the v3 Load Profile / R-H / N system composition logic
// 2) Adds V1.13 step 3: 12x24 energy flow + daily battery-cycle simulation
// 3) Adds V1.13 step 4: DE cashflow, IRR, NPV, and payback
// 4) Optional panel_location.json upload; falls back to DE generation curves for added PV
// 5) v4.2: existing PV annual yield uses state fallback, while the shape prefers panel_location monthlyHourlyPowerList scaled to that annual total
// -- Parameters --
const DE_STATES=[['BW','Baden-Württemberg','Baden-Wuerttemberg',3210,1123],['BY','Bavaria','Bavaria',3302,1123],['BE','Berlin','Berlin',2469,1055],['BB','Brandenburg','Brandenburg',3082,1052],['HB','Bremen','Bremen',2944,991],['HH','Hamburg','Hamburg',2740,985],['HE','Hesse','Hesse',3327,1079],['NI','Lower Saxony','Lower Saxony',3411,1017],['MV','Mecklenburg-Vorpommern','Mecklenburg-Vorpommern',2856,1022],['NW','North Rhine-Westphalia','North Rhine-Westphalia',3280,1035],['RP','Rhineland-Palatinate','Rhineland-Palatinate',3321,1100],['SL','Saarland','Saarland',3321,1089],['SN','Saxony','Saxony',2845,1067],['ST','Saxony-Anhalt','Saxony-Anhalt',3133,1074],['SH','Schleswig-Holstein','Schleswig-Holstein',3221,983],['TH','Thuringia','Thuringia',2994,1041]];
const BASE={},YIELD={};DE_STATES.forEach(r=>{BASE[r[0]]=r[3];YIELD[r[0]]=r[4];});
const DE_MONTHLY=[0.0789,0.0791,0.0773,0.0822,0.0839,0.0876,0.0917,0.0887,0.0853,0.0838,0.0819,0.0796];
const DE_GEN_MONTHLY=[0.022,0.0385,0.0725,0.1128,0.144,0.1514,0.1505,0.1294,0.0881,0.0514,0.0229,0.0165];
const DAYS_IN_MONTH=[31,28,31,30,31,30,31,31,30,31,30,31];
const DE_HOURLY=[0.0301,0.0258,0.0239,0.0232,0.0236,0.0252,0.03,0.0358,0.041,0.0446,0.0474,0.0518,0.0513,0.0481,0.0459,0.0454,0.0475,0.0535,0.0587,0.0591,0.0556,0.0508,0.0451,0.0366];
const MONTH_FLAGS=[[1,0,1,'Winter'],[2,0,1,'Winter'],[3,0,1,'Spring'],[4,0,1,'Spring'],[5,0,0,'Spring'],[6,1,0,'Summer'],[7,1,0,'Summer'],[8,1,0,'Summer'],[9,0,0,'Autumn'],[10,0,1,'Autumn'],[11,0,1,'Autumn'],[12,0,1,'Winter']];
const COOL_M=MONTH_FLAGS.map(r=>r[1]),HEAT_M=MONTH_FLAGS.map(r=>r[2]);
const HOUR_FLAGS=[[0,0,0,0,0,0],[1,0,0,0,0,0],[2,0,0,0,0,0],[3,0,0,0,0,0],[4,0,0,0,0,0],[5,0,0,0,0,0],[6,0,0,1,0,0],[7,0,0,1,0,0],[8,0,0,1,1,0],[9,1,0,1,1,0],[10,1,0,0,1,0],[11,1,0,0,0,0],[12,1,0,0,0,0],[13,1,0,0,0,0],[14,1,1,0,0,0],[15,1,1,0,0,0],[16,1,1,0,0,0],[17,1,1,0,0,0],[18,0,1,1,0,1],[19,0,1,1,0,1],[20,0,0,1,0,1],[21,0,0,1,0,0],[22,0,0,1,0,0],[23,0,0,0,0,0]];
const DTH=new Set(HOUR_FLAGS.filter(r=>r[1]).map(r=>r[0]));
const CPH=new Set(HOUR_FLAGS.filter(r=>r[2]).map(r=>r[0]));
const HPH=new Set(HOUR_FLAGS.filter(r=>r[3]).map(r=>r[0]));
const HVAC={"No heating or cooling system":0,"Air conditioning":0,"Electric heating":3000,"Heat pump (heating & cooling)":2000};
const UC={Low:{am:0.7,cmm:1.05,hmm:1.08,cpm:1.10,hpm:1.08},Medium:{am:1.0,cmm:1.10,hmm:1.15,cpm:1.20,hpm:1.15},High:{am:1.3,cmm:1.20,hmm:1.25,cpm:1.35,hpm:1.25},"Very high":{am:1.6,cmm:1.35,hmm:1.40,cpm:1.50,hpm:1.40}};
const OCC={"Mostly away during the day":0.6,"Working from home":1.4,"Someone always at home":1.2};
const EVP={mostly_overnight:[0.125,0.125,0.125,0.125,0.125,0.125,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.125,0.125],mixed_day_and_night:[0.075,0.075,0.075,0.075,0.075,0.075,0,0,0,0,0.067,0.067,0.067,0.067,0.067,0.067,0,0,0,0,0,0,0.075,0.075],mostly_daytime:[0,0,0,0,0,0,0,0,0,0,0.167,0.167,0.167,0.167,0.167,0.167,0,0,0,0,0,0,0,0],solar_optimized:[0.025,0.025,0.025,0.025,0.025,0.025,0,0,0,0.04,0.072,0.104,0.128,0.136,0.128,0.104,0.088,0,0,0,0,0,0.025,0.025]};
const PV_PANEL={p_kw:0.470,L_mm:1903,W_mm:1134};
const PANEL_AREA=1.903*1.134;
const ROOF_TILT_DEG=40,ROOF_USE_RATIO=0.45;
const TIER_TARGET={A:{base:7.05,boost:7.05,ratio:0.7},B:{base:10.34,boost:13.16,ratio:0.9},C:{base:13.16,boost:15.04,ratio:1.2}};
const BATT_SPECS=[5,6.5,9.6,10,13.5,16,20,25,30,35,40,45,50];
const PV_HARDCAP=25,REMAIN_MIN_RH=2.0;
// v3: cap the branch-2 back-calculated existing_pv_kwp at 13.16 kWp (= default C-tier target), avoiding values above the C target.
const EXISTING_PV_BR2_CAP=13.16;
const SCR_TARGET=1.30,SCR_MAX=1.50,INV_MAX_KW=24;
const INV_SPECS={A:[5,6,8,10,12,15],B:[5,6,8,10,12,15],C:[5,6,8,10,12,15,18,20,22]};
const COST={pv_eur_per_kwp:550,inv_eur_per_kwp:330,batt_eur_per_kwh:400,grid_buy:0.35,grid_sell:0.07,daily_fixed:0.7,inflation:0.02,cash_rate:0.035,gst_rate:0};
const BATT_DOD=0.9,BATT_RTE=0.95,DEFAULT_ROI_YEARS=20;
const SOLAR_HOURLY=[0,0,0,0,0,0,0.015,0.045,0.075,0.105,0.13,0.145,0.15,0.14,0.12,0.095,0.06,0.025,0.005,0,0,0,0,0];
const COOL_SYS=new Set(["Air conditioning","Heat pump (heating & cooling)"]);
const HEAT_SYS=new Set(["Electric heating","Heat pump (heating & cooling)"]);
const EV_KWH_PER_KM=0.18;
const MNZ=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SYS_ZH={"No heating or cooling system":"No heating or cooling system","Air conditioning":"Air conditioning","Electric heating":"Electric heating","Heat pump (heating & cooling)":"Heat pump (heating and cooling)"};
const USE_ZH={Low:"Low",Medium:"Medium",High:"High","Very high":"Very high"};
const OCC_ZH={"Mostly away during the day":"Mostly away during the day","Working from home":"Working from home","Someone always at home":"Someone always at home"};

// -- Utilities --
const f2=(v,d=2)=>v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const f0=v=>Math.round(v).toLocaleString('en-US');
const fp=v=>v.toFixed(2)+'%';
const esc=s=>(''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const srcTag=f=>`<span class="src-tag">📄 ${f}</span>`;
function ceilToSpec(v,specs){for(const s of specs){if(s>=v)return s;}return specs[specs.length-1];}
function blk(n,title,badge,content,open=false,kls=''){
  const cls=kls?'sblock '+kls:'sblock', sn=kls?'snum '+kls:'snum';
  return `<div class="${cls}"><div class="shdr${open?' open':''}"><span class="${sn}">Step ${n}</span><span class="stit">${title}</span><span class="sbadge">${badge}</span><span class="chev${open?' open':''}">▶</span></div><div class="sbody${open?' open':''}">${content}</div></div>`;
}
function bindSblock(){
  document.querySelectorAll('.shdr').forEach(el=>{
    el.addEventListener('click',()=>{
      const b=el.nextElementSibling,ch=el.querySelector('.chev'),o=b.classList.contains('open');
      b.classList.toggle('open',!o);el.classList.toggle('open',!o);ch&&ch.classList.toggle('open',!o);
    });
  });
}

// -- Calculations --
function calcLoad(state,system,usage,miles,occ,evc){
  const base=BASE[state],u=UC[usage]||UC.Medium;
  const sf={c:COOL_M,h:HEAT_M},bms=DE_MONTHLY,hb=DE_HOURLY;
  const ev_dist=EVP[evc]||EVP.mostly_overnight,occ_v=OCC[occ]||1.0,t_base=HVAC[system]||0;
  const pc=COOL_SYS.has(system),ph=HEAT_SYS.has(system);
  const t_ext=t_base*u.am,ev_ext=miles*EV_KWH_PER_KM,final=base+t_ext+ev_ext;
  const sm=bms.map((_,i)=>1+(pc&&sf.c[i]?u.cmm-1:0)+(ph&&sf.h[i]?u.hmm-1:0));
  const rb=bms.map((v,i)=>base*v*sm[i]),srb=rb.reduce((a,b)=>a+b,0),nb=rb.map(v=>v/srb*base);
  const tw=bms.map((v,i)=>(pc&&sf.c[i]?v*u.cmm:0)+(ph&&sf.h[i]?v*u.hmm:0));
  const stw=tw.reduce((a,b)=>a+b,0),ta=tw.map(w=>stw>0?w/stw*t_ext:0),ea=bms.map(()=>ev_ext/12);
  const fkm=bms.map((_,i)=>nb[i]+ta[i]+ea[i]),fsm=fkm.map(v=>v/final);
  const om=Array.from({length:24},(_,h)=>DTH.has(h)?occ_v:1.0);
  const pm=Array.from({length:24},(_,h)=>(pc&&CPH.has(h)?u.cpm:1)*(ph&&HPH.has(h)?u.hpm:1));
  const adj=Array.from({length:24},(_,h)=>hb[h]*om[h]*pm[h]),sadj=adj.reduce((a,b)=>a+b,0),ns=adj.map(v=>v/sadj);
  const dne=(base+t_ext)/365,dev=ev_ext/365,nek=ns.map(v=>dne*v),evk=ev_dist.map(v=>dev*v);
  const fkd=Array.from({length:24},(_,h)=>nek[h]+evk[h]),davg=final/365,fhs=fkd.map(v=>v/davg);
  const dtk=[...DTH].reduce((a,h)=>a+fkd[h],0);
  const epk=[18,19,20].reduce((a,h)=>a+fkd[h],0);
  const onk=[18,19,20,21,22,23,0,1,2,3,4,5].reduce((a,h)=>a+fkd[h],0);
  return{state,system,usage,miles,occ,evc,base,t_base,t_ext,ev_ext,final,u,pc,ph,sf,bms,hb,ev_dist,occ_v,sm,rb,srb,nb,ta,ea,fkm,fsm,om,pm,adj,sadj,ns,nek,evk,fkd,davg,dne,dev,fhs,dtk,dtp:dtk/davg*100,epk,epp:epk/davg*100,onk,onp:onk/davg*100};
}
function calcRH(existing_input,sam3d,mask2d,tier,system,miles){
  let existing=existing_input;
  const userKnown=existing>=0;
  const cos40=Math.cos(ROOF_TILT_DEG*Math.PI/180);
  const roof_area_m2=mask2d/cos40;
  const usable_area_m2=roof_area_m2*ROOF_USE_RATIO;
  const max_panels_area=Math.floor(usable_area_m2/PANEL_AREA);
  const roof_full_kwp_area=max_panels_area*PV_PANEL.p_kw;
  const roof_full_kwp_3d=sam3d;
  let remaining,branch,existing_out;
  if(userKnown){
    if(roof_full_kwp_3d-existing>=PV_PANEL.p_kw){remaining=Math.max(0,roof_full_kwp_3d-existing);branch=1;}
    else if(roof_full_kwp_3d-existing<0){remaining=Math.max(0,roof_full_kwp_area-existing);branch=1.5;}
    else{remaining=Math.max(0,roof_full_kwp_area-existing);branch=3;}
    existing_out=existing;
  }else{
    // v3 branch 2: user skipped existing PV.
    //   remaining       = roof_full_kwp_3d x 0.55
    //   existing_pv_kwp = min(roof_full_kwp_3d x 0.45, 13.16), capped below the C-tier target.
    remaining=roof_full_kwp_3d*0.55;
    const existing_raw=roof_full_kwp_3d*0.45;
    existing_out=Math.min(existing_raw,EXISTING_PV_BR2_CAP);
    var br2_existing_raw=existing_raw,br2_capped=existing_raw>EXISTING_PV_BR2_CAP;
    branch=2;
  }
  const remaining_capped=Math.max(0,Math.min(remaining,PV_HARDCAP-existing_out));
  let mode;
  if(existing_out>=PV_HARDCAP) mode='R-B';
  else if(remaining_capped<REMAIN_MIN_RH) mode='R-B';
  else mode='R-H';
  const trigger=(miles>0)||system==='Heat pump (heating & cooling)'||system==='Electric heating';
  const tierObj=TIER_TARGET[tier];
  const target_pv_total=trigger?tierObj.boost:tierObj.base;
  const ratio=tierObj.ratio;
  let target_added=0,added_kwp_pre=0,added_panels=0,added_kwp=0,PV_total=existing_out;
  if(mode==='R-H'){
    target_added=Math.max(0,target_pv_total-existing_out);
    added_kwp_pre=Math.min(target_added,remaining_capped);
    added_panels=Math.floor(added_kwp_pre/PV_PANEL.p_kw);
    added_kwp=added_panels*PV_PANEL.p_kw;
    PV_total=existing_out+added_kwp;
  }
  const bat_target=PV_total*ratio;
  const bat_kWh=ceilToSpec(Math.max(5,bat_target),BATT_SPECS);
  return{existing_input,userKnown,existing:existing_out,cos40,roof_area_m2,usable_area_m2,max_panels_area,roof_full_kwp_area,roof_full_kwp_3d,remaining,remaining_capped,branch,mode,trigger,tier,ratio,target_pv_total,target_added,added_kwp_pre,added_panels,added_kwp,PV_total,bat_target,bat_kWh,mask2d,sam3d,br2_existing_raw:typeof br2_existing_raw!=='undefined'?br2_existing_raw:null,br2_capped:typeof br2_capped!=='undefined'?br2_capped:false,br2_cap:EXISTING_PV_BR2_CAP};
}
function pickInverter(pv_kwp,tier){
  const specs=INV_SPECS[tier].slice();
  const target_kw=pv_kwp/SCR_TARGET;
  let inv_kw=specs.find(s=>s>=target_kw);
  let action='ok',curtailed=false,curtail_panels=null,final_pv=pv_kwp,scr;
  if(!inv_kw){
    inv_kw=specs[specs.length-1];
    scr=pv_kwp/inv_kw;
    if(scr>SCR_MAX){
      const max_pv=inv_kw*SCR_MAX;
      curtail_panels=Math.floor(max_pv/PV_PANEL.p_kw);
      final_pv=curtail_panels*PV_PANEL.p_kw;
      curtailed=true;action='curtail';scr=final_pv/inv_kw;
    }else action='maxed-but-ok';
  }else scr=pv_kwp/inv_kw;
  return{target_kw,inv_kw,scr,scr_pct:scr*100,action,curtailed,curtail_panels,final_pv,specs};
}
function calcN(load,tier,sam3d,mask2d){
  const trigger=(load.miles>0)||load.system==='Heat pump (heating & cooling)'||load.system==='Electric heating';
  const tierObj=TIER_TARGET[tier];
  const target_pv_total=trigger?tierObj.boost:tierObj.base;
  const target_pv_capped=Math.min(target_pv_total,PV_HARDCAP);
  // v3: N scenario adds a roof physical constraint: when SAM3D full-roof is below the tier target, PV is capped at SAM3D.
  const sam3d_v=Math.max(0,sam3d||0);
  const roof_capped=Math.min(target_pv_capped,sam3d_v);
  const roof_limited=sam3d_v>0&&sam3d_v<target_pv_capped;
  // Round up to whole panels when possible, without exceeding the SAM3D cap.
  let panels=Math.floor(roof_capped/PV_PANEL.p_kw);
  // Compatibility: use ceil when it still fits within SAM3D, staying closer to target.
  const panels_ceil=Math.ceil(roof_capped/PV_PANEL.p_kw);
  if(panels_ceil*PV_PANEL.p_kw<=sam3d_v+1e-9) panels=panels_ceil;
  if(panels*PV_PANEL.p_kw>PV_HARDCAP) panels=Math.floor(PV_HARDCAP/PV_PANEL.p_kw);
  const pv_pre=panels*PV_PANEL.p_kw;
  const inv=pickInverter(pv_pre,tier);
  const actual_pv=inv.final_pv;
  const actual_panels=Math.round(actual_pv/PV_PANEL.p_kw);
  const ratio=tierObj.ratio;
  const bat_target=actual_pv*ratio;
  const bat_kWh=ceilToSpec(Math.max(5,bat_target),BATT_SPECS);
  return{trigger,tier,ratio,target_pv_total,target_pv_capped,roof_capped,roof_limited,sam3d:sam3d_v,mask2d:mask2d||0,panels,pv_pre,inv,actual_pv,actual_panels,bat_target,bat_kWh};
}

// -- V1.13 steps 3/4: panel selection, energy flow, ROI --
let uploadedPanels=[];
let uploadedPanelName='';
const DEFAULT_PROJECT_BASE_URL='https://file.greensketch.ai/marketing/test/debug';
let projectBaseUrl=DEFAULT_PROJECT_BASE_URL;
let activeProject=null;
let activeProjectInputs=null;
let projectStatus={type:'idle',text:'Enter a project ID to fetch request / panel_location / detect_building and auto-fill this page.'};

const STATE_ALIASES={
  NRW:'NW','NORTH RHINE WESTPHALIA':'NW','NORTH RHINE-WESTPHALIA':'NW','NORDRHEIN WESTFALEN':'NW','NORDRHEIN-WESTFALEN':'NW',
  BAVARIA:'BY',BAYERN:'BY','BADEN WURTTEMBERG':'BW','BADEN-WURTTEMBERG':'BW',
  LOWER_SAXONY:'NI','LOWER SAXONY':'NI',NIEDERSACHSEN:'NI',
  HESSE:'HE',HESSEN:'HE','RHINELAND PALATINATE':'RP','RHINELAND-PALATINATE':'RP','RHEINLAND PFALZ':'RP','RHEINLAND-PFALZ':'RP',
  SAARLAND:'SL',SAXONY:'SN',SACHSEN:'SN','SAXONY ANHALT':'ST','SAXONY-ANHALT':'ST','SACHSEN ANHALT':'ST','SACHSEN-ANHALT':'ST',
  'SCHLESWIG HOLSTEIN':'SH','SCHLESWIG-HOLSTEIN':'SH',THURINGIA:'TH',THUERINGEN:'TH','THÜRINGEN':'TH',
  BRANDENBURG:'BB',BERLIN:'BE',BREMEN:'HB',HAMBURG:'HH','MECKLENBURG VORPOMMERN':'MV','MECKLENBURG-VORPOMMERN':'MV'
};
const FORM_MAP={
  q1:{
    mostly_away:'Mostly away during the day',
    mostly_away_during_the_day:'Mostly away during the day',
    working_from_home:'Working from home',
    someone_always_home:'Someone always at home'
  },
  q2:{
    no_system:'No heating or cooling system',
    none:'No heating or cooling system',
    air_con:'Air conditioning',
    air_conditioning:'Air conditioning',
    heat_pump:'Heat pump (heating & cooling)',
    electric_heat:'Electric heating',
    electric_heating:'Electric heating'
  },
  q3:{low:'Low',medium:'Medium',high:'High',very_high:'Very high'},
  q5:{
    mostly_overnight:'mostly_overnight',
    mixed_day_and_night:'mixed_day_and_night',
    mostly_daytime:'mostly_daytime',
    solar_optimized:'solar_optimized'
  }
};

function sum2d(matrix){
  return matrix.reduce((a,row)=>a+row.reduce((x,y)=>x+(Number(y)||0),0),0);
}
function matrixAnnualTotal(matrix){
  return (matrix||[]).reduce((a,row,m)=>a+row.reduce((x,y)=>x+(Number(y)||0),0)*(DAYS_IN_MONTH[m]||0),0);
}
function addMatrix(a,b){
  return a.map((row,m)=>row.map((v,h)=>v+(b[m]?.[h]||0)));
}
function emptyMatrix(){
  return Array.from({length:12},()=>Array(24).fill(0));
}
function selectPanels(panels,n){
  if(!Array.isArray(panels)||n<=0)return[];
  return panels.slice().sort((a,b)=>((b.generationPower||{}).annualGeneratePower||0)-((a.generationPower||{}).annualGeneratePower||0)).slice(0,n);
}
function buildGenerationMatrix(panels){
  const gen=emptyMatrix();
  let total=0;
  (panels||[]).forEach(p=>{
    const gp=p.generationPower||{};
    const before=matrixAnnualTotal(gen);
    const mh=gp.monthlyHourlyPowerList||[];
    if(mh.length===12){
      mh.forEach((row,m)=>{
        if(Array.isArray(row)&&row.length===24){
          row.forEach((v,h)=>{gen[m][h]+=Number(v)||0;});
        }
      });
    }
    const matrixDelta=matrixAnnualTotal(gen)-before;
    total+=Number(gp.annualGeneratePower)||matrixDelta||0;
  });
  return{gen,total};
}
function scaleMatrixToAnnual(shape,annual){
  const shapeAnnual=matrixAnnualTotal(shape);
  if(!(shapeAnnual>0)||!(annual>0))return null;
  const factor=annual/shapeAnnual;
  return{gen:shape.map(row=>row.map(v=>(Number(v)||0)*factor)),shapeAnnual,factor};
}
function buildPanelShapeMatrix(panels){
  const gen=emptyMatrix();
  let panelCount=0;
  (panels||[]).forEach(p=>{
    const mh=(p.generationPower||{}).monthlyHourlyPowerList||[];
    if(mh.length!==12)return;
    let valid=true;
    for(let m=0;m<12;m++){
      if(!Array.isArray(mh[m])||mh[m].length!==24){valid=false;break;}
    }
    if(!valid)return;
    panelCount++;
    mh.forEach((row,m)=>row.forEach((v,h)=>{gen[m][h]+=Number(v)||0;}));
  });
  return{gen,total:matrixAnnualTotal(gen),panelCount};
}
function buildExistingPVMatrix(existing_kwp,state,panels){
  if(existing_kwp<=0)return{gen:emptyMatrix(),total:0,source:'No existing PV',source_type:'none',panel_shape_count:0,panel_shape_annual:0,scale_factor:null};
  const annual=existing_kwp*(YIELD[state]||1000);
  const shape=buildPanelShapeMatrix(panels);
  const scaled=shape.panelCount>0?scaleMatrixToAnnual(shape.gen,annual):null;
  if(scaled){
    return{
      gen:scaled.gen,
      total:annual,
      source:'panel_location monthlyHourlyPowerList (scaled to state fallback annual yield)',
      source_type:'panel_shape_scaled',
      panel_shape_count:shape.panelCount,
      panel_shape_annual:scaled.shapeAnnual,
      scale_factor:scaled.factor
    };
  }
  const gen=emptyMatrix();
  for(let m=0;m<12;m++){
    const daily=annual*DE_GEN_MONTHLY[m]/DAYS_IN_MONTH[m];
    for(let h=0;h<24;h++)gen[m][h]=daily*DE_HOURLY[h];
  }
  return{gen,total:annual,source:'DE fallback (monthly generation share + hourly fallback)',source_type:'fallback',panel_shape_count:0,panel_shape_annual:0,scale_factor:null};
}
function buildFallbackGenerationMatrix(pv_kwp,state){
  // When panel_location.json is absent, use the V1.13 fallback split for existing PV.
  return buildExistingPVMatrix(pv_kwp,state,[]);
}
function buildLoadMatrix(loadProfile){
  const fkm=loadProfile.fkm;
  const davg=loadProfile.davg;
  let hShare=davg>0?loadProfile.fkd.map(v=>v/davg):Array(24).fill(1/24);
  const s=hShare.reduce((a,b)=>a+b,0);
  hShare=s>0?hShare.map(v=>v/s):Array(24).fill(1/24);
  const load=emptyMatrix();
  for(let m=0;m<12;m++){
    const daily=fkm[m]/DAYS_IN_MONTH[m];
    for(let h=0;h<24;h++)load[m][h]=daily*hShare[h];
  }
  return{load,hShare};
}
function simulateBattery(gen,load,bat_capacity_kwh){
  const usable=bat_capacity_kwh*BATT_DOD;
  const rte=BATT_RTE;
  let directT=0,dischT=0,chargeT=0,exportT=0,importT=0,genT=0,loadT=0;
  const monthly=[];
  for(let m=0;m<12;m++){
    const days=DAYS_IN_MONTH[m];
    let soc=0,mDirect=0,mDisch=0,mCharge=0,mExport=0,mImport=0;
    const mGen=sum2d([gen[m]])*days;
    const mLoad=sum2d([load[m]])*days;
    for(let d=0;d<days;d++){
      for(let h=0;h<24;h++){
        const g=gen[m][h],l=load[m][h];
        const direct=Math.min(g,l);
        const surplus=g-direct;
        const deficit=l-direct;
        const charge=Math.min(surplus,Math.max(0,usable-soc));
        soc+=charge;
        const discharge=Math.min(deficit,soc*rte);
        soc-=rte>0?discharge/rte:0;
        soc=Math.max(0,soc);
        mDirect+=direct;
        mDisch+=discharge;
        mCharge+=charge;
        mExport+=surplus-charge;
        mImport+=deficit-discharge;
      }
    }
    directT+=mDirect;dischT+=mDisch;chargeT+=mCharge;exportT+=mExport;importT+=mImport;genT+=mGen;loadT+=mLoad;
    monthly.push({month:m+1,gen_kwh:mGen,load_kwh:mLoad,direct:mDirect,discharge:mDisch,charge:mCharge,export:mExport,import_grid:mImport,self_use:mDirect+mDisch,SCR:mGen>0?(mDirect+mDisch)/mGen:0});
  }
  const selfUse=directT+dischT;
  return{gen_total:genT,load_total:loadT,direct:directT,discharge:dischT,charge:chargeT,export:exportT,import_grid:importT,self_use:selfUse,SCR:genT>0?selfUse/genT:0,SSR:loadT>0?selfUse/loadT:0,monthly,usable_capacity:usable};
}
function buildEnergyFlow(mode,loadProfile,composition,panels){
  const {load,hShare}=buildLoadMatrix(loadProfile);
  const state=loadProfile.state;
  if(mode==='R'){
    const rh=composition.rh;
    const actualPanels=Math.floor((composition.inv.final_pv||rh.PV_total)/PV_PANEL.p_kw);
    const chosen=selectPanels(panels,actualPanels);
    const addedChosen=chosen.slice(0,rh.added_panels);
    const existingGen=buildExistingPVMatrix(rh.existing,state,panels);
    const addedGen=addedChosen.length>0?buildGenerationMatrix(addedChosen):buildFallbackGenerationMatrix(rh.added_kwp,state);
    const gen=addMatrix(existingGen.gen,addedGen.gen);
    const sim=simulateBattery(gen,load,rh.bat_kWh);
    const addedSource=addedChosen.length>0?uploadedPanelName:'DE fallback';
    return{mode,gen,load,hShare,totals:sim,gen_info:{existing_kwp:rh.existing,existing_gen_total:existingGen.total,existing_source:existingGen.source,existing_source_type:existingGen.source_type,existing_shape_panels:existingGen.panel_shape_count,existing_shape_annual:existingGen.panel_shape_annual,existing_shape_scale:existingGen.scale_factor,added_panels:rh.added_panels,added_gen_total:addedGen.total,total_gen_total:existingGen.total+addedGen.total,added_source:addedSource,source:'Existing PV: '+existingGen.source+'; added PV: '+addedSource},matrix_gen_existing:existingGen.gen,matrix_gen_added:addedGen.gen};
  }
  const n=composition.n;
  const chosen=selectPanels(panels,n.actual_panels);
  const genPack=chosen.length>0?buildGenerationMatrix(chosen):buildFallbackGenerationMatrix(n.actual_pv,state);
  const sim=simulateBattery(genPack.gen,load,n.bat_kWh);
  return{mode,gen:genPack.gen,load,hShare,totals:sim,gen_info:{existing_kwp:0,existing_gen_total:0,added_panels:n.actual_panels,added_gen_total:genPack.total,total_gen_total:genPack.total,source:chosen.length>0?uploadedPanelName:'DE fallback'}};
}
function computeSysCost(mode,composition){
  const isR=mode==='R';
  const pvBasis=isR?composition.rh.added_kwp:composition.n.actual_pv;
  const invKw=isR?composition.inv.inv_kw:composition.n.inv.inv_kw;
  const batKwh=isR?composition.rh.bat_kWh:composition.n.bat_kWh;
  const pvCost=pvBasis*COST.pv_eur_per_kwp;
  const invCost=invKw*COST.inv_eur_per_kwp;
  const batCost=batKwh*COST.batt_eur_per_kwh;
  const subtotal=pvCost+invCost+batCost;
  const gst=subtotal*COST.gst_rate;
  return{pv_basis_kwp:pvBasis,inv_kw:invKw,bat_kwh:batKwh,pv_cost:pvCost,inv_cost:invCost,bat_cost:batCost,subtotal,gst,total:subtotal+gst};
}
function npv(rate,cashFlows){
  return cashFlows.reduce((a,cf,t)=>a+cf/Math.pow(1+rate,t),0);
}
function irr(cashFlows){
  if(cashFlows.every(v=>v>=0)||cashFlows.every(v=>v<=0))return null;
  let r=0.1;
  for(let i=0;i<200;i++){
    let f=0,fpd=0;
    cashFlows.forEach((cf,t)=>{f+=cf/Math.pow(1+r,t);fpd+=-t*cf/Math.pow(1+r,t+1);});
    if(Math.abs(fpd)<1e-12)break;
    const nr=r-f/fpd;
    if(!Number.isFinite(nr)||nr<=-0.99)break;
    if(Math.abs(nr-r)<1e-6)return nr;
    r=nr;
  }
  let lo=-0.99,hi=1.0;
  for(let i=0;i<200;i++){
    const mid=(lo+hi)/2;
    if(npv(mid,cashFlows)>0)lo=mid;else hi=mid;
  }
  return(lo+hi)/2;
}
function paybackPeriod(cashFlows){
  let cum=0;
  for(let t=0;t<cashFlows.length;t++){
    const prev=cum;
    cum+=cashFlows[t];
    if(prev<0&&cum>=0){
      const cf=cashFlows[t];
      return cf!==0?(t-1)+(-prev/cf):t;
    }
  }
  return null;
}
function buildCashflow(years,sysCost,efTotals){
  const loadTotal=efTotals.load_total,importGrid=efTotals.import_grid,exportGrid=efTotals.export;
  const fixed=COST.daily_fixed*365;
  const rows=[{year:0,baseline_cost:0,remain_cost:0,export_income:0,saving:0,cash_flow:-sysCost,cumulative:-sysCost}];
  const cashFlows=[-sysCost];
  let cum=-sysCost;
  for(let t=1;t<=years;t++){
    const factor=Math.pow(1+COST.inflation,t-1);
    const baseline=loadTotal*COST.grid_buy*factor+fixed;
    const remain=importGrid*COST.grid_buy*factor+fixed;
    const exportIncome=exportGrid*COST.grid_sell;
    const saving=baseline-remain+exportIncome;
    cum+=saving;
    cashFlows.push(saving);
    rows.push({year:t,baseline_cost:baseline,remain_cost:remain,export_income:exportIncome,saving,cash_flow:saving,cumulative:kumSafe(cum)});
  }
  return{cashFlows,rows};
}
function kumSafe(v){return Math.abs(v)<1e-9?0:v;}
function buildROI(mode,composition,energy,years){
  const cost=computeSysCost(mode,composition);
  const cf=buildCashflow(years,cost.total,energy.totals);
  const irrV=irr(cf.cashFlows);
  const npvV=npv(COST.cash_rate,cf.cashFlows);
  const pb=paybackPeriod(cf.cashFlows);
  return{cost,cashFlows:cf.cashFlows,rows:cf.rows,IRR:irrV,NPV:npvV,payback_years:pb,years};
}

// -- Project ID data fetch / mapping --
function statusClass(type){
  if(type==='ok')return'ok';
  if(type==='err')return'err';
  if(type==='load')return'load';
  return'';
}
function projectStatusHtml(){
  return '<div class="note '+statusClass(projectStatus.type)+'" id="p-status">'+esc(projectStatus.text)+'</div>';
}
function setProjectStatus(type,text){
  projectStatus={type,text};
  const el=document.getElementById('p-status');
  if(el){
    el.className='note '+statusClass(type);
    el.textContent=text;
  }
}
function compactKey(v){
  return String(v||'').trim().replace(/[()]/g,'').replace(/&/g,'and').replace(/[\s-]+/g,'_').toLowerCase();
}
function normalizeStateCode(v){
  if(!v)return'BY';
  const raw=String(v).trim();
  const up=raw.toUpperCase();
  if(BASE[up])return up;
  const key=up.replace(/_/g,' ').replace(/\s+/g,' ');
  if(STATE_ALIASES[key])return STATE_ALIASES[key];
  const plain=key.replace(/[^A-ZÄÖÜ]/g,' ');
  if(STATE_ALIASES[plain.trim()])return STATE_ALIASES[plain.trim()];
  return'BY';
}
function unwrapResponse(payload){
  if(payload&&typeof payload==='object'&&'data'in payload&&('code'in payload||'msg'in payload))return payload.data;
  return payload;
}
function parseJsonMaybe(v){
  if(!v)return{};
  if(typeof v==='object')return v;
  try{return JSON.parse(v);}catch(_){return{};}
}
function projectFromRequest(requestPayload){
  const root=unwrapResponse(requestPayload)||{};
  return root.project||root;
}
function normalizePanels(panelPayload,rowLayout){
  const root=unwrapResponse(panelPayload);
  if(Array.isArray(root))return root;
  if(root&&Array.isArray(root.panelLocationInfos))return root.panelLocationInfos;
  if(rowLayout&&Array.isArray(rowLayout.panelLocationInfos))return rowLayout.panelLocationInfos;
  return[];
}
function detectArea(detectPayload,project,rowLayout){
  const root=unwrapResponse(detectPayload)||{};
  const data=root.data||root;
  return Number(data.area||data.roofArea||data.maskArea||project.roofArea||rowLayout.roofArea||0)||0;
}
function mapFormValue(group,value){
  const k=compactKey(value);
  return FORM_MAP[group]?.[k]??'';
}
function parseEvKm(v){
  if(v==null||v==='')return'';
  const m=String(v).replace(/,/g,'').match(/\d+(\.\d+)?/);
  if(!m)return'';
  return String(Math.max(0,Math.round(Number(m[0]))));
}
function roundInput(v,d=2){
  const n=Number(v);
  return Number.isFinite(n)?String(Math.round(n*Math.pow(10,d))/Math.pow(10,d)):'0';
}
function ensureSelectOption(select,value,label){
  if(!select||value==null)return;
  const val=String(value);
  if(val===''){select.value='';return;}
  if(!Array.from(select.options).some(o=>o.value===val)){
    const op=document.createElement('option');
    op.value=val;
    op.textContent=label||val;
    select.appendChild(op);
  }
  select.value=val;
}
function projectPayloadToInputs(projectId,requestPayload,panelPayload,detectPayload){
  const project=projectFromRequest(requestPayload);
  const rowLayout=parseJsonMaybe(project.rowLayout);
  const cf=rowLayout.correctionFactor||parseJsonMaybe(project.correctionFactorData);
  const panels=normalizePanels(panelPayload,rowLayout);
  const projectType=Number(rowLayout.projectType||project.projectType||project.type||0)||0;
  const existingRaw=project.existingPvKwp??project.existingPvKWp??project.existing_pv_kwp??null;
  const existingPv=existingRaw!=null&&Number(existingRaw)>0?Number(existingRaw):null;
  const panelCount=panels.length||((rowLayout.panelLocationInfos||[]).length||0);
  const stateRaw=project.state||project.siteRegion||project.region||rowLayout.state||'';
  const state=normalizeStateCode(stateRaw);
  const q1=mapFormValue('q1',cf.occupancyPattern||cf.homeOccupation||cf.home_occupation);
  const q2=mapFormValue('q2',cf.hvacSystemType||cf.hvac||cf.Q2_hvac);
  const q3=mapFormValue('q3',cf.usageLevel||cf.usage||cf.Q3_usage);
  const q4=parseEvKm(cf.evMileage||cf.ev_km||cf.Q4_ev_km);
  const q5=mapFormValue('q5',cf.evChargingHabit||cf.ev_time||cf.Q5_ev_time);
  const mask2d=detectArea(detectPayload,project,rowLayout);
  const sam3d=panelCount*PV_PANEL.p_kw;
  const preferredScn=(projectType===2||existingPv)?'rh':'n';
  return{
    projectId:String(projectId),project,rowLayout,correctionFactor:cf,panels,
    state,stateRaw,q1,q2,q3,q4,q5,existingPv,projectType,panelCount,sam3d,mask2d,preferredScn,
    address:project.address||project.siteStreet||'',city:project.city||'',country:project.countryCode||project.siteCountry||''
  };
}
function applyProjectInputsToForm(){
  const p=activeProjectInputs;
  if(!p)return;
  const pid=document.getElementById('p-id');
  const base=document.getElementById('p-base');
  if(pid)pid.value=p.projectId;
  if(base)base.value=projectBaseUrl;
  ensureSelectOption(document.getElementById('s-state'),p.state,(p.stateRaw?p.stateRaw+' -> ':'')+p.state+' (project data)');
  if(p.q1!==undefined)ensureSelectOption(document.getElementById('s-q1'),p.q1,p.q1?'Project data: '+(OCC_ZH[p.q1]||p.q1):'Not sure / skip (not provided by project)');
  if(p.q2!==undefined)ensureSelectOption(document.getElementById('s-q2'),p.q2,p.q2?'Project data: '+(SYS_ZH[p.q2]||p.q2):'Not sure / skip (not provided by project)');
  if(p.q3!==undefined)ensureSelectOption(document.getElementById('s-q3'),p.q3,p.q3?'Project data: '+(USE_ZH[p.q3]||p.q3):'Not sure / skip (not provided by project)');
  if(p.q4!==undefined)ensureSelectOption(document.getElementById('s-q4'),p.q4,p.q4?'Project data: '+Number(p.q4).toLocaleString()+' km':'Not sure / skip (not provided by project)');
  if(p.q5!==undefined)ensureSelectOption(document.getElementById('s-q5'),p.q5,p.q5?'Project data: '+p.q5:'Not sure / skip (not provided by project)');
  const sam=document.getElementById('s-3d');
  const area=document.getElementById('s-2d');
  if(sam)sam.value=roundInput(p.sam3d,2);
  if(area)area.value=roundInput(p.mask2d,2);
  const pv=document.getElementById('s-pv');
  if(pv){
    if(p.existingPv!=null)ensureSelectOption(pv,roundInput(p.existingPv,3),'Project data: existing PV '+roundInput(p.existingPv,2)+' kWp');
    else pv.value='-1';
  }
}
function bindProjectLoader(root){
  const btn=root.querySelector('#btn-load-project');
  const idInput=root.querySelector('#p-id');
  const baseInput=root.querySelector('#p-base');
  if(baseInput)baseInput.addEventListener('change',()=>{projectBaseUrl=baseInput.value.trim()||DEFAULT_PROJECT_BASE_URL;});
  if(idInput)idInput.addEventListener('keydown',e=>{if(e.key==='Enter')loadProjectFromInputs();});
  if(btn)btn.addEventListener('click',loadProjectFromInputs);
}
async function fetchJsonRequired(url,required){
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok){
    if(required)throw new Error(url+' HTTP '+res.status);
    return null;
  }
  return res.json();
}
async function loadProjectFromInputs(){
  const id=(document.getElementById('p-id')?.value||'').trim();
  projectBaseUrl=(document.getElementById('p-base')?.value||projectBaseUrl||DEFAULT_PROJECT_BASE_URL).trim().replace(/\/+$/,'');
  if(!id){setProjectStatus('err','Please enter a project ID first.');return;}
  const btn=document.getElementById('btn-load-project');
  if(btn)btn.disabled=true;
  setProjectStatus('load','Fetching project '+id+' request / panel_location / detect_building ...');
  try{
    const root=projectBaseUrl+'/'+encodeURIComponent(id);
    const [requestPayload,panelPayload,detectPayload]=await Promise.all([
      fetchJsonRequired(root+'/request.json',true),
      fetchJsonRequired(root+'/panel_location.json',false),
      fetchJsonRequired(root+'/detect_building.json',false)
    ]);
    activeProjectInputs=projectPayloadToInputs(id,requestPayload,panelPayload,detectPayload);
    activeProject={id,root,requestPayload,panelPayload,detectPayload};
    uploadedPanels=activeProjectInputs.panels.filter(p=>p&&p.generationPower);
    uploadedPanelName=uploadedPanels.length?'Project '+id+' / panel_location.json':'Project '+id+' / panel_location (no generation matrix, using fallback)';
    currentScn=activeProjectInputs.preferredScn;
    projectStatus={
      type:'ok',
      text:'Loaded project '+id+': state '+(activeProjectInputs.stateRaw||activeProjectInputs.state)+' -> '+activeProjectInputs.state+
        ', SAM3D '+roundInput(activeProjectInputs.sam3d,2)+' kWp, 2D area '+roundInput(activeProjectInputs.mask2d,1)+' m², panels '+activeProjectInputs.panelCount+
        ' panels, defaulting to '+(currentScn==='rh'?'R retrofit':'N new build')+' scenario.'
    };
    buildSidebar();
    upd2();
  }catch(err){
    setProjectStatus('err','Fetch failed: '+err.message+'. If the browser reports CORS, confirm the data source allows frontend reads, or continue with manual parameters / JSON upload.');
  }finally{
    const btn2=document.getElementById('btn-load-project');
    if(btn2)btn2.disabled=false;
  }
}

// -- Tab state --
let currentTab='calc',currentScn='rh';

// ── Sidebar ──
function buildSidebar(){
  const root=document.getElementById('side');
  if(currentTab==='params'){
    root.innerHTML=`<div class="slabel">Parameter Library</div>
     <div class="field"><label>Country / region</label>
      <select id="p-country"><option value="DE" selected>Germany (DE)</option><option value="AU" disabled>Australia (AU) - coming later</option></select></div>
     <div class="note">Loaded <b>14 DE parameter tables</b>; see the right panel. AU parameters will be added in a later version.</div>
     <div class="csv-src">📄 DE_state_annual_load_defaults.md<br>📄 DE_fallback_annual_yield.md<br>📄 DE months / monthly load share / monthly generation fallback<br>📄 DE hour flags / hourly share / hourly generation fallback<br>📄 DE_usage_intensity_coefficients.md<br>📄 DE_HVAC_thermal_load.md<br>📄 DE_EV_charging_load.md<br>📄 DE_base_parameters.md<br>📄 GLOBAL_ev_params / occupancy</div>`;
    return;
  }
  if(currentTab==='about'){
    root.innerHTML=`<div class="slabel">v4.2 Updates</div>
     <div class="note skip">1) Project-ID fetch for request / panel / detect<br>2) Integrated V1.13 four-step chain<br>3) Added 12x24 energy flow and daily battery cycle<br>4) Added DE cashflow, IRR, NPV, and payback<br>5) Existing PV generation profile uses panel_location monthlyHourlyPowerList</div>
     <div class="csv-src">📄 loadprofile_calculator_de_v4.2.html<br>📄 de_v4.2.js<br>📄 V1.13 Germany Emily calculation scripts</div>`;
    return;
  }
  const isN=currentScn==='n';
  root.innerHTML=`<div class="slabel">Project Data</div>
    <div class="field"><label>Project ID</label>
      <div class="project-fetch">
        <input type="text" id="p-id" placeholder="e.g. 11199" value="${activeProjectInputs?esc(activeProjectInputs.projectId):''}">
        <button id="btn-load-project">Fetch</button>
      </div></div>
    <div class="field"><label>Data source base URL</label>
      <input type="url" id="p-base" value="${esc(projectBaseUrl)}"></div>
    ${projectStatusHtml()}
    <div class="slabel">Scenario Mode</div>
    <div class="scn-toggle">
      <button data-scn="rh" class="${!isN?'active':''}">R Retrofit</button>
      <button data-scn="n"  class="${ isN?'active':''}">N New Build</button>
    </div>
    <div class="slabel">Load Profile Inputs</div>
    <div class="skip-row">
      <button id="btn-skipall" class="skipall" title="Skip Q1-Q5 and use default values">Skip for now</button>
      <button id="btn-resetdef" title="Restore demo inputs">Reset demo</button>
    </div>
    <div class="field"><label>Federal state</label><select id="s-state"></select></div>
    <div class="field"><label><span class="qb">Q1</span> Home occupancy</label>
      <select id="s-q1">
        <option value="">Not sure / skip (default: someone always at home)</option>
        <option value="Mostly away during the day">Mostly away during the day (0.6x)</option>
        <option value="Working from home" selected>Working from home (1.4x)</option>
        <option value="Someone always at home">Someone always at home (1.2x)</option>
      </select></div>
    <div class="field"><label><span class="qb">Q2</span> Heating / cooling system</label>
      <select id="s-q2">
        <option value="">Not sure / skip (default: no heating or cooling)</option>
        <option value="Heat pump (heating &amp; cooling)" selected>Heat pump (heating and cooling, 2000)</option>
        <option value="Air conditioning">Air conditioning (cooling only, 0)</option>
        <option value="Electric heating">Electric heating (heating only, 3000)</option>
        <option value="No heating or cooling system">No heating or cooling system</option>
      </select></div>
    <div class="field" id="f-q3"><label><span class="qb">Q3</span> Usage intensity</label>
      <select id="s-q3">
        <option value="">Not sure / skip (default: Medium 1.0)</option>
        <option value="Low">Low (0.7)</option>
        <option value="Medium" selected>Medium (1.0)</option>
        <option value="High">High (1.3)</option>
        <option value="Very high">Very high (1.6)</option>
      </select></div>
    <div class="field"><label><span class="qb">Q4</span> EV annual mileage</label>
      <select id="s-q4">
        <option value="">Not sure / skip (default: no EV)</option>
        <option value="0">No EV</option>
        <option value="5000">5,000 km</option>
        <option value="10000" selected>10,000 km</option>
        <option value="15000">15,000 km</option>
        <option value="20000">20,000 km</option>
        <option value="25000">25,000+ km</option>
      </select></div>
    <div class="field hidden" id="f-q5"><label><span class="qb">Q5</span> EV charging window</label>
      <select id="s-q5">
        <option value="">Not sure / skip (default: mostly overnight)</option>
        <option value="mostly_overnight" selected>Mostly overnight</option>
        <option value="mixed_day_and_night">Mixed day and night</option>
        <option value="mostly_daytime">Mostly daytime</option>
        <option value="solar_optimized">Solar optimized</option>
      </select></div>
    <div id="rh-only-fields" class="${isN?'hidden':''}">
      <div class="slabel">R-specific input (existing PV)</div>
      <div class="field"><label><span class="qb qbR">R1</span> Existing PV capacity</label>
        <select id="s-pv">
          <option value="-1">Not sure / skip (estimate remaining as 55%)</option>
          <option value="4">Under 5 kWp (-> 4)</option>
          <option value="7" selected>5-10 kWp (-> 7)</option>
          <option value="12">10-15 kWp (-> 12)</option>
          <option value="17">15-20 kWp (-> 17)</option>
          <option value="22">20+ kWp (-> 22)</option>
        </select></div>
    </div>
    <div class="slabel">Roof Parameters (SAM3D + 2D)</div>
    <div class="field"><label><span class="qb ${isN?'qbN':'qbR'}">${isN?'N2':'R2'}</span> SAM3D full-roof kWp</label>
      <input type="number" id="s-3d" value="14" step="0.5" min="0"></div>
    <div class="field"><label><span class="qb ${isN?'qbN':'qbR'}">${isN?'N3':'R3'}</span> Roof 2D area m2</label>
      <input type="number" id="s-2d" value="60" step="1" min="0"></div>
    <div class="field"><label>panel_location.json (optional)</label>
      <input type="file" id="s-panels" accept="application/json,.json"></div>
    <div class="note">If panel data is not uploaded, step 3 uses the DE fallback annual yield plus monthly/hourly fallback curves. After upload, existing PV annual generation is first calculated from the state fallback coefficient, then all valid panels monthlyHourlyPowerList values provide the distribution shape and are scaled to that annual total; added PV still selects the highest-yield panels using the V1.13 logic.</div>
    <div class="slabel">Package tier</div>
    <div class="field"><label>${isN?'<span class="qb qbN">N1</span>':'<span class="qb qbR">R4</span>'} Package tier</label>
      <select id="s-tier">
        <option value="A">A Economy (storage ratio 0.7)</option>
        <option value="B" selected>B Standard (storage ratio 0.9)</option>
        <option value="C">C Premium (storage ratio 1.2)</option>
      </select></div>
    <div class="field"><label>ROI years</label>
      <input type="number" id="s-years" value="${DEFAULT_ROI_YEARS}" step="1" min="1" max="40"></div>
    ${isN?'<div class="note"><b>N scenario</b>: no existing PV on the roof; derive PV + inverter + battery from the package target. SCR target/max 130%/150%, PV <= 25 kWp.<br><b style="color:var(--yel)">V1.13:</b> if SAM3D full-roof capacity is below the package target, PV is capped at SAM3D.</div>':'<div class="note">All parameter changes recalculate immediately. R-H is enabled when existing < 25 and remaining >= 2 kWp; otherwise it falls back to R-B.<br><b style="color:var(--yel)">V1.13:</b> system cost counts added PV only, excluding existing PV.</div>'}
    <div class="note skip"><b>V1.13 skip rules</b>: choosing Not sure / skip for Q1-Q5 uses preset defaults; Q1 defaults to someone always at home, and skipping R1 derives existing_pv = min(3D x 0.45, 13.16).</div>
    <div class="csv-src">📄 DE V1.13 Germany Emily calculation<br>📄 de_load_profile.py<br>📄 de_system_composition.py<br>📄 de_energy_flow.py<br>📄 de_roi_calculation.py<br>${uploadedPanels.length?`📄 Loaded ${uploadedPanelName} (${uploadedPanels.length} panels)`:'📄 panel_location.json not uploaded, using fallback'}</div>`;
  const sel=document.getElementById('s-state');
  DE_STATES.forEach(s=>{const op=document.createElement('option');op.value=s[0];op.textContent=`${s[0]} — ${s[2]} (${s[3]} kWh/year)`;sel.appendChild(op);});
  sel.value='NW';
  applyProjectInputsToForm();
  bindProjectLoader(root);
  root.querySelectorAll('.scn-toggle button').forEach(b=>b.addEventListener('click',()=>{currentScn=b.dataset.scn;buildSidebar();upd2();}));
  // v3: Skip for now / reset demo buttons.
  const btnSkip=document.getElementById('btn-skipall');
  if(btnSkip) btnSkip.addEventListener('click',()=>{
    ['s-q1','s-q2','s-q3','s-q4','s-q5'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    upd2();
  });
  const btnReset=document.getElementById('btn-resetdef');
  if(btnReset) btnReset.addEventListener('click',()=>{
    const defaults={'s-q1':'Working from home','s-q2':'Heat pump (heating & cooling)','s-q3':'Medium','s-q4':'10000','s-q5':'mostly_overnight'};
    Object.keys(defaults).forEach(id=>{const e=document.getElementById(id);if(e)e.value=defaults[id];});
    upd2();
  });
  const panelInput=document.getElementById('s-panels');
  if(panelInput) panelInput.addEventListener('change',()=>{
    const file=panelInput.files&&panelInput.files[0];
    if(!file)return;
    file.text().then(txt=>{
      const parsed=JSON.parse(txt);
      uploadedPanels=normalizePanels(parsed,null).filter(p=>p&&p.generationPower);
      uploadedPanelName=file.name;
      buildSidebar();
      upd2();
    }).catch(err=>{
      uploadedPanels=[];
      uploadedPanelName='';
      alert('panel_location.json parse failed: '+err.message);
      upd2();
    });
  });
  root.querySelectorAll('select,input').forEach(e=>{e.addEventListener('input',upd2);e.addEventListener('change',upd2);});
}

function bindTabs(){
  document.querySelectorAll('#tabnav button').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#tabnav button').forEach(x=>x.classList.toggle('active',x===b));
      currentTab=b.dataset.tab;buildSidebar();upd2();
    });
  });
}

function upd2(){
  if(currentTab==='params'){renderParams();return;}
  if(currentTab==='about'){renderAbout();return;}
  const q1=document.getElementById('s-q1').value;
  const sys=document.getElementById('s-q2').value;
  const q3=document.getElementById('s-q3').value;
  const km=document.getElementById('s-q4').value;
  const q5=document.getElementById('s-q5').value;
  const f3=document.getElementById('f-q3'),f5=document.getElementById('f-q5');
  // v3: skip also hides Q3/Q5 (skip = no HVAC / no EV).
  if(f3) f3.classList.toggle('hidden',sys==='No heating or cooling system'||sys==='');
  if(f5) f5.classList.toggle('hidden',km==='0'||km==='');
  // v3: highlight skipped fields.
  [['s-q1',q1],['s-q2',sys],['s-q3',q3],['s-q4',km],['s-q5',q5]].forEach(([id,v])=>{
    const e=document.getElementById(id);if(e) e.classList.toggle('skipped',v==='');
  });
  const sysIn=sys||'No heating or cooling system';
  const usageIn=q3||'Medium';
  const kmIn=parseInt(km)||0;
  const occIn=q1||'Someone always at home';
  const evcIn=q5||'mostly_overnight';
  const r=calcLoad(document.getElementById('s-state').value,sysIn,usageIn,kmIn,occIn,evcIn);
  // Attach skip flags for rendering.
  r.skips={q1:q1==='',q2:sys==='',q3:q3==='',q4:km==='',q5:q5===''};
  r.skipCount=Object.values(r.skips).filter(Boolean).length;
  const tier=document.getElementById('s-tier').value;
  const sam3d=parseFloat(document.getElementById('s-3d').value)||0;
  const mask2d=parseFloat(document.getElementById('s-2d').value)||0;
  const years=Math.max(1,Math.min(40,parseInt(document.getElementById('s-years')?.value)||DEFAULT_ROI_YEARS));
  if(currentScn==='rh'){
    const rh=calcRH(parseFloat(document.getElementById('s-pv').value),sam3d,mask2d,tier,sysIn,kmIn);
    const inv=pickInverter(rh.PV_total,tier);
    const composition={rh,inv};
    const energy=buildEnergyFlow('R',r,composition,uploadedPanels);
    const roi=buildROI('R',composition,energy,years);
    renderRH(r,rh,inv,energy,roi);
  }else{
    // v3: pass SAM3D / 2D into the N scenario and enable the roof physical constraint.
    const n=calcN(r,tier,sam3d,mask2d);
    const composition={n};
    const energy=buildEnergyFlow('N',r,composition,uploadedPanels);
    const roi=buildROI('N',composition,energy,years);
    renderN(r,n,energy,roi);
  }
}

// -- Rendering: shared Load Profile section --
function renderLP(r){
  const stateName=DE_STATES.find(s=>s[0]===r.state);
  const sk=r.skips||{},skipCount=r.skipCount||0;
  const szh=sk.q2?'<span style="color:var(--yel)">Skipped -> no heating or cooling</span>':(SYS_ZH[r.system]||r.system);
  const uzh=sk.q3?'<span style="color:var(--yel)">Skipped -> Medium (1.0)</span>':(USE_ZH[r.usage]||r.usage);
  const ozh=sk.q1?'<span style="color:var(--yel)">Skipped -> someone always at home (1.2x)</span>':(OCC_ZH[r.occ]||r.occ);
  const mxd=Math.max(...r.fkd),mxm=Math.max(...r.fkm);
  const skipHint=skipCount>0?'<div class="note skip" style="margin-bottom:10px"><b>Skipped '+skipCount+' items</b>:'+
    [sk.q1&&'Q1 home occupancy',sk.q2&&'Q2 heating/cooling',sk.q3&&'Q3 usage intensity',sk.q4&&'Q4 EV mileage',sk.q5&&'Q5 EV charging window'].filter(Boolean).join(' · ')+
    '. Skipped items use preset defaults.</div>':'';
  const evDisp=sk.q4?'<span style="color:var(--yel)">Skipped -> 0 km (No EV)</span>':(r.miles.toLocaleString()+' km');
  let h=blk('1','Annual Consumption (DE)',f0(r.final)+' kWh'+(skipCount>0?' · skipped '+skipCount:''),
    skipHint+
    '<div class="ssec"><div class="sstit">Input Echo</div>'+
    '<div class="kvrow"><span class="k">Federal state</span><span class="v">'+stateName[0]+' · '+stateName[2]+'</span></div>'+
    '<div class="kvrow"><span class="k">Baseline BASE</span><span class="v">'+f0(r.base)+' kWh/year</span></div>'+
    '<div class="kvrow"><span class="k">Home occupancy</span><span class="v'+(sk.q1?' skip':'')+'">'+ozh+' ('+r.occ_v.toFixed(2)+'×)</span></div>'+
    '<div class="kvrow"><span class="k">Heating / cooling system</span><span class="v'+(sk.q2?' skip':'')+'">'+szh+'</span></div>'+
    '<div class="kvrow"><span class="k">Usage intensity</span><span class="v'+(sk.q3?' skip':'')+'">'+uzh+' (am='+r.u.am.toFixed(2)+')</span></div>'+
    '<div class="kvrow"><span class="k">EV mileage</span><span class="v'+(sk.q4?' skip':'')+'">'+evDisp+'</span></div></div>'+
    '<div class="ssec"><div class="sstit">Total '+srcTag('DE_state_annual_load_defaults.md')+'</div>'+
    '<div class="fml">Annual consumption = BASE + HVAC + EV = '+f0(r.base)+' + '+f2(r.t_ext)+' + '+f2(r.ev_ext)+' <span class="r">= '+f2(r.final)+' kWh</span></div></div>');
  const mbars=r.fkm.map((v,i)=>{
    const ht=Math.round(v/mxm*52);
    const cls=(r.sf.c[i]&&r.pc&&r.sf.h[i]&&r.ph)?'both':(r.sf.c[i]&&r.pc)?'cool':(r.sf.h[i]&&r.ph)?'heat':'';
    return '<div class="mbar '+cls+'" style="height:'+ht+'px" title="'+MNZ[i]+': '+f2(v)+' kWh"></div>';
  }).join('');
  const mrows=MNZ.map((m,i)=>{
    const cls=(r.sf.c[i]&&r.pc&&r.sf.h[i]&&r.ph)?'both':(r.sf.c[i]&&r.pc)?'cool':(r.sf.h[i]&&r.ph)?'heat':'';
    const tag=(r.sf.c[i]&&r.pc?'❄':'')+(r.sf.h[i]&&r.ph?'🔥':'');
    return '<tr class="'+cls+'"><td>'+m+'</td><td>'+r.bms[i].toFixed(4)+'</td><td>'+r.sm[i].toFixed(3)+'</td><td>'+f2(r.nb[i])+'</td><td>'+f2(r.ta[i])+'</td><td>'+f2(r.ea[i])+'</td><td><b>'+f2(r.fkm[i])+'</b></td><td>'+fp(r.fsm[i]*100)+'</td><td class="tag">'+tag+'</td></tr>';
  }).join('');
  h+=blk('2','Monthly Distribution','',
    '<div class="ssec"><div class="sstit">Month Flags '+srcTag('DE_Month Flags.md')+'</div>'+
    '<div style="font-size:11px;color:var(--dim);font-family:var(--mono)">Cooling months: Jun, Jul, Aug &nbsp;|&nbsp; Heating months: Jan, Feb, Mar, Apr, Oct, Nov, Dec</div></div>'+
    '<div class="ssec"><div class="sstit">Monthly Detail '+srcTag('DE_monthly_share.md')+'</div>'+
    '<div style="display:flex;gap:14px;align-items:flex-end"><div style="flex:1"><div class="mchart">'+mbars+'</div><div class="mlbls">'+MNZ.map(m=>'<span>'+m.replace('Month','')+'</span>').join('')+'</div></div>'+
    '<div class="legend"><span style="color:#0088aa">■</span> Cooling season<br><span style="color:#8b2e1a">■</span> Heating season<br><span style="color:#8050b8">■</span> Cooling + heating season</div></div>'+
    '<div class="tw"><table><tr><th>Month</th><th>Base</th><th>Season factor</th><th>Normalized</th><th>HVAC</th><th>EV</th><th>Monthly load</th><th>Share</th><th></th></tr>'+mrows+'</table></div></div>');
  const brows=Array.from({length:24},(_,hh)=>{
    const isD=DTH.has(hh),isCp=CPH.has(hh)&&r.pc,isHp=HPH.has(hh)&&r.ph,isEV=r.ev_dist[hh]>0;
    const cls=isD?'d':(isCp||isHp)?'p':isEV?'e':'';
    return '<div class="brow"><div class="blbl">H'+String(hh).padStart(2,'0')+'</div><div class="btrk"><div class="bfil '+cls+'" style="width:'+(r.fkd[hh]/mxd*100)+'%"></div></div><div class="bval">'+r.fkd[hh].toFixed(3)+'</div></div>';
  }).join('');
  h+=blk('3','24-Hour Distribution','Daily avg '+f2(r.davg,2)+' kWh',
    '<div class="ssec"><div class="sstit">Formula '+srcTag('DE_hourly_share.md')+'</div>'+
    '<div class="fml">Non-EV[h] = (BASE+HVAC)/365 × normalized share[h]   <span class="c">daily non-EV='+f2(r.dne,4)+'</span>\nEV[h]   = (EV extra/365) × EV distribution[h]            <span class="c">daily EV='+f2(r.dev,4)+'</span></div></div>'+
    '<div class="ssec"><div class="sstit">Hourly Detail</div>'+
    '<div style="display:flex;gap:12px"><div class="legend" style="white-space:nowrap"><span style="color:var(--yel)">■</span> Daytime<br><span style="color:var(--ora)">■</span> HVAC peak<br><span style="color:var(--grn)">■</span> EV charging</div><div style="flex:1">'+brows+'</div></div></div>');
  h+=blk('4','Load Profile Output','Reference',
    '<div class="ssec"><div class="sstit">Time Windows (DE)</div>'+
    '<div class="fml">Daily avg = '+f2(r.davg,4)+' kWh\nDaytime H09–H17  <span class="r">'+f2(r.dtk,4)+' kWh ('+fp(r.dtp)+')</span>\nEvening peak H18–H20 <span class="r">'+f2(r.epk,4)+' kWh ('+fp(r.epp)+')</span>\nNight (non-daytime)  <span class="r">'+f2(r.onk,4)+' kWh ('+fp(r.onp)+')</span></div>'+
    '<div class="ogrid"><div class="ocard"><div class="ocl">☀ Daytime</div><div class="ocv">'+fp(r.dtp)+'</div><div class="ock">'+f2(r.dtk,2)+' kWh</div></div>'+
    '<div class="ocard"><div class="ocl">🌆 Evening peak</div><div class="ocv">'+fp(r.epp)+'</div><div class="ock">'+f2(r.epk,2)+' kWh</div></div>'+
    '<div class="ocard"><div class="ocl">🌙 Night</div><div class="ocv">'+fp(r.onp)+'</div><div class="ock">'+f2(r.onk,2)+' kWh</div></div></div>'+
    '<div class="note" style="margin-top:10px">DE battery capacity is recommended by <b>storage ratio</b>, not driven directly by these usage windows; this table is for scenario comparison and manual review.'+srcTag('DE_SCR_check_flow.md')+'</div></div>');
  return h;
}

function renderInverterBlock(stepNo,pv_pre,inv,tier){
  const specsStr=INV_SPECS[tier].map(s=>s===inv.inv_kw?'<b style="color:var(--ac)">['+s+']</b>':s).join(' · ');
  const okBadge=inv.scr<=SCR_MAX
    ?'<span class="modeBadge modePass">SCR '+fp(inv.scr_pct)+' ✓</span>'
    :'<span class="modeBadge modeWarn">SCR '+fp(inv.scr_pct)+' over limit</span>';
  let actionFml='';
  if(inv.action==='ok'){
    actionFml='<span class="c"># Direct match: choose the smallest spec >= '+f2(inv.target_kw,2)+' kW</span>\ninverter_kw = <span class="r">'+inv.inv_kw+' kW</span>\nSCR = '+f2(pv_pre,2)+' / '+inv.inv_kw+' = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓ ≤ 150%';
  }else if(inv.action==='maxed-but-ok'){
    actionFml='<span class="o"># Reached this tier max spec '+inv.inv_kw+' kW, but SCR is still <= 150%</span>\ninverter_kw = <span class="r">'+inv.inv_kw+' kW</span>\nSCR = '+f2(pv_pre,2)+' / '+inv.inv_kw+' = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓';
  }else if(inv.action==='curtail'){
    actionFml='<span class="o"># SCR over limit: panel curtailment triggered</span>\nmax_pv = '+inv.inv_kw+' × 1.5 = <span class="r">'+f2(inv.inv_kw*1.5,2)+' kWp</span>\npanels = floor('+f2(inv.inv_kw*1.5,2)+' / '+PV_PANEL.p_kw+') = <span class="r">'+inv.curtail_panels+' panels</span>\nfinal_pv = <span class="r">'+f2(inv.final_pv,2)+' kWp</span>\nSCR = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓';
  }
  const content=
    '<div class="ssec"><div class="sstit">DE SCR Parameters '+srcTag('DE_SCR_check_flow.md')+' '+srcTag('DE_base_parameters.md')+'</div>'+
    '<div class="fml">target_SCR = 130%   |   max_SCR = 150%\ninverter_phase = three-phase   |   inverter_max = 24 kW\nSpec library for this tier ('+tier+') = '+specsStr+'</div></div>'+
    '<div class="ssec"><div class="sstit">Inverter Selection</div>'+
    '<div class="fml">target_kw = PV / 1.30 = '+f2(pv_pre,2)+' / 1.30 = <span class="r">'+f2(inv.target_kw,2)+' kW</span>\n'+actionFml+'</div></div>'+
    '<div class="ssec"><div class="sstit">Check Result</div>'+okBadge+'</div>';
  return blk(stepNo,'Inverter Selection + SCR Check',inv.inv_kw+' kW · SCR '+fp(inv.scr_pct),content,false,'');
}

function renderEnergyFlowBlock(stepNo,energy,kls){
  const t=energy.totals,g=energy.gen_info;
  const existingMonthly=energy.matrix_gen_existing?energy.matrix_gen_existing.map((row,m)=>row.reduce((a,b)=>a+(Number(b)||0),0)*DAYS_IN_MONTH[m]):Array(12).fill(0);
  const addedMonthly=energy.matrix_gen_added?energy.matrix_gen_added.map((row,m)=>row.reduce((a,b)=>a+(Number(b)||0),0)*DAYS_IN_MONTH[m]):(energy.mode==='N'?t.monthly.map(r=>r.gen_kwh):Array(12).fill(0));
  const existingDisplayTotal=existingMonthly.reduce((a,b)=>a+b,0);
  const addedDisplayTotal=addedMonthly.reduce((a,b)=>a+b,0);
  const monthlyRows=t.monthly.map((r,i)=>'<tr><td>'+MNZ[r.month-1]+'</td><td>'+f0(existingMonthly[i])+'</td><td>'+f0(addedMonthly[i])+'</td><td>'+f0(r.gen_kwh)+'</td><td>'+f0(r.load_kwh)+'</td><td>'+f0(r.direct)+'</td><td>'+f0(r.discharge)+'</td><td>'+f0(r.export)+'</td><td>'+f0(r.import_grid)+'</td><td>'+fp(r.SCR*100)+'</td></tr>').join('');
  const balGen=t.direct+t.charge+t.export;
  const balLoad=t.direct+t.discharge+t.import_grid;
  const existingShapeInfo=g.existing_source_type==='panel_shape_scaled'
    ? '<div class="kvrow"><span class="k">Existing PV shape panels</span><span class="v">'+g.existing_shape_panels+' panels · raw matrix '+f0(g.existing_shape_annual)+' kWh/year · scale ×'+f2(g.existing_shape_scale,4)+'</span></div>'
    : '';
  const sourceInfoRows=energy.mode==='R'
    ? '<div class="kvrow"><span class="k">Existing PV source</span><span class="v">'+esc(g.existing_source||g.source)+'</span></div>'+existingShapeInfo+
      '<div class="kvrow"><span class="k">Added PV source</span><span class="v">'+esc(g.added_source||g.source)+'</span></div>'
    : '<div class="kvrow"><span class="k">Added PV source</span><span class="v">'+esc(g.added_source||g.source)+'</span></div>';
  const content=
    '<div class="ssec"><div class="sstit">V1.13 Step 3 Inputs '+srcTag('de_energy_flow.py')+'</div>'+
    sourceInfoRows+
    '<div class="kvrow"><span class="k">Existing PV generation</span><span class="v">'+f0(existingDisplayTotal)+' kWh/year</span></div>'+
    '<div class="kvrow"><span class="k">Added PV generation</span><span class="v">'+f0(addedDisplayTotal)+' kWh/year</span></div>'+
    '<div class="kvrow"><span class="k">Usable battery capacity</span><span class="v">'+f2(t.usable_capacity,2)+' kWh (DoD '+BATT_DOD+')</span></div></div>'+
    '<div class="ssec"><div class="sstit">Daily Battery-Cycle Model</div>'+
    '<div class="fml">direct = min(gen, load)\nsurplus = gen - direct\ncharge = min(surplus, usable_capacity - soc)\ndischarge = min(deficit, soc × RTE)\nexport = surplus - charge\nimport = deficit - discharge</div></div>'+
    '<div class="ssec"><div class="sstit">Annual Results</div>'+
    '<div class="ogrid n5">'+
    '<div class="ocard '+kls+'"><div class="ocl">Annual generation</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(t.gen_total)+'</div><div class="ock">kWh</div></div>'+
    '<div class="ocard"><div class="ocl">Annual load</div><div class="ocv">'+f0(t.load_total)+'</div><div class="ock">kWh</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">SCR self-consumption</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+fp(t.SCR*100)+'</div><div class="ock">direct+discharge / gen</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">SSR self-sufficiency</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+fp(t.SSR*100)+'</div><div class="ock">direct+discharge / load</div></div>'+
    '<div class="ocard"><div class="ocl">Grid import / export</div><div class="ocv">'+f0(t.import_grid)+'</div><div class="ock">import · export '+f0(t.export)+'</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">Generation Split</div>'+
    '<div class="ogrid">'+
    '<div class="ocard"><div class="ocl">Existing PV generation</div><div class="ocv">'+f0(existingDisplayTotal)+'</div><div class="ock">kWh/year</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">Added PV generation</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(addedDisplayTotal)+'</div><div class="ock">kWh/year · '+g.added_panels+' panels</div></div>'+
    '<div class="ocard"><div class="ocl">Total generation</div><div class="ocv">'+f0(t.gen_total)+'</div><div class="ock">existing + added</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">Monthly Summary</div><div class="tw"><table><tr><th>Month</th><th>Existing PV</th><th>Added PV</th><th>Total generation</th><th>Load</th><th>Direct</th><th>Battery discharge</th><th>Export</th><th>Import</th><th>Monthly SCR</th></tr>'+monthlyRows+
    '<tr class="hi"><td>Total</td><td>'+f0(existingDisplayTotal)+'</td><td>'+f0(addedDisplayTotal)+'</td><td>'+f0(t.gen_total)+'</td><td>'+f0(t.load_total)+'</td><td>'+f0(t.direct)+'</td><td>'+f0(t.discharge)+'</td><td>'+f0(t.export)+'</td><td>'+f0(t.import_grid)+'</td><td>'+fp(t.SCR*100)+'</td></tr></table></div></div>'+
    '<div class="ssec"><div class="sstit">Self-Check</div><div class="fml">Generation balance direct + charge + export = '+f2(balGen,2)+' ↔ gen_total '+f2(t.gen_total,2)+'\nLoad balance direct + discharge + import = '+f2(balLoad,2)+' ↔ load_total '+f2(t.load_total,2)+'</div></div>';
  return blk(stepNo,'V1.13 · Step 3: Energy Flow Simulation','SCR '+fp(t.SCR*100)+' · SSR '+fp(t.SSR*100),content,false,kls);
}

function renderROIBlock(stepNo,roi,kls){
  const c=roi.cost;
  const firstRows=roi.rows.filter(r=>r.year<=5);
  const last=roi.rows[roi.rows.length-1];
  const rows=firstRows.concat(last.year>5?[last]:[]);
  const rowHtml=rows.map(r=>{
    if(r.year===0)return '<tr><td>0</td><td>–</td><td>–</td><td>–</td><td>–</td><td>'+f0(r.cumulative)+' investment</td></tr>';
    return '<tr><td>'+r.year+'</td><td>'+f0(r.baseline_cost)+'</td><td>'+f0(r.remain_cost)+'</td><td>'+f0(r.export_income)+'</td><td>'+f0(r.saving)+'</td><td>'+f0(r.cumulative)+'</td></tr>';
  }).join('');
  const irrTxt=roi.IRR==null?'–':fp(roi.IRR*100);
  const pbTxt=roi.payback_years==null?'–':f2(roi.payback_years,2)+' years';
  const content=
    '<div class="ssec"><div class="sstit">V1.13 Step 4 Cost '+srcTag('de_roi_calculation.py')+'</div>'+
    '<div class="tw"><table><tr><th style="text-align:left">Item</th><th>Unit price</th><th>Quantity</th><th>Amount</th></tr>'+
    '<tr><td style="text-align:left">PV</td><td>550 €/kWp</td><td>'+f2(c.pv_basis_kwp,2)+' kWp</td><td>'+f0(c.pv_cost)+' €</td></tr>'+
    '<tr><td style="text-align:left">Inverter</td><td>330 €/kW</td><td>'+f2(c.inv_kw,1)+' kW</td><td>'+f0(c.inv_cost)+' €</td></tr>'+
    '<tr><td style="text-align:left">Battery</td><td>400 €/kWh</td><td>'+f2(c.bat_kwh,1)+' kWh</td><td>'+f0(c.bat_cost)+' €</td></tr>'+
    '<tr class="hi"><td style="text-align:left">Total investment</td><td>GST 0%</td><td>–</td><td>'+f0(c.total)+' €</td></tr></table></div></div>'+
    '<div class="ssec"><div class="sstit">Cashflow Formula</div>'+
    '<div class="fml">baseline_cost[t] = load_total × 0.35 × (1+0.02)^(t-1) + 0.7×365\nremain_cost[t] = import × 0.35 × (1+0.02)^(t-1) + 0.7×365\nexport_income[t] = export × 0.07\nsaving[t] = baseline_cost - remain_cost + export_income</div></div>'+
    '<div class="ssec"><div class="sstit">Key Metrics</div>'+
    '<div class="ogrid n4">'+
    '<div class="ocard '+kls+'"><div class="ocl">IRR</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+irrTxt+'</div><div class="ock">Newton + bisection</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">NPV @ 3.5%</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(roi.NPV)+'</div><div class="ock">€</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">Payback</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+pbTxt+'</div><div class="ock">linear interpolation</div></div>'+
    '<div class="ocard"><div class="ocl">Year-1 saving</div><div class="ocv">'+f0(roi.rows[1]?.saving||0)+'</div><div class="ock">€</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">Cashflow Preview</div><div class="tw"><table><tr><th>Year</th><th>No system</th><th>Post-install import</th><th>Export income</th><th>Annual saving</th><th>Cumulative net cashflow</th></tr>'+rowHtml+'</table></div></div>';
  return blk(stepNo,'V1.13 · Step 4: ROI',irrTxt+' · NPV €'+f0(roi.NPV),content,false,kls);
}

// -- R-H rendering --
function renderRH(r,rh,inv,energy,roi){
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">Annual Consumption</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/year</div></div>'+
    '<div class="card"><div class="cl">Daily Average Load</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/day</div></div>'+
    '<div class="card hi2"><div class="cl">Mode</div><div class="cv ora">'+rh.mode+'</div><div class="cu">'+(rh.mode==='R-H'?'PV + storage expansion':'storage-only upgrade')+'</div></div>'+
    '<div class="card hi2"><div class="cl">Total PV Capacity</div><div class="cv ora">'+f2(rh.PV_total,2)+'</div><div class="cu">kWp (added '+f2(rh.added_kwp,2)+')</div></div>'+
    '<div class="card hi"><div class="cl">Inverter</div><div class="cv">'+inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="card hi2"><div class="cl">Recommended Battery</div><div class="cv ora">'+f2(rh.bat_kWh,1)+'</div><div class="cu">kWh ('+rh.tier+' tier ×'+rh.ratio+')</div></div></div>';
  h+=renderLP(r);
  // -- Step 0: existing PV capacity mapping (v3 shows the branch-2 13.16 cap) --
  const pvOpts=[[4,'Under 5 kWp','Slightly below interval midpoint; many early DE systems are 3-5'],[7,'5–10 kWp','Midpoint of the common range for older DE systems'],[12,'10–15 kWp','Midpoint'],[17,'15–20 kWp','Midpoint'],[22,'20+ kWp','Conservative value under the 25 kWp hard cap']];
  const pvMapTbl='<div class="tw"><table><tr><th>Frontend option</th><th>Mapped value</th><th style="text-align:left">Rationale</th></tr>'+
    pvOpts.map(o=>'<tr class="'+(rh.userKnown&&rh.existing===o[0]?'hi':'')+'"><td>'+o[1]+'</td><td>'+o[0]+'</td><td style="text-align:left">'+o[2]+'</td></tr>').join('')+
    '<tr class="'+(!rh.userKnown?'skip':'')+'"><td>Not sure / skip</td><td>min(3D×0.45, 13.16)</td><td style="text-align:left">Back-calculate as SAM3D x 0.45; <b style="color:var(--yel)">v3 cap 13.16</b> avoids exceeding the C-tier target</td></tr></table></div>';
  let br2Fml;
  if(!rh.userKnown){
    br2Fml='<div class="fml">'+
      '<span class="c"># v3: User skipped R1 -> back-calculate by SAM3D x 0.45, then take the smaller of that and 13.16</span>\n'+
      'existing_raw   = '+f2(rh.roof_full_kwp_3d,2)+' × 0.45 = <span class="o">'+f2(rh.br2_existing_raw,2)+' kWp</span>\n'+
      'existing_cap   = <span class="y">'+f2(rh.br2_cap,2)+' kWp</span>  <span class="c"># = TIER_TARGET.C.base (avoid exceeding C-tier target)</span>\n'+
      'existing_pv_kwp = min(existing_raw, existing_cap) = <span class="r">'+f2(rh.existing,2)+' kWp</span>'+
      (rh.br2_capped?'  <span class="y">⚠ cap triggered</span>':'  <span class="c"># cap not triggered</span>')+
      '</div>';
  }else{
    br2Fml='<div class="fml">existing_pv_kwp = <span class="r">'+f2(rh.existing,2)+' kWp</span> <span class="c"># mapped directly from user option</span></div>';
  }
  h+=blk('5','R-H · Step 0: Existing PV Capacity Mapping','existing = '+f2(rh.existing,2)+' kWp'+(rh.br2_capped?' · capped':''),
    '<div class="ssec"><div class="sstit">Option -> value mapping '+srcTag('R-H_calculation_flow.md')+'</div>'+pvMapTbl+'</div>'+
    '<div class="ssec"><div class="sstit">Value Used</div>'+br2Fml+'</div>',false,'rh');
  const branchDesc={
    1:'Branch 1: use the 3D difference',
    1.5:'Branch 1 fallback: 3D - existing < 0, use 2D area fallback',
    2:'Branch 2: user skipped -> remaining = 3D x 0.55; existing = <b>min</b>(3D x 0.45, <b>13.16</b>) <span style="color:var(--yel)"><- v3 cap</span>',
    3:'Branch 3: SAM3D cannot fit it -> use 2D area fallback'
  }[rh.branch];
  let br2Detail='';
  if(rh.branch===2){
    br2Detail='\n<span class="c"># Branch-2 back-calculation detail:</span>\n'+
      'existing_raw    = 3D × 0.45 = '+f2(rh.roof_full_kwp_3d,2)+' × 0.45 = <span class="o">'+f2(rh.br2_existing_raw,2)+' kWp</span>\n'+
      'existing_capped = min(existing_raw, <span class="y">13.16</span>) = <span class="r">'+f2(rh.existing,2)+' kWp</span>'+
      (rh.br2_capped?'  <span class="y">⚠ 13.16 cap triggered</span>':'  <span class="c"># cap not triggered</span>');
  }
  h+=blk('6','R-H · Step 2.1: Roof Area + Remaining Installable Capacity','remaining = '+f2(rh.remaining,2)+' kWp',
    '<div class="ssec"><div class="sstit">Parameters '+srcTag('DE_base_parameters.md')+'</div>'+
    '<div class="kvrow"><span class="k">Roof tilt</span><span class="v">'+ROOF_TILT_DEG+'°</span></div>'+
    '<div class="kvrow"><span class="k">Panel area / power</span><span class="v">'+f2(PANEL_AREA,3)+' m² / '+PV_PANEL.p_kw+' kW</span></div>'+
    '<div class="kvrow"><span class="k">Roof utilization</span><span class="v">'+ROOF_USE_RATIO+'</span></div>'+
    '<div class="kvrow"><span class="k">Branch-2 back-calculation cap (v3)</span><span class="v">existing ≤ 13.16 kWp</span></div>'+
    '<div class="kvrow"><span class="k">2D / SAM3D input</span><span class="v">'+f2(rh.mask2d,1)+' m² / '+f2(rh.sam3d,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">2D Fallback</div>'+
    '<div class="fml">roof = mask_2d / cos(40°) = '+f2(rh.roof_area_m2,2)+' m²\nusable = '+f2(rh.usable_area_m2,2)+' m²\nmax_panels = '+rh.max_panels_area+' panels  ->  <span class="r">'+f2(rh.roof_full_kwp_area,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">Branch Decision</div>'+
    '<div class="fml"><span class="o">'+branchDesc+'</span>\nremaining = <span class="r">'+f2(rh.remaining,3)+' kWp</span>\nremaining_capped = <span class="r">'+f2(rh.remaining_capped,3)+' kWp</span>'+br2Detail+'</div></div>',false,'rh');
  let modeFml;
  if(rh.existing>=PV_HARDCAP) modeFml='existing('+f2(rh.existing,2)+') >= 25 -> R-B';
  else if(rh.remaining_capped<REMAIN_MIN_RH) modeFml='remaining_capped &lt; 2.0 -> R-B';
  else modeFml='existing < 25 and remaining_capped >= 2.0 -> R-H';
  h+=blk('7','R-H · Step 2.2: Mode Decision','<span class="modeBadge '+(rh.mode==='R-H'?'modeRH':'modeRB')+'">'+rh.mode+'</span>',
    '<div class="ssec"><div class="sstit">Business Rule</div>'+
    '<div class="fml">if existing &gt;= 25:           R-B\nelif remaining_capped &lt; 2:  R-B\nelse:                       R-H</div></div>'+
    '<div class="ssec"><div class="sstit">This Decision</div>'+
    '<div class="fml"><span class="r">'+modeFml+'</span></div></div>',false,'rh');
  const tierTbl='<div class="tw"><table><tr><th>Tier</th><th>Default target</th><th>Boosted target</th><th>Storage ratio</th></tr>'+
    '<tr class="'+(rh.tier==='A'?'hi':'')+'"><td>A Economy</td><td>7.05</td><td>7.05</td><td>0.7</td></tr>'+
    '<tr class="'+(rh.tier==='B'?'hi':'')+'"><td>B Standard</td><td>10.34</td><td>13.16</td><td>0.9</td></tr>'+
    '<tr class="'+(rh.tier==='C'?'hi':'')+'"><td>C Premium</td><td>13.16</td><td>15.04</td><td>1.2</td></tr></table></div>';
  let rhCalcFml;
  if(rh.mode==='R-H'){
    rhCalcFml='target_added = max(0, '+f2(rh.target_pv_total,2)+' − '+f2(rh.existing,2)+') = <span class="r">'+f2(rh.target_added,2)+' kWp</span>\nadded_kwp_pre = min(target_added, remaining_capped) = <span class="r">'+f2(rh.added_kwp_pre,2)+' kWp</span>\nadded_panels = floor('+f2(rh.added_kwp_pre,2)+' / '+PV_PANEL.p_kw+') = <span class="r">'+rh.added_panels+' panels</span>\nadded_kwp = <span class="r">'+f2(rh.added_kwp,2)+' kWp</span>\nPV_total = <span class="r">'+f2(rh.PV_total,2)+' kWp</span> (≤25 ✅)';
  }else{
    rhCalcFml='<span class="c"># R-B: no panels added</span>\nPV_total = existing = <span class="r">'+f2(rh.PV_total,2)+' kWp</span>';
  }
  h+=blk('8','R-H · Step 2.3: Tier Target + Added PV','PV_total = '+f2(rh.PV_total,2)+' kWp',
    '<div class="ssec"><div class="sstit">Tier Parameter Table '+srcTag('DE_base_parameters.md')+'</div>'+tierTbl+'</div>'+
    '<div class="ssec"><div class="sstit">Trigger Condition</div>'+
    '<div class="fml">trigger = (EV&gt;0) ∨ heat_pump ∨ electric_heat = <span class="r">'+rh.trigger+'</span>\ntarget = <span class="r">'+f2(rh.target_pv_total,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">Added Capacity Calculation</div>'+
    '<div class="fml">'+rhCalcFml+'</div></div>',false,'rh');
  h+=renderInverterBlock('9',rh.PV_total,inv,rh.tier);
  const specsBadge=BATT_SPECS.map(s=>s===rh.bat_kWh?'<b style="color:var(--ora)">['+s+']</b>':s).join(' · ');
  h+=blk('10','R-H · Step 2.4: Battery Capacity Recommendation',f2(rh.bat_kWh,1)+' kWh',
    '<div class="ssec"><div class="sstit">Storage-ratio method '+srcTag('DE_base_parameters.md')+'</div>'+
    '<div class="fml">storage_ratio = {A:0.7, B:0.9, C:1.2}['+rh.tier+'] = <span class="r">'+rh.ratio+'</span>\nBat_target = '+f2(rh.PV_total,2)+' × '+rh.ratio+' = <span class="r">'+f2(rh.bat_target,2)+' kWh</span></div></div>'+
    '<div class="ssec"><div class="sstit">Round up (min 5, max 50)</div>'+
    '<div class="fml">Spec set: '+specsBadge+'\nBat_kWh = <span class="r">'+f2(rh.bat_kWh,1)+' kWh</span></div></div>',false,'rh');
  const annualGen=rh.PV_total*YIELD[r.state];
  // v3: system cost counts added_kwp only, excluding existing PV. In R-B, added_kwp=0 so PV cost is 0.
  const pvCost=rh.added_kwp*COST.pv_eur_per_kwp;
  const sysCost=pvCost+inv.inv_kw*COST.inv_eur_per_kwp+rh.bat_kWh*COST.batt_eur_per_kwh;
  const noAdd=rh.added_kwp<=0;
  h+=blk('11','R-H Summary: System Overview',rh.mode+' · '+rh.tier+' tier',
    '<div class="ogrid n5">'+
    '<div class="ocard rh"><div class="ocl">Existing PV</div><div class="ocv ora">'+f2(rh.existing,2)+'</div><div class="ock">kWp (excluded from cost)</div></div>'+
    '<div class="ocard rh"><div class="ocl">➕ Added PV</div><div class="ocv ora">'+f2(rh.added_kwp,2)+'</div><div class="ock">kWp ('+rh.added_panels+' panels)</div></div>'+
    '<div class="ocard rh"><div class="ocl">☀️ Total PV</div><div class="ocv ora">'+f2(rh.PV_total,2)+'</div><div class="ock">kWp</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ Inverter</div><div class="ocv">'+inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="ocard rh"><div class="ocl">🔋 Battery</div><div class="ocv ora">'+f2(rh.bat_kWh,1)+'</div><div class="ock">kWh</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">Appendix: annual generation + rough cost (v3: added PV only)'+srcTag('DE_fallback_annual_yield.md')+'</div>'+
    '<div class="fml">Fallback coefficient('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\nAnnual generation ≈ '+f2(rh.PV_total,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/year</span>\nSelf-sufficiency ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\n<span class="c"># v3: System cost counts added PV only, excluding existing PV assets</span>\nPV   : <span class="y">added_kwp</span> '+f2(rh.added_kwp,2)+' × 550 = '+f0(pvCost)+' €'+(noAdd?'  <span class="y">⚠ R-B / no added PV -> PV cost = 0</span>':'')+'\n<span class="c"># Existing PV '+f2(rh.existing,2)+' kWp excluded from cost</span>\nInverter: '+inv.inv_kw+' × 330  = '+f0(inv.inv_kw*COST.inv_eur_per_kwp)+' €\nBattery : '+f2(rh.bat_kWh,1)+' × 400 = '+f0(rh.bat_kWh*COST.batt_eur_per_kwh)+' €\nTotal = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'rh');
  h+=renderEnergyFlowBlock('12',energy,'rh');
  h+=renderROIBlock('13',roi,'rh');
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// -- N new-build rendering --
function renderN(r,n,energy,roi){
  const tierTbl='<div class="tw"><table><tr><th>Tier</th><th>Default target</th><th>Boosted target</th><th>Storage ratio</th></tr>'+
    '<tr class="'+(n.tier==='A'?'hi':'')+'"><td>A Economy</td><td>7.05</td><td>7.05</td><td>0.7</td></tr>'+
    '<tr class="'+(n.tier==='B'?'hi':'')+'"><td>B Standard</td><td>10.34</td><td>13.16</td><td>0.9</td></tr>'+
    '<tr class="'+(n.tier==='C'?'hi':'')+'"><td>C Premium</td><td>13.16</td><td>15.04</td><td>1.2</td></tr></table></div>';
  const roofBadge=n.roof_limited?'<span class="modeBadge modeSkip" title="roof-limited">⚠ roof-limited</span>':'<span class="modeBadge modePass">✓ roof sufficient</span>';
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">Annual Consumption</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/year</div></div>'+
    '<div class="card"><div class="cl">Daily Average Load</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/day</div></div>'+
    '<div class="card hi3"><div class="cl">Mode</div><div class="cv pur">N · New Build</div><div class="cu">'+n.tier+' tier'+(n.roof_limited?' · roof-limited':'')+'</div></div>'+
    '<div class="card hi3"><div class="cl">PV Capacity</div><div class="cv '+(n.roof_limited?'yel':'pur')+'">'+f2(n.actual_pv,2)+'</div><div class="cu">kWp ('+n.actual_panels+' panels)'+(n.roof_limited?' ⚠':'')+'</div></div>'+
    '<div class="card hi"><div class="cl">Inverter</div><div class="cv">'+n.inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="card hi3"><div class="cl">Recommended Battery</div><div class="cv pur">'+f2(n.bat_kWh,1)+'</div><div class="cu">kWh · ratio '+n.ratio+'</div></div></div>';
  h+=renderLP(r);
  h+=blk('5','N · Step 1: Tier Target','target = '+f2(n.target_pv_total,2)+' kWp',
    '<div class="ssec"><div class="sstit">Tier Parameter Table '+srcTag('Germany_N_scenario_flow.md')+' '+srcTag('DE_base_parameters.md')+'</div>'+tierTbl+'</div>'+
    '<div class="ssec"><div class="sstit">Trigger Check</div>'+
    '<div class="fml">trigger = (EV&gt;0) ∨ heat_pump ∨ electric_heat\n       = ('+r.miles+'&gt;0) ∨ '+(r.system==='Heat pump (heating & cooling)')+' ∨ '+(r.system==='Electric heating')+'\n       = <span class="r">'+n.trigger+'</span>\n\ntarget_pv_total = <span class="r">'+f2(n.target_pv_total,2)+' kWp</span>\ntarget_pv_capped = min(target, 25) = <span class="r">'+f2(n.target_pv_capped,2)+' kWp</span>  <span class="c"># PV hard cap</span></div></div>',false,'n');
  // v3: N scenario roof physical-constraint check.
  h+=blk('6','N · Step 1.5: Roof Physical Constraint (v3)',roofBadge+' roof_capped = '+f2(n.roof_capped,2)+' kWp',
    '<div class="ssec"><div class="sstit">SAM3D Cap Rule</div>'+
    '<div class="fml"><span class="c"># v3: N scenario adds a roof physical constraint: if SAM3D full-roof capacity is below the package target, PV is capped at SAM3D</span>\n'+
      'SAM3D full-roof = <span class="r">'+f2(n.sam3d,2)+' kWp</span>\n'+
      'target_pv_capped = <span class="r">'+f2(n.target_pv_capped,2)+' kWp</span>\n'+
      'roof_capped = min(target_pv_capped, SAM3D) = min('+f2(n.target_pv_capped,2)+', '+f2(n.sam3d,2)+') = <span class="r">'+f2(n.roof_capped,2)+' kWp</span>'+
      (n.roof_limited?'  <span class="y">⚠ SAM3D &lt; target -> roof-limited, can only deliver '+f2(n.sam3d,2)+' kWp</span>':'  <span class="c"># roof can fit the target</span>')+
      '</div></div>'+
    '<div class="ssec"><div class="sstit">2D Area Reference</div>'+
    '<div class="kvrow"><span class="k">2D input</span><span class="v">'+f2(n.mask2d,1)+' m²</span></div>'+
    '<div class="kvrow"><span class="k">SAM3D input</span><span class="v">'+f2(n.sam3d,2)+' kWp</span></div>'+
    '<div class="note">2D area is shown for reference only; the N scenario uses SAM3D as the physical roof limit.</div></div>',false,'n');
  h+=blk('7','N · Step 2: PV Installation (Panel Rounding + Roof Limit)','pv_pre = '+f2(n.pv_pre,2)+' kWp',
    '<div class="ssec"><div class="sstit">Panel Rounding (without exceeding roof)</div>'+
    '<div class="fml">panels = (ceil(roof_capped / panel_kw) and area <= SAM3D)\n       = <span class="r">'+n.panels+' panels</span>\npv_pre = '+n.panels+' × '+PV_PANEL.p_kw+' = <span class="r">'+f2(n.pv_pre,2)+' kWp</span>\nassert pv_pre ≤ min(25, SAM3D='+f2(n.sam3d,2)+') ✅</div></div>'+
    '<div class="note">v3: Panel rounding respects two caps: PV_HARDCAP=25 and SAM3D, so the roof limit is not exceeded.</div>',false,'n');
  h+=renderInverterBlock('8',n.pv_pre,n.inv,n.tier);
  const specsBadge=BATT_SPECS.map(s=>s===n.bat_kWh?'<b style="color:var(--pur)">['+s+']</b>':s).join(' · ');
  h+=blk('9','N · Step 4: Battery Capacity Recommendation (storage-ratio method)',f2(n.bat_kWh,1)+' kWh',
    '<div class="ssec"><div class="sstit">Storage ratio '+srcTag('DE_base_parameters.md')+' '+srcTag('DE_SCR_check_flow.md')+'</div>'+
    '<div class="fml">storage_ratio = {A:0.7, B:0.9, C:1.2}['+n.tier+'] = <span class="r">'+n.ratio+'</span>\nBat_target = PV_actual × ratio = '+f2(n.actual_pv,2)+' × '+n.ratio+' = <span class="r">'+f2(n.bat_target,2)+' kWh</span></div></div>'+
    '<div class="ssec"><div class="sstit">Round up (min 5, max 50)</div>'+
    '<div class="fml">Spec set: '+specsBadge+'\nBat_kWh = <span class="r">'+f2(n.bat_kWh,1)+' kWh</span></div></div>'+
    '<div class="note">DoD = 0.9 · RTE = 0.95 is used in the later energy-flow simulation and does not affect battery spec selection.</div>',false,'n');
  const annualGen=n.actual_pv*YIELD[r.state];
  const sysCost=n.actual_pv*COST.pv_eur_per_kwp+n.inv.inv_kw*COST.inv_eur_per_kwp+n.bat_kWh*COST.batt_eur_per_kwh;
  h+=blk('10','N Summary: System Overview','N · '+n.tier+' tier'+(n.roof_limited?' · roof-limited':''),
    '<div class="ogrid n4">'+
    '<div class="ocard n"><div class="ocl">☀️ PV Capacity'+(n.roof_limited?' ⚠':'')+'</div><div class="ocv '+(n.roof_limited?'yel':'pur')+'">'+f2(n.actual_pv,2)+'</div><div class="ock">kWp ('+n.actual_panels+' panels)'+(n.roof_limited?' · roof-limited':'')+'</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ Inverter</div><div class="ocv">'+n.inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="ocard n"><div class="ocl">🔋 Battery</div><div class="ocv pur">'+f2(n.bat_kWh,1)+'</div><div class="ock">kWh · ratio '+n.ratio+'</div></div>'+
    '<div class="ocard"><div class="ocl">System cost</div><div class="ocv">'+f0(sysCost)+'</div><div class="ock">€ (rough pre-tax estimate)</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">Appendix: annual generation + rough cost '+srcTag('DE_fallback_annual_yield.md')+'</div>'+
    '<div class="fml">Fallback coefficient('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\nAnnual generation ≈ '+f2(n.actual_pv,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/year</span>\nSelf-sufficiency ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\nPV   : '+f2(n.actual_pv,2)+' × 550 = '+f0(n.actual_pv*COST.pv_eur_per_kwp)+' €\nInverter: '+n.inv.inv_kw+' × 330  = '+f0(n.inv.inv_kw*COST.inv_eur_per_kwp)+' €\nBattery : '+f2(n.bat_kWh,1)+' × 400 = '+f0(n.bat_kWh*COST.batt_eur_per_kwh)+' €\nTotal = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'n');
  h+=renderEnergyFlowBlock('11',energy,'n');
  h+=renderROIBlock('12',roi,'n');
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// -- Parameter Library tab rendering --
function renderParams(){
  const stateTbl='<div class="tw"><table><tr><th>Code</th><th style="text-align:left">English</th><th style="text-align:left">Display name</th><th>Annual load kWh</th><th>Yield factor</th></tr>'+
    DE_STATES.map(s=>'<tr><td>'+s[0]+'</td><td style="text-align:left">'+s[1]+'</td><td style="text-align:left">'+s[2]+'</td><td>'+s[3]+'</td><td>'+s[4]+'</td></tr>').join('')+'</table></div>';
  const monthTbl='<div class="tw"><table><tr><th>Month</th><th>cool</th><th>heat</th><th>Season</th><th>Days</th><th>Load share</th><th>Generation share</th></tr>'+
    MONTH_FLAGS.map((m,i)=>'<tr><td>'+MNZ[i]+'</td><td>'+m[1]+'</td><td>'+m[2]+'</td><td>'+m[3]+'</td><td>'+DAYS_IN_MONTH[i]+'</td><td>'+DE_MONTHLY[i].toFixed(4)+'</td><td>'+DE_GEN_MONTHLY[i].toFixed(4)+'</td></tr>').join('')+'</table></div>';
  const ucTbl='<div class="tw"><table><tr><th>Intensity</th><th>annual</th><th>cool_month</th><th>heat_month</th><th>cool_peak</th><th>heat_peak</th></tr>'+
    Object.entries(UC).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v.am+'</td><td>'+v.cmm+'</td><td>'+v.hmm+'</td><td>'+v.cpm+'</td><td>'+v.hpm+'</td></tr>').join('')+'</table></div>';
  const occTbl='<div class="tw"><table><tr><th>occupancy</th><th>daytime_mult</th><th>Daytime window</th><th style="text-align:left">Description</th></tr>'+
    Object.entries(OCC).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td><td>H09–H17</td><td style="text-align:left">'+OCC_ZH[k]+'</td></tr>').join('')+'</table></div>';
  const hvacTbl='<div class="tw"><table><tr><th style="text-align:left">system</th><th>base_thermal_load_kwh</th><th style="text-align:left">Description</th></tr>'+
    '<tr><td style="text-align:left">No heating/cooling</td><td>0</td><td style="text-align:left">No additional energy</td></tr>'+
    '<tr><td style="text-align:left">Air conditioning</td><td>0</td><td style="text-align:left">Only reshapes cooling-season months and peak hours</td></tr>'+
    '<tr><td style="text-align:left">Electric heating</td><td>3000</td><td style="text-align:left">German winters are cold; electric-heating base thermal load is higher</td></tr>'+
    '<tr><td style="text-align:left">Heat pump</td><td>2000</td><td style="text-align:left">Heat pumps are efficient, but German winter heating demand is significant</td></tr></table></div>';
  const evTbl='<div class="tw"><table><tr><th>Hour</th><th>overnight</th><th>mixed</th><th>daytime</th><th>solar_opt</th></tr>'+
    Array.from({length:24},(_,hh)=>'<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+EVP.mostly_overnight[hh]+'</td><td>'+EVP.mixed_day_and_night[hh]+'</td><td>'+EVP.mostly_daytime[hh]+'</td><td>'+EVP.solar_optimized[hh]+'</td></tr>').join('')+'</table></div>';
  const flagRows=HOUR_FLAGS.map(([hh,dt,cp,hp,mr,er])=>{
    const flags=[];
    if(dt)flags.push('☀Daytime');if(cp)flags.push('❄Cooling peak');if(hp)flags.push('🔥Heating peak');
    if(mr)flags.push('🌅Morning peak');if(er)flags.push('🌆Evening peak');
    return '<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+dt+'</td><td>'+cp+'</td><td>'+hp+'</td><td>'+mr+'</td><td>'+er+'</td><td class="tag" style="text-align:left">'+flags.join(' ')+'</td></tr>';
  }).join('');
  const hourFlagTbl='<div class="tw"><table><tr><th>Hour</th><th>Daytime</th><th>Cooling peak</th><th>Heating peak</th><th>Morning peak</th><th>Evening peak</th><th style="text-align:left">Description</th></tr>'+flagRows+'</table></div>';
  const hourShareTbl='<div class="tw"><table><tr><th>Hour</th><th>Share</th></tr>'+
    DE_HOURLY.map((v,hh)=>'<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+v.toFixed(4)+'</td></tr>').join('')+'</table></div>';
  const baseTbl='<div class="tw"><table><tr><th style="text-align:left">Parameter</th><th>Value</th><th style="text-align:left">Description</th></tr>'+
    '<tr><td style="text-align:left">PV panel power</td><td>'+PV_PANEL.p_kw+' kW</td><td style="text-align:left">JKM470N-60HL4, 1903×1134 mm</td></tr>'+
    '<tr><td style="text-align:left">Roof pitch (default)</td><td>'+ROOF_TILT_DEG+'°</td><td style="text-align:left">cos40 ≈ 0.766</td></tr>'+
    '<tr><td style="text-align:left">Roof utilization</td><td>'+ROOF_USE_RATIO+'</td><td style="text-align:left">2D fallback area method</td></tr>'+
    '<tr><td style="text-align:left">PV hard cap</td><td>'+PV_HARDCAP+' kWp</td><td style="text-align:left">Residential hard constraint</td></tr>'+
    '<tr><td style="text-align:left">target / max SCR</td><td>130% / 150%</td><td style="text-align:left">SCR target / max</td></tr>'+
    '<tr><td style="text-align:left">Max inverter power</td><td>'+INV_MAX_KW+' kW</td><td style="text-align:left">DE three-phase supply, 24 kW per CMS card</td></tr>'+
    '<tr><td style="text-align:left">Inverter specs A/B</td><td>'+INV_SPECS.A.join(', ')+'</td><td style="text-align:left">three-phase kW</td></tr>'+
    '<tr><td style="text-align:left">Inverter specs C</td><td>'+INV_SPECS.C.join(', ')+'</td><td style="text-align:left">three-phase kW</td></tr>'+
    '<tr><td style="text-align:left">Storage ratio A/B/C</td><td>0.7 / 0.9 / 1.2</td><td style="text-align:left">PV x ratio = battery target</td></tr>'+
    '<tr><td style="text-align:left">Battery spec library</td><td>'+BATT_SPECS.join(', ')+'</td><td style="text-align:left">kWh, min 5 / max 50</td></tr>'+
    '<tr><td style="text-align:left">DoD × RTE</td><td>0.9 × 0.95 = 0.855</td><td style="text-align:left">used by energy-flow simulation</td></tr>'+
    '<tr><td style="text-align:left">PV / inverter / battery unit price</td><td>550 / 330 / 400</td><td style="text-align:left">EUR per kWp / kWp / kWh</td></tr>'+
    '<tr><td style="text-align:left">Grid buy / sell</td><td>0.35 / 0.07</td><td style="text-align:left">EUR/kWh</td></tr></table></div>';
  let h='<div class="params-hero"><h2>📚 Parameter Library · 🇩🇪 DE</h2><p>Showing the full Germany parameter set (14 tables). AU parameters will be added later. All parameters are wired live into the R-H/R-B/N calculation flow.</p></div>';
  h+=blk('A1','Base Parameters (PV / inverter / battery / economics)','DE_base_parameters.md',baseTbl,true);
  h+=blk('A2','State Annual Load Defaults + Fallback Yield Factors','16 states',stateTbl,true);
  h+=blk('A3','Month Flags + Monthly Load / Generation Shares','12 months',monthTbl);
  h+=blk('A4','Usage Intensity Coefficients (UC)','4 levels',ucTbl);
  h+=blk('A5','Occupancy Coefficients','3 levels',occTbl);
  h+=blk('A6','HVAC Thermal Load','4 types',hvacTbl);
  h+=blk('A7','EV Charging Distribution (24 x 4 modes)','24 hours',evTbl);
  h+=blk('A8','Hour Flags (daytime / peak / rush)','24 hours',hourFlagTbl);
  h+=blk('A9','Hourly Load Share (DE_hourly_share)','national default',hourShareTbl);
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// ── Description Tab ──
function renderAbout(){
  document.getElementById('out').innerHTML='<div class="about">'+
    '<h1>Germany Load + System Calculator v4.2 · V1.13 Integration Notes</h1>'+
    '<p>v4.2 keeps the DE V1.13 four-step calculation chain from v4 and updates the existing-PV generation distribution: annual generation still uses the state fallback coefficient, while the 12x24 distribution prefers panel_location.json monthlyHourlyPowerList.</p>'+
    '<h2>1. Project-ID Auto Fetch</h2>'+
    '<p>After a project ID is entered on the left, the page fetches <code>request.json</code>, <code>panel_location.json</code>, and <code>detect_building.json</code>, then fills state, Q1-Q5, existing PV, SAM3D full-roof capacity, and 2D roof area automatically. R retrofit and N new build share the same project data.</p>'+
    '<h2>2. Load Profile Skip Support</h2>'+
    '<ul>'+
    '<li><b>Skip for now</b> button skips all Q1-Q5 inputs and uses preset defaults</li>'+
    '<li>Each Q1-Q5 dropdown has a Not sure / skip option at the top for single-question skips</li>'+
    '<li><b>Single-question skip defaults</b>:'+
      '<ul>'+
      '<li>Q1 home occupancy -> someone always at home (occ_v = 1.2, aligned with V1.13 DEFAULTS)</li>'+
      '<li>Q2 heating/cooling -> No system (t_base = 0)</li>'+
      '<li>Q3 usage intensity -> Medium (am = 1.0)</li>'+
      '<li>Q4 EV mileage -> No EV (0 km)</li>'+
      '<li>Q5 EV charging window -> Mostly overnight</li>'+
      '</ul></li>'+
    '<li>Dependent inputs hide automatically when skipped: Q2 skip -> hide Q3; Q4 skip -> hide Q5</li>'+
    '</ul>'+
    '<h2>3. R-H Branch 2 Adds a 13.16 Cap</h2>'+
    '<p>When the user selects Not sure / skip for R1, the formula is:</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">remaining       = roof_full_kwp_3d × 0.55\nexisting_pv_kwp = min(roof_full_kwp_3d × 0.45, <b style="color:var(--yel)">13.16</b>)</pre>'+
    '<p>The cap <code>13.16</code> equals <code>TIER_TARGET.C.base</code>, preventing back-calculated existing PV from exceeding the default C-tier target and causing zero R-H addition or inconsistent logic.</p>'+
    '<h2>4. R-H System Cost Counts Added PV Only</h2>'+
    '<p>The original version used <code>sysCost = PV_total x 550 + inverter + battery</code>, which counted the cost of existing PV. v3 changes it to:</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">sysCost = <b style="color:var(--yel)">added_kwp</b> × 550 + inv × 330 + bat × 400</pre>'+
    '<p>Existing PV is treated as an already-owned asset and excluded from upgrade cost. In R-B mode (added=0), PV cost becomes 0.</p>'+
    '<h2>5. N Scenario Adds SAM3D / 2D Inputs + Roof Physical Constraint</h2>'+
    '<p>The N scenario shares SAM3D full-roof kWp and 2D roof-area inputs with R-H. It adds this roof physical constraint:</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">target_pv_capped = min(target_pv_total, 25)\nroof_capped      = min(target_pv_capped, <b style="color:var(--yel)">SAM3D</b>)\npanels           = (ceil(roof_capped / panel_kw) and area <= SAM3D)</pre>'+
    '<p>Example: target 7.05 / SAM3D 3.76 -> roof_capped = 3.76 -> panels = 8 -> pv_pre = 3.76 kWp, marked as roof-limited.</p>'+
    '<h2>6. Existing PV Generation Distribution v4.2</h2>'+
    '<p>In the R retrofit scenario, existing PV annual generation is first calculated as <code>existing_kwp x STATE_YIELD[state]</code>. If panel_location.json is loaded, all valid panels <code>monthlyHourlyPowerList</code> matrices are summed as the distribution shape and then scaled to the fallback annual generation. If no valid panel matrix exists, the DE monthly/hourly fallback curve is used.</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">existing_annual = existing_kwp × STATE_YIELD[state]\nshape[m][h] = Σ_all_valid_panels monthlyHourlyPowerList[m][h]\nexisting_gen[m][h] = shape[m][h] × existing_annual / Σ(shape[m][h] × days[m])</pre>'+
    '<h2>7. V1.13 Energy Flow + ROI</h2>'+
    '<p>Step 3 uses a 12x24 monthly-hourly matrix and daily battery-cycle model to output SCR/SSR, import, and export. Step 4 calculates 20-year cashflow, IRR, NPV, and payback using German electricity-price parameters.</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">direct = min(gen, load)\ncharge = min(surplus, usable_capacity - soc)\ndischarge = min(deficit, soc × RTE)\nsaving = baseline_cost - remain_cost + export_income</pre>'+
    '<h2>References</h2>'+
    '<ul><li>V1.13 Germany Emily calculation scripts/de_load_profile.py</li><li>V1.13 Germany Emily calculation scripts/de_system_composition.py</li><li>V1.13 Germany Emily calculation scripts/de_energy_flow.py</li><li>V1.13 Germany Emily calculation scripts/de_roi_calculation.py</li></ul>'+
    '</div>';
}

// -- Startup --
bindTabs();
buildSidebar();
upd2();
