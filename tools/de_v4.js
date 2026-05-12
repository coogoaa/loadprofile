// 德国负荷 + 方案计算器 v4 · DE · 中文
// v4 集成 V1.13：
// ① 继续沿用 v3 的 Load Profile / R-H / N 系统组成逻辑
// ② 新增 V1.13 步骤 3：12×24 能量流 + 日循环电池模拟
// ③ 新增 V1.13 步骤 4：DE 现金流、IRR、NPV、Payback
// ④ 可选上传 panel_location.json；未上传时使用 DE 兜底发电曲线估算新增 PV
// ── 参数 ──
const DE_STATES=[['BW','Baden-Württemberg','巴登-符腾堡',3210,1123],['BY','Bavaria','拜仁',3302,1123],['BE','Berlin','柏林',2469,1055],['BB','Brandenburg','勃兰登堡',3082,1052],['HB','Bremen','不来梅',2944,991],['HH','Hamburg','汉堡',2740,985],['HE','Hesse','黑森',3327,1079],['NI','Lower Saxony','下萨克森',3411,1017],['MV','Mecklenburg-Vorpommern','梅前',2856,1022],['NW','North Rhine–Westphalia','北威',3280,1035],['RP','Rhineland-Palatinate','莱普',3321,1100],['SL','Saarland','萨尔',3321,1089],['SN','Saxony','萨克森',2845,1067],['ST','Saxony-Anhalt','萨安',3133,1074],['SH','Schleswig-Holstein','石荷',3221,983],['TH','Thuringia','图林根',2994,1041]];
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
// v3 新增：分支 2 反推 existing_pv_kwp 的封顶值（= C 档默认目标 13.16 kWp），避免超过 C 方案目标值
const EXISTING_PV_BR2_CAP=13.16;
const SCR_TARGET=1.30,SCR_MAX=1.50,INV_MAX_KW=24;
const INV_SPECS={A:[5,6,8,10,12,15],B:[5,6,8,10,12,15],C:[5,6,8,10,12,15,18,20,22]};
const COST={pv_eur_per_kwp:550,inv_eur_per_kwp:330,batt_eur_per_kwh:400,grid_buy:0.35,grid_sell:0.07,daily_fixed:0.7,inflation:0.02,cash_rate:0.035,gst_rate:0};
const BATT_DOD=0.9,BATT_RTE=0.95,DEFAULT_ROI_YEARS=20;
const SOLAR_HOURLY=[0,0,0,0,0,0,0.015,0.045,0.075,0.105,0.13,0.145,0.15,0.14,0.12,0.095,0.06,0.025,0.005,0,0,0,0,0];
const COOL_SYS=new Set(["Air conditioning","Heat pump (heating & cooling)"]);
const HEAT_SYS=new Set(["Electric heating","Heat pump (heating & cooling)"]);
const EV_KWH_PER_KM=0.18;
const MNZ=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const SYS_ZH={"No heating or cooling system":"无冷暖设备","Air conditioning":"空调","Electric heating":"电暖","Heat pump (heating & cooling)":"热泵（冷暖两用）"};
const USE_ZH={Low:"低",Medium:"中",High:"高","Very high":"非常高"};
const OCC_ZH={"Mostly away during the day":"白天大多不在家","Working from home":"在家办公","Someone always at home":"家中常有人"};

// ── 工具 ──
const f2=(v,d=2)=>v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const f0=v=>Math.round(v).toLocaleString('de-DE');
const fp=v=>v.toFixed(2)+'%';
const esc=s=>(''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const srcTag=f=>`<span class="src-tag">📄 ${f}</span>`;
function ceilToSpec(v,specs){for(const s of specs){if(s>=v)return s;}return specs[specs.length-1];}
function blk(n,title,badge,content,open=false,kls=''){
  const cls=kls?'sblock '+kls:'sblock', sn=kls?'snum '+kls:'snum';
  return `<div class="${cls}"><div class="shdr${open?' open':''}"><span class="${sn}">第${n}步</span><span class="stit">${title}</span><span class="sbadge">${badge}</span><span class="chev${open?' open':''}">▶</span></div><div class="sbody${open?' open':''}">${content}</div></div>`;
}
function bindSblock(){
  document.querySelectorAll('.shdr').forEach(el=>{
    el.addEventListener('click',()=>{
      const b=el.nextElementSibling,ch=el.querySelector('.chev'),o=b.classList.contains('open');
      b.classList.toggle('open',!o);el.classList.toggle('open',!o);ch&&ch.classList.toggle('open',!o);
    });
  });
}

// ── 计算 ──
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
    // v3：分支 2（用户跳过既有 PV）
    //   remaining       = roof_full_kwp_3d × 0.55
    //   existing_pv_kwp = min(roof_full_kwp_3d × 0.45, 13.16)  ← 封顶避免超过 C 档目标
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
  // v3：N 场景新增屋顶物理约束 —— SAM3D 满铺 < 方案目标时，只能装 SAM3D
  const sam3d_v=Math.max(0,sam3d||0);
  const roof_capped=Math.min(target_pv_capped,sam3d_v);
  const roof_limited=sam3d_v>0&&sam3d_v<target_pv_capped;
  // 向上取整为整块面板，但不能超过 SAM3D 上限（向下取整保证不超屋顶）
  let panels=Math.floor(roof_capped/PV_PANEL.p_kw);
  // 兼容性：若 ceil 不超 SAM3D 则按 ceil（贴近 target）
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

// ── V1.13 步骤 3/4：选板、能量流、ROI ──
let uploadedPanels=[];
let uploadedPanelName='';
const DEFAULT_PROJECT_BASE_URL='https://file.greensketch.ai/marketing/test/debug';
let projectBaseUrl=DEFAULT_PROJECT_BASE_URL;
let activeProject=null;
let activeProjectInputs=null;
let projectStatus={type:'idle',text:'输入项目 ID 后会拉取 request / panel_location / detect_building，并自动填入本页参数。'};

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
    total+=Number(gp.annualGeneratePower)||0;
    const mh=gp.monthlyHourlyPowerList||[];
    if(mh.length===12){
      mh.forEach((row,m)=>{
        if(Array.isArray(row)&&row.length===24){
          row.forEach((v,h)=>{gen[m][h]+=Number(v)||0;});
        }
      });
    }
  });
  return{gen,total};
}
function buildExistingPVMatrix(existing_kwp,state){
  if(existing_kwp<=0)return{gen:emptyMatrix(),total:0};
  const annual=existing_kwp*(YIELD[state]||1000);
  const gen=emptyMatrix();
  for(let m=0;m<12;m++){
    const daily=annual*DE_GEN_MONTHLY[m]/DAYS_IN_MONTH[m];
    for(let h=0;h<24;h++)gen[m][h]=daily*DE_HOURLY[h];
  }
  return{gen,total:annual};
}
function buildFallbackGenerationMatrix(pv_kwp,state){
  // 页面无 panel_location.json 时，沿用 V1.13 既有 PV 的兜底拆分口径。
  return buildExistingPVMatrix(pv_kwp,state);
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
    const existingGen=buildExistingPVMatrix(rh.existing,state);
    const addedGen=addedChosen.length>0?buildGenerationMatrix(addedChosen):buildFallbackGenerationMatrix(rh.added_kwp,state);
    const gen=addMatrix(existingGen.gen,addedGen.gen);
    const sim=simulateBattery(gen,load,rh.bat_kWh);
    return{mode,gen,load,hShare,totals:sim,gen_info:{existing_kwp:rh.existing,existing_gen_total:existingGen.total,added_panels:rh.added_panels,added_gen_total:addedGen.total,total_gen_total:existingGen.total+addedGen.total,source:addedChosen.length>0?uploadedPanelName:'DE fallback'},matrix_gen_existing:existingGen.gen,matrix_gen_added:addedGen.gen};
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

// ── 项目 ID 数据拉取 / 映射 ──
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
  ensureSelectOption(document.getElementById('s-state'),p.state,(p.stateRaw?p.stateRaw+' → ':'')+p.state+'（项目数据）');
  if(p.q1!==undefined)ensureSelectOption(document.getElementById('s-q1'),p.q1,p.q1?'项目数据：'+(OCC_ZH[p.q1]||p.q1):'不知道 / 跳过（项目未提供）');
  if(p.q2!==undefined)ensureSelectOption(document.getElementById('s-q2'),p.q2,p.q2?'项目数据：'+(SYS_ZH[p.q2]||p.q2):'不知道 / 跳过（项目未提供）');
  if(p.q3!==undefined)ensureSelectOption(document.getElementById('s-q3'),p.q3,p.q3?'项目数据：'+(USE_ZH[p.q3]||p.q3):'不知道 / 跳过（项目未提供）');
  if(p.q4!==undefined)ensureSelectOption(document.getElementById('s-q4'),p.q4,p.q4?'项目数据：'+Number(p.q4).toLocaleString()+' km':'不知道 / 跳过（项目未提供）');
  if(p.q5!==undefined)ensureSelectOption(document.getElementById('s-q5'),p.q5,p.q5?'项目数据：'+p.q5:'不知道 / 跳过（项目未提供）');
  const sam=document.getElementById('s-3d');
  const area=document.getElementById('s-2d');
  if(sam)sam.value=roundInput(p.sam3d,2);
  if(area)area.value=roundInput(p.mask2d,2);
  const pv=document.getElementById('s-pv');
  if(pv){
    if(p.existingPv!=null)ensureSelectOption(pv,roundInput(p.existingPv,3),'项目数据：既有 PV '+roundInput(p.existingPv,2)+' kWp');
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
  if(!id){setProjectStatus('err','请先输入项目 ID。');return;}
  const btn=document.getElementById('btn-load-project');
  if(btn)btn.disabled=true;
  setProjectStatus('load','正在拉取项目 '+id+' 的 request / panel_location / detect_building ...');
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
    uploadedPanelName=uploadedPanels.length?'项目 '+id+' / panel_location.json':'项目 '+id+' / panel_location（无发电矩阵，使用 fallback）';
    currentScn=activeProjectInputs.preferredScn;
    projectStatus={
      type:'ok',
      text:'已加载项目 '+id+'：州 '+(activeProjectInputs.stateRaw||activeProjectInputs.state)+' → '+activeProjectInputs.state+
        '，SAM3D '+roundInput(activeProjectInputs.sam3d,2)+' kWp，2D 面积 '+roundInput(activeProjectInputs.mask2d,1)+' m²，panel '+activeProjectInputs.panelCount+
        ' 块，默认进入 '+(currentScn==='rh'?'R 改造':'N 新建')+' 场景。'
    };
    buildSidebar();
    upd2();
  }catch(err){
    setProjectStatus('err','拉取失败：'+err.message+'。若浏览器提示 CORS，请确认数据源允许前端读取，或继续用手动参数/上传 JSON。');
  }finally{
    const btn2=document.getElementById('btn-load-project');
    if(btn2)btn2.disabled=false;
  }
}

// ── Tab 状态 ──
let currentTab='calc',currentScn='rh';

// ── Sidebar ──
function buildSidebar(){
  const root=document.getElementById('side');
  if(currentTab==='params'){
    root.innerHTML=`<div class="slabel">参数库</div>
     <div class="field"><label>国家 / 地区</label>
      <select id="p-country"><option value="DE" selected>🇩🇪 德国 (DE)</option><option value="AU" disabled>🇦🇺 澳大利亚 (AU) — 待接入</option></select></div>
     <div class="note">已加载 <b>DE 参数 14 张</b>，详见右侧。AU 参数将在后续版本接入。</div>
     <div class="csv-src">📄 DE_预设各州年用电量.md<br>📄 DE_兜底年发电系数.md<br>📄 DE_月份/月度比例/月度发电兜底<br>📄 DE_小时标记/小时比例/小时发电兜底<br>📄 DE_用电强度系数.md<br>📄 DE_暖通空调热负荷.md<br>📄 DE 电动汽车充电负荷.md<br>📄 DE_基础参数.md<br>📄 GLOBAL_ev_params / occupancy</div>`;
    return;
  }
  if(currentTab==='about'){
    root.innerHTML=`<div class="slabel">v4 改进点</div>
     <div class="note skip">① 支持项目 ID 拉取 request / panel / detect<br>② 集成 V1.13 四步链路<br>③ 新增 12×24 能量流和电池日循环<br>④ 新增 DE 现金流、IRR、NPV、Payback</div>
     <div class="csv-src">📄 loadprofile_calculator_de_v4.html<br>📄 de_v4.js<br>📄 V1.13 德国 emily 计算/脚本</div>`;
    return;
  }
  const isN=currentScn==='n';
  root.innerHTML=`<div class="slabel">项目数据</div>
    <div class="field"><label>项目 ID</label>
      <div class="project-fetch">
        <input type="text" id="p-id" placeholder="例如 11199" value="${activeProjectInputs?esc(activeProjectInputs.projectId):''}">
        <button id="btn-load-project">拉取</button>
      </div></div>
    <div class="field"><label>数据源 Base URL</label>
      <input type="url" id="p-base" value="${esc(projectBaseUrl)}"></div>
    ${projectStatusHtml()}
    <div class="slabel">场景模式</div>
    <div class="scn-toggle">
      <button data-scn="rh" class="${!isN?'active':''}">🛠 R 改造</button>
      <button data-scn="n"  class="${ isN?'active':''}">🆕 N 全套新建</button>
    </div>
    <div class="slabel">负荷参数（Load Profile）</div>
    <div class="skip-row">
      <button id="btn-skipall" class="skipall" title="一键跳过 Q1–Q5，使用预设默认计算">🔄 Skip for now</button>
      <button id="btn-resetdef" title="恢复演示输入值">↩ 重置演示</button>
    </div>
    <div class="field"><label>联邦州</label><select id="s-state"></select></div>
    <div class="field"><label><span class="qb">Q1</span> 在家模式</label>
      <select id="s-q1">
        <option value="">不知道 / 跳过（默认家中常有人）</option>
        <option value="Mostly away during the day">白天大多不在家（0.6×）</option>
        <option value="Working from home" selected>在家办公（1.4×）</option>
        <option value="Someone always at home">家中常有人（1.2×）</option>
      </select></div>
    <div class="field"><label><span class="qb">Q2</span> 冷暖设备</label>
      <select id="s-q2">
        <option value="">不知道 / 跳过（默认无冷暖设备）</option>
        <option value="Heat pump (heating &amp; cooling)" selected>热泵（冷暖两用，2000）</option>
        <option value="Air conditioning">空调（仅制冷，0）</option>
        <option value="Electric heating">电暖（仅制热，3000）</option>
        <option value="No heating or cooling system">无冷暖设备</option>
      </select></div>
    <div class="field" id="f-q3"><label><span class="qb">Q3</span> 使用强度</label>
      <select id="s-q3">
        <option value="">不知道 / 跳过（默认 Medium 1.0）</option>
        <option value="Low">低（0.7）</option>
        <option value="Medium" selected>中（1.0）</option>
        <option value="High">高（1.3）</option>
        <option value="Very high">非常高（1.6）</option>
      </select></div>
    <div class="field"><label><span class="qb">Q4</span> EV 年均里程</label>
      <select id="s-q4">
        <option value="">不知道 / 跳过（默认 No EV）</option>
        <option value="0">无电动车</option>
        <option value="5000">5,000 km</option>
        <option value="10000" selected>10,000 km</option>
        <option value="15000">15,000 km</option>
        <option value="20000">20,000 km</option>
        <option value="25000">25,000+ km</option>
      </select></div>
    <div class="field hidden" id="f-q5"><label><span class="qb">Q5</span> EV 充电时段</label>
      <select id="s-q5">
        <option value="">不知道 / 跳过（默认 Mostly overnight）</option>
        <option value="mostly_overnight" selected>主要夜间充电</option>
        <option value="mixed_day_and_night">日夜混合</option>
        <option value="mostly_daytime">主要白天</option>
        <option value="solar_optimized">光伏优化</option>
      </select></div>
    <div id="rh-only-fields" class="${isN?'hidden':''}">
      <div class="slabel">R 专属输入（既有 PV）</div>
      <div class="field"><label><span class="qb qbR">R1</span> 既有 PV 容量</label>
        <select id="s-pv">
          <option value="-1">不知道 / 跳过（按 55% 估算）</option>
          <option value="4">Under 5 kWp（→ 4）</option>
          <option value="7" selected>5–10 kWp（→ 7）</option>
          <option value="12">10–15 kWp（→ 12）</option>
          <option value="17">15–20 kWp（→ 17）</option>
          <option value="22">20+ kWp（→ 22）</option>
        </select></div>
    </div>
    <div class="slabel">屋顶参数（SAM3D + 2D）</div>
    <div class="field"><label><span class="qb ${isN?'qbN':'qbR'}">${isN?'N2':'R2'}</span> SAM3D 满铺 kWp</label>
      <input type="number" id="s-3d" value="14" step="0.5" min="0"></div>
    <div class="field"><label><span class="qb ${isN?'qbN':'qbR'}">${isN?'N3':'R3'}</span> 屋顶 2D 面积 m²</label>
      <input type="number" id="s-2d" value="60" step="1" min="0"></div>
    <div class="field"><label>panel_location.json（可选）</label>
      <input type="file" id="s-panels" accept="application/json,.json"></div>
    <div class="note">未上传面板数据时，步骤 3 使用 DE 兜底年发电系数 + 月/小时兜底曲线估算；上传后按 V1.13 逻辑选年发电量最高的面板。</div>
    <div class="slabel">方案档</div>
    <div class="field"><label>${isN?'<span class="qb qbN">N1</span>':'<span class="qb qbR">R4</span>'} 方案档</label>
      <select id="s-tier">
        <option value="A">A 经济（配储 0.7）</option>
        <option value="B" selected>B 标准（配储 0.9）</option>
        <option value="C">C 高端（配储 1.2）</option>
      </select></div>
    <div class="field"><label>ROI 年限</label>
      <input type="number" id="s-years" value="${DEFAULT_ROI_YEARS}" step="1" min="1" max="40"></div>
    ${isN?'<div class="note"><b>N 场景</b>：屋顶无既有光伏；按方案目标推 PV + 逆变器 + 电池。容配比 130%/150%，PV ≤ 25 kWp。<br><b style="color:var(--yel)">V1.13：</b>若 SAM3D 满铺 &lt; 方案目标，PV 只能装到 SAM3D 满铺。</div>':'<div class="note">所有参数变动即时重算。R-H 在 existing&lt;25 且剩余≥2 kWp 时启用，否则降级 R-B。<br><b style="color:var(--yel)">V1.13：</b>系统造价仅算新增 PV 部分，不含既有 PV 。</div>'}
    <div class="note skip"><b>V1.13 跳过规则</b>：Q1–Q5 选「不知道 / 跳过」则使用预设默认值；Q1 默认家中常有人，R1 跳过时反推 existing_pv = min(3D×0.45, 13.16)。</div>
    <div class="csv-src">📄 DE V1.13 德国 Emily 计算<br>📄 de_load_profile.py<br>📄 de_system_composition.py<br>📄 de_energy_flow.py<br>📄 de_roi_calculation.py<br>${uploadedPanels.length?`📄 已加载 ${uploadedPanelName} (${uploadedPanels.length} panels)`:'📄 panel_location.json 未上传，使用 fallback'}</div>`;
  const sel=document.getElementById('s-state');
  DE_STATES.forEach(s=>{const op=document.createElement('option');op.value=s[0];op.textContent=`${s[0]} — ${s[2]}（${s[3]} kWh/年）`;sel.appendChild(op);});
  sel.value='NW';
  applyProjectInputsToForm();
  bindProjectLoader(root);
  root.querySelectorAll('.scn-toggle button').forEach(b=>b.addEventListener('click',()=>{currentScn=b.dataset.scn;buildSidebar();upd2();}));
  // v3：Skip for now / 重置默认 按钮
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
      uploadedPanels=Array.isArray(parsed)?parsed:[];
      uploadedPanelName=file.name;
      buildSidebar();
      upd2();
    }).catch(err=>{
      uploadedPanels=[];
      uploadedPanelName='';
      alert('panel_location.json 解析失败：'+err.message);
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
  // v3：跳过同样隐藏 Q3/Q5（跳过 = 无冷暖 / 无 EV）
  if(f3) f3.classList.toggle('hidden',sys==='No heating or cooling system'||sys==='');
  if(f5) f5.classList.toggle('hidden',km==='0'||km==='');
  // v3：跳过状态高亮
  [['s-q1',q1],['s-q2',sys],['s-q3',q3],['s-q4',km],['s-q5',q5]].forEach(([id,v])=>{
    const e=document.getElementById(id);if(e) e.classList.toggle('skipped',v==='');
  });
  const sysIn=sys||'No heating or cooling system';
  const usageIn=q3||'Medium';
  const kmIn=parseInt(km)||0;
  const occIn=q1||'Someone always at home';
  const evcIn=q5||'mostly_overnight';
  const r=calcLoad(document.getElementById('s-state').value,sysIn,usageIn,kmIn,occIn,evcIn);
  // 附加跳过标志，供渲染使用
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
    // v3: N 场景传入 SAM3D / 2D，启用屋顶物理约束
    const n=calcN(r,tier,sam3d,mask2d);
    const composition={n};
    const energy=buildEnergyFlow('N',r,composition,uploadedPanels);
    const roi=buildROI('N',composition,energy,years);
    renderN(r,n,energy,roi);
  }
}

// ── 渲染：Load Profile 公共部分 ──
function renderLP(r){
  const stateName=DE_STATES.find(s=>s[0]===r.state);
  const sk=r.skips||{},skipCount=r.skipCount||0;
  const szh=sk.q2?'<span style="color:var(--yel)">跳过 → 无冷暖设备</span>':(SYS_ZH[r.system]||r.system);
  const uzh=sk.q3?'<span style="color:var(--yel)">跳过 → Medium (1.0)</span>':(USE_ZH[r.usage]||r.usage);
  const ozh=sk.q1?'<span style="color:var(--yel)">跳过 → 家中常有人 (1.2×)</span>':(OCC_ZH[r.occ]||r.occ);
  const mxd=Math.max(...r.fkd),mxm=Math.max(...r.fkm);
  const skipHint=skipCount>0?'<div class="note skip" style="margin-bottom:10px"><b>⚠ 已跳过 '+skipCount+' 项</b>：'+
    [sk.q1&&'Q1 在家模式',sk.q2&&'Q2 冷暖设备',sk.q3&&'Q3 使用强度',sk.q4&&'Q4 EV 里程',sk.q5&&'Q5 EV 充电时段'].filter(Boolean).join(' · ')+
    '。跳过项使用预设默认值。</div>':'';
  const evDisp=sk.q4?'<span style="color:var(--yel)">跳过 → 0 km (No EV)</span>':(r.miles.toLocaleString()+' km');
  let h=blk('一','年用电量（DE）',f0(r.final)+' kWh'+(skipCount>0?' · 跳过 '+skipCount:''),
    skipHint+
    '<div class="ssec"><div class="sstit">输入回显</div>'+
    '<div class="kvrow"><span class="k">联邦州</span><span class="v">'+stateName[0]+' · '+stateName[2]+'</span></div>'+
    '<div class="kvrow"><span class="k">基准 BASE</span><span class="v">'+f0(r.base)+' kWh/年</span></div>'+
    '<div class="kvrow"><span class="k">在家模式</span><span class="v'+(sk.q1?' skip':'')+'">'+ozh+' ('+r.occ_v.toFixed(2)+'×)</span></div>'+
    '<div class="kvrow"><span class="k">冷暖设备</span><span class="v'+(sk.q2?' skip':'')+'">'+szh+'</span></div>'+
    '<div class="kvrow"><span class="k">使用强度</span><span class="v'+(sk.q3?' skip':'')+'">'+uzh+' (am='+r.u.am.toFixed(2)+')</span></div>'+
    '<div class="kvrow"><span class="k">EV 里程</span><span class="v'+(sk.q4?' skip':'')+'">'+evDisp+'</span></div></div>'+
    '<div class="ssec"><div class="sstit">合计 '+srcTag('DE_预设各州年用电量.md')+'</div>'+
    '<div class="fml">年用电量 = BASE + 暖通 + EV = '+f0(r.base)+' + '+f2(r.t_ext)+' + '+f2(r.ev_ext)+' <span class="r">= '+f2(r.final)+' kWh</span></div></div>');
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
  h+=blk('二','月度分布','',
    '<div class="ssec"><div class="sstit">月份标记 '+srcTag('DE_月份标记.md')+'</div>'+
    '<div style="font-size:11px;color:var(--dim);font-family:var(--mono)">制冷月：6,7,8月 &nbsp;|&nbsp; 制热月：1,2,3,4,10,11,12月</div></div>'+
    '<div class="ssec"><div class="sstit">逐月明细 '+srcTag('DE_月度比例.md')+'</div>'+
    '<div style="display:flex;gap:14px;align-items:flex-end"><div style="flex:1"><div class="mchart">'+mbars+'</div><div class="mlbls">'+MNZ.map(m=>'<span>'+m.replace('月','')+'</span>').join('')+'</div></div>'+
    '<div class="legend"><span style="color:#0088aa">■</span> 制冷季<br><span style="color:#8b2e1a">■</span> 制热季<br><span style="color:#8050b8">■</span> 冷暖季</div></div>'+
    '<div class="tw"><table><tr><th>月份</th><th>基础</th><th>季节系数</th><th>归一</th><th>暖通</th><th>EV</th><th>月用电</th><th>占比</th><th></th></tr>'+mrows+'</table></div></div>');
  const brows=Array.from({length:24},(_,hh)=>{
    const isD=DTH.has(hh),isCp=CPH.has(hh)&&r.pc,isHp=HPH.has(hh)&&r.ph,isEV=r.ev_dist[hh]>0;
    const cls=isD?'d':(isCp||isHp)?'p':isEV?'e':'';
    return '<div class="brow"><div class="blbl">H'+String(hh).padStart(2,'0')+'</div><div class="btrk"><div class="bfil '+cls+'" style="width:'+(r.fkd[hh]/mxd*100)+'%"></div></div><div class="bval">'+r.fkd[hh].toFixed(3)+'</div></div>';
  }).join('');
  h+=blk('三','24小时分布','日均 '+f2(r.davg,2)+' kWh',
    '<div class="ssec"><div class="sstit">公式 '+srcTag('DE_小时比例.md')+'</div>'+
    '<div class="fml">非EV[h] = (BASE+暖通)/365 × 归一份额[h]   <span class="c">日均非EV='+f2(r.dne,4)+'</span>\nEV[h]   = (EV额外/365) × EV分布[h]            <span class="c">日均EV='+f2(r.dev,4)+'</span></div></div>'+
    '<div class="ssec"><div class="sstit">逐小时</div>'+
    '<div style="display:flex;gap:12px"><div class="legend" style="white-space:nowrap"><span style="color:var(--yel)">■</span> 白天<br><span style="color:var(--ora)">■</span> 暖通峰<br><span style="color:var(--grn)">■</span> EV充电</div><div style="flex:1">'+brows+'</div></div></div>');
  h+=blk('四','负荷曲线最终输出','参考用',
    '<div class="ssec"><div class="sstit">时段切分（DE）</div>'+
    '<div class="fml">日均  = '+f2(r.davg,4)+' kWh\n白天 H09–H17  <span class="r">'+f2(r.dtk,4)+' kWh ('+fp(r.dtp)+')</span>\n晚高峰 H18–H20 <span class="r">'+f2(r.epk,4)+' kWh ('+fp(r.epp)+')</span>\n夜间(非白天)  <span class="r">'+f2(r.onk,4)+' kWh ('+fp(r.onp)+')</span></div>'+
    '<div class="ogrid"><div class="ocard"><div class="ocl">☀ 白天</div><div class="ocv">'+fp(r.dtp)+'</div><div class="ock">'+f2(r.dtk,2)+' kWh</div></div>'+
    '<div class="ocard"><div class="ocl">🌆 晚高峰</div><div class="ocv">'+fp(r.epp)+'</div><div class="ock">'+f2(r.epk,2)+' kWh</div></div>'+
    '<div class="ocard"><div class="ocl">🌙 夜间</div><div class="ocv">'+fp(r.onp)+'</div><div class="ock">'+f2(r.onk,2)+' kWh</div></div></div>'+
    '<div class="note" style="margin-top:10px">DE 电池容量按<b>配储率</b>推荐，不直接由用电时段驱动；本表用于方案对比与人工调整参考。'+srcTag('容配比校验流程_DE.md')+'</div></div>');
  return h;
}

function renderInverterBlock(stepNo,pv_pre,inv,tier){
  const specsStr=INV_SPECS[tier].map(s=>s===inv.inv_kw?'<b style="color:var(--ac)">['+s+']</b>':s).join(' · ');
  const okBadge=inv.scr<=SCR_MAX
    ?'<span class="modeBadge modePass">SCR '+fp(inv.scr_pct)+' ✓</span>'
    :'<span class="modeBadge modeWarn">SCR '+fp(inv.scr_pct)+' 超限</span>';
  let actionFml='';
  if(inv.action==='ok'){
    actionFml='<span class="c"># 直接命中：从规格库取 ≥ '+f2(inv.target_kw,2)+' kW 的最小值</span>\ninverter_kw = <span class="r">'+inv.inv_kw+' kW</span>\nSCR = '+f2(pv_pre,2)+' / '+inv.inv_kw+' = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓ ≤ 150%';
  }else if(inv.action==='maxed-but-ok'){
    actionFml='<span class="o"># 已达本档最大规格 '+inv.inv_kw+' kW，但 SCR 仍 ≤ 150%</span>\ninverter_kw = <span class="r">'+inv.inv_kw+' kW</span>\nSCR = '+f2(pv_pre,2)+' / '+inv.inv_kw+' = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓';
  }else if(inv.action==='curtail'){
    actionFml='<span class="o"># SCR 超限：触发面板削减</span>\nmax_pv = '+inv.inv_kw+' × 1.5 = <span class="r">'+f2(inv.inv_kw*1.5,2)+' kWp</span>\npanels = floor('+f2(inv.inv_kw*1.5,2)+' / '+PV_PANEL.p_kw+') = <span class="r">'+inv.curtail_panels+' 块</span>\nfinal_pv = <span class="r">'+f2(inv.final_pv,2)+' kWp</span>\nSCR = <span class="r">'+fp(inv.scr_pct)+'</span>  ✓';
  }
  const content=
    '<div class="ssec"><div class="sstit">DE 容配比参数 '+srcTag('容配比校验流程_DE.md')+' '+srcTag('DE_基础参数.md')+'</div>'+
    '<div class="fml">target_SCR = 130%   |   max_SCR = 150%\ninverter_phase = 三相   |   inverter_max = 24 kW\n本方案规格库 ('+tier+') = '+specsStr+'</div></div>'+
    '<div class="ssec"><div class="sstit">逆变器选型</div>'+
    '<div class="fml">target_kw = PV / 1.30 = '+f2(pv_pre,2)+' / 1.30 = <span class="r">'+f2(inv.target_kw,2)+' kW</span>\n'+actionFml+'</div></div>'+
    '<div class="ssec"><div class="sstit">校验结果</div>'+okBadge+'</div>';
  return blk(stepNo,'逆变器选型 + 容配比校验',inv.inv_kw+' kW · SCR '+fp(inv.scr_pct),content,false,'');
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
  const content=
    '<div class="ssec"><div class="sstit">V1.13 步骤 3 输入 '+srcTag('de_energy_flow.py')+'</div>'+
    '<div class="kvrow"><span class="k">发电数据源</span><span class="v">'+esc(g.source)+'</span></div>'+
    '<div class="kvrow"><span class="k">既有 PV 发电</span><span class="v">'+f0(existingDisplayTotal)+' kWh/年</span></div>'+
    '<div class="kvrow"><span class="k">新增 PV 发电</span><span class="v">'+f0(addedDisplayTotal)+' kWh/年</span></div>'+
    '<div class="kvrow"><span class="k">电池可用容量</span><span class="v">'+f2(t.usable_capacity,2)+' kWh (DoD '+BATT_DOD+')</span></div></div>'+
    '<div class="ssec"><div class="sstit">电池日循环模型</div>'+
    '<div class="fml">direct = min(gen, load)\nsurplus = gen - direct\ncharge = min(surplus, usable_capacity - soc)\ndischarge = min(deficit, soc × RTE)\nexport = surplus - charge\nimport = deficit - discharge</div></div>'+
    '<div class="ssec"><div class="sstit">年度结果</div>'+
    '<div class="ogrid n5">'+
    '<div class="ocard '+kls+'"><div class="ocl">年发电</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(t.gen_total)+'</div><div class="ock">kWh</div></div>'+
    '<div class="ocard"><div class="ocl">年用电</div><div class="ocv">'+f0(t.load_total)+'</div><div class="ock">kWh</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">SCR 自用率</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+fp(t.SCR*100)+'</div><div class="ock">direct+discharge / gen</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">SSR 自给率</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+fp(t.SSR*100)+'</div><div class="ock">direct+discharge / load</div></div>'+
    '<div class="ocard"><div class="ocl">购电 / 馈网</div><div class="ocv">'+f0(t.import_grid)+'</div><div class="ock">import · export '+f0(t.export)+'</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">发电拆分</div>'+
    '<div class="ogrid">'+
    '<div class="ocard"><div class="ocl">既有 PV 发电</div><div class="ocv">'+f0(existingDisplayTotal)+'</div><div class="ock">kWh/年</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">新增 PV 发电</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(addedDisplayTotal)+'</div><div class="ock">kWh/年 · '+g.added_panels+' 块</div></div>'+
    '<div class="ocard"><div class="ocl">总发电</div><div class="ocv">'+f0(t.gen_total)+'</div><div class="ock">既有 + 新增</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">月度汇总</div><div class="tw"><table><tr><th>月</th><th>既有PV</th><th>新增PV</th><th>总发电</th><th>用电</th><th>直接</th><th>电池放电</th><th>馈网</th><th>购电</th><th>月自用率</th></tr>'+monthlyRows+
    '<tr class="hi"><td>合计</td><td>'+f0(existingDisplayTotal)+'</td><td>'+f0(addedDisplayTotal)+'</td><td>'+f0(t.gen_total)+'</td><td>'+f0(t.load_total)+'</td><td>'+f0(t.direct)+'</td><td>'+f0(t.discharge)+'</td><td>'+f0(t.export)+'</td><td>'+f0(t.import_grid)+'</td><td>'+fp(t.SCR*100)+'</td></tr></table></div></div>'+
    '<div class="ssec"><div class="sstit">自检</div><div class="fml">发电守恒 direct + charge + export = '+f2(balGen,2)+' ↔ gen_total '+f2(t.gen_total,2)+'\n用电守恒 direct + discharge + import = '+f2(balLoad,2)+' ↔ load_total '+f2(t.load_total,2)+'</div></div>';
  return blk(stepNo,'【V1.13 · 步骤 3】能量流模拟','SCR '+fp(t.SCR*100)+' · SSR '+fp(t.SSR*100),content,false,kls);
}

function renderROIBlock(stepNo,roi,kls){
  const c=roi.cost;
  const firstRows=roi.rows.filter(r=>r.year<=5);
  const last=roi.rows[roi.rows.length-1];
  const rows=firstRows.concat(last.year>5?[last]:[]);
  const rowHtml=rows.map(r=>{
    if(r.year===0)return '<tr><td>0</td><td>–</td><td>–</td><td>–</td><td>–</td><td>'+f0(r.cumulative)+' 投资</td></tr>';
    return '<tr><td>'+r.year+'</td><td>'+f0(r.baseline_cost)+'</td><td>'+f0(r.remain_cost)+'</td><td>'+f0(r.export_income)+'</td><td>'+f0(r.saving)+'</td><td>'+f0(r.cumulative)+'</td></tr>';
  }).join('');
  const irrTxt=roi.IRR==null?'–':fp(roi.IRR*100);
  const pbTxt=roi.payback_years==null?'–':f2(roi.payback_years,2)+' 年';
  const content=
    '<div class="ssec"><div class="sstit">V1.13 步骤 4 成本 '+srcTag('de_roi_calculation.py')+'</div>'+
    '<div class="tw"><table><tr><th style="text-align:left">项</th><th>单价</th><th>用量</th><th>金额</th></tr>'+
    '<tr><td style="text-align:left">PV</td><td>550 €/kWp</td><td>'+f2(c.pv_basis_kwp,2)+' kWp</td><td>'+f0(c.pv_cost)+' €</td></tr>'+
    '<tr><td style="text-align:left">逆变器</td><td>330 €/kW</td><td>'+f2(c.inv_kw,1)+' kW</td><td>'+f0(c.inv_cost)+' €</td></tr>'+
    '<tr><td style="text-align:left">电池</td><td>400 €/kWh</td><td>'+f2(c.bat_kwh,1)+' kWh</td><td>'+f0(c.bat_cost)+' €</td></tr>'+
    '<tr class="hi"><td style="text-align:left">总投资</td><td>GST 0%</td><td>–</td><td>'+f0(c.total)+' €</td></tr></table></div></div>'+
    '<div class="ssec"><div class="sstit">现金流公式</div>'+
    '<div class="fml">baseline_cost[t] = load_total × 0.35 × (1+0.02)^(t-1) + 0.7×365\nremain_cost[t] = import × 0.35 × (1+0.02)^(t-1) + 0.7×365\nexport_income[t] = export × 0.07\nsaving[t] = baseline_cost - remain_cost + export_income</div></div>'+
    '<div class="ssec"><div class="sstit">关键指标</div>'+
    '<div class="ogrid n4">'+
    '<div class="ocard '+kls+'"><div class="ocl">IRR</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+irrTxt+'</div><div class="ock">Newton + bisection</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">NPV @ 3.5%</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+f0(roi.NPV)+'</div><div class="ock">€</div></div>'+
    '<div class="ocard '+kls+'"><div class="ocl">Payback</div><div class="ocv '+(kls==='rh'?'ora':'pur')+'">'+pbTxt+'</div><div class="ock">线性插值</div></div>'+
    '<div class="ocard"><div class="ocl">第 1 年节省</div><div class="ocv">'+f0(roi.rows[1]?.saving||0)+'</div><div class="ock">€</div></div></div></div>'+
    '<div class="ssec"><div class="sstit">现金流预览</div><div class="tw"><table><tr><th>年</th><th>不装系统</th><th>装后购电</th><th>馈网收入</th><th>年节省</th><th>累计净现金流</th></tr>'+rowHtml+'</table></div></div>';
  return blk(stepNo,'【V1.13 · 步骤 4】ROI 投资回报',irrTxt+' · NPV €'+f0(roi.NPV),content,false,kls);
}

// ── R-H 渲染 ──
function renderRH(r,rh,inv,energy,roi){
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">年用电量</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/年</div></div>'+
    '<div class="card"><div class="cl">日均用电</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/天</div></div>'+
    '<div class="card hi2"><div class="cl">模式</div><div class="cv ora">'+rh.mode+'</div><div class="cu">'+(rh.mode==='R-H'?'光储混合扩容':'纯储能升级')+'</div></div>'+
    '<div class="card hi2"><div class="cl">PV 总容量</div><div class="cv ora">'+f2(rh.PV_total,2)+'</div><div class="cu">kWp（增 '+f2(rh.added_kwp,2)+'）</div></div>'+
    '<div class="card hi"><div class="cl">逆变器</div><div class="cv">'+inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="card hi2"><div class="cl">推荐电池</div><div class="cv ora">'+f2(rh.bat_kWh,1)+'</div><div class="cu">kWh（'+rh.tier+'档 ×'+rh.ratio+'）</div></div></div>';
  h+=renderLP(r);
  // ── 步骤 0：既有 PV 容量映射（v3：分支 2 增加 13.16 封顶展示） ──
  const pvOpts=[[4,'Under 5 kWp','区间中位偏下；DE 早期老系统多在 3–5'],[7,'5–10 kWp','DE 老系统主流段中位'],[12,'10–15 kWp','中位'],[17,'15–20 kWp','中位'],[22,'20+ kWp','25 kWp 硬约束保守值']];
  const pvMapTbl='<div class="tw"><table><tr><th>前端选项</th><th>映射</th><th style="text-align:left">取值理由</th></tr>'+
    pvOpts.map(o=>'<tr class="'+(rh.userKnown&&rh.existing===o[0]?'hi':'')+'"><td>'+o[1]+'</td><td>'+o[0]+'</td><td style="text-align:left">'+o[2]+'</td></tr>').join('')+
    '<tr class="'+(!rh.userKnown?'skip':'')+'"><td>Not sure / 跳过</td><td>min(3D×0.45, 13.16)</td><td style="text-align:left">SAM3D × 0.45 反推；<b style="color:var(--yel)">v3 新增封顶 13.16</b> 避免超过 C 档目标</td></tr></table></div>';
  let br2Fml;
  if(!rh.userKnown){
    br2Fml='<div class="fml">'+
      '<span class="c"># v3：用户跳过 R1 → 按 SAM3D × 0.45 反推，再与 13.16 取小</span>\n'+
      'existing_raw   = '+f2(rh.roof_full_kwp_3d,2)+' × 0.45 = <span class="o">'+f2(rh.br2_existing_raw,2)+' kWp</span>\n'+
      'existing_cap   = <span class="y">'+f2(rh.br2_cap,2)+' kWp</span>  <span class="c"># = TIER_TARGET.C.base（避免超 C 档目标）</span>\n'+
      'existing_pv_kwp = min(existing_raw, existing_cap) = <span class="r">'+f2(rh.existing,2)+' kWp</span>'+
      (rh.br2_capped?'  <span class="y">⚠ 触发封顶</span>':'  <span class="c"># 未触发封顶</span>')+
      '</div>';
  }else{
    br2Fml='<div class="fml">existing_pv_kwp = <span class="r">'+f2(rh.existing,2)+' kWp</span> <span class="c"># 用户选项直接映射</span></div>';
  }
  h+=blk('五','【R-H · 步骤 0】既有 PV 容量映射','existing = '+f2(rh.existing,2)+' kWp'+(rh.br2_capped?' · 封顶':''),
    '<div class="ssec"><div class="sstit">选项 → 数值映射 '+srcTag('R-H计算流程.md')+'</div>'+pvMapTbl+'</div>'+
    '<div class="ssec"><div class="sstit">本次取值</div>'+br2Fml+'</div>',false,'rh');
  const branchDesc={
    1:'分支 1：用 3D 差值',
    1.5:'分支 1（兜底）：3D−existing &lt; 0，使用 2D 面积兜底',
    2:'分支 2：用户未填 → remaining = 3D×0.55； existing = <b>min</b>(3D×0.45, <b>13.16</b>) <span style="color:var(--yel)">← v3 新增封顶</span>',
    3:'分支 3：SAM3D 铺不上 → 使用 2D 面积兜底'
  }[rh.branch];
  let br2Detail='';
  if(rh.branch===2){
    br2Detail='\n<span class="c"># 分支 2 反推明细：</span>\n'+
      'existing_raw    = 3D × 0.45 = '+f2(rh.roof_full_kwp_3d,2)+' × 0.45 = <span class="o">'+f2(rh.br2_existing_raw,2)+' kWp</span>\n'+
      'existing_capped = min(existing_raw, <span class="y">13.16</span>) = <span class="r">'+f2(rh.existing,2)+' kWp</span>'+
      (rh.br2_capped?'  <span class="y">⚠ 触发 13.16 封顶</span>':'  <span class="c"># 未触发封顶</span>');
  }
  h+=blk('六','【R-H · 步骤 2.1】屋顶面积 + 剩余可铺设','remaining = '+f2(rh.remaining,2)+' kWp',
    '<div class="ssec"><div class="sstit">参数 '+srcTag('DE_基础参数.md')+'</div>'+
    '<div class="kvrow"><span class="k">屋顶坡度</span><span class="v">'+ROOF_TILT_DEG+'°</span></div>'+
    '<div class="kvrow"><span class="k">单板面积/功率</span><span class="v">'+f2(PANEL_AREA,3)+' m² / '+PV_PANEL.p_kw+' kW</span></div>'+
    '<div class="kvrow"><span class="k">屋顶利用率</span><span class="v">'+ROOF_USE_RATIO+'</span></div>'+
    '<div class="kvrow"><span class="k">分支 2 反推封顶（v3）</span><span class="v">existing ≤ 13.16 kWp</span></div>'+
    '<div class="kvrow"><span class="k">2D / SAM3D 输入</span><span class="v">'+f2(rh.mask2d,1)+' m² / '+f2(rh.sam3d,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">2D 兜底</div>'+
    '<div class="fml">roof = mask_2d / cos(40°) = '+f2(rh.roof_area_m2,2)+' m²\nusable = '+f2(rh.usable_area_m2,2)+' m²\nmax_panels = '+rh.max_panels_area+' 块  →  <span class="r">'+f2(rh.roof_full_kwp_area,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">分支判定</div>'+
    '<div class="fml"><span class="o">'+branchDesc+'</span>\nremaining = <span class="r">'+f2(rh.remaining,3)+' kWp</span>\nremaining_capped = <span class="r">'+f2(rh.remaining_capped,3)+' kWp</span>'+br2Detail+'</div></div>',false,'rh');
  let modeFml;
  if(rh.existing>=PV_HARDCAP) modeFml='existing('+f2(rh.existing,2)+') ≥ 25 → R-B';
  else if(rh.remaining_capped<REMAIN_MIN_RH) modeFml='remaining_capped &lt; 2.0 → R-B';
  else modeFml='existing &lt; 25 且 remaining_capped ≥ 2.0 → R-H';
  h+=blk('七','【R-H · 步骤 2.2】模式判定','<span class="modeBadge '+(rh.mode==='R-H'?'modeRH':'modeRB')+'">'+rh.mode+'</span>',
    '<div class="ssec"><div class="sstit">业务规则</div>'+
    '<div class="fml">if existing &gt;= 25:           R-B\nelif remaining_capped &lt; 2:  R-B\nelse:                       R-H</div></div>'+
    '<div class="ssec"><div class="sstit">本次判定</div>'+
    '<div class="fml"><span class="r">'+modeFml+'</span></div></div>',false,'rh');
  const tierTbl='<div class="tw"><table><tr><th>档</th><th>默认 target</th><th>触发上调</th><th>配储率</th></tr>'+
    '<tr class="'+(rh.tier==='A'?'hi':'')+'"><td>A 经济</td><td>7.05</td><td>7.05</td><td>0.7</td></tr>'+
    '<tr class="'+(rh.tier==='B'?'hi':'')+'"><td>B 标准</td><td>10.34</td><td>13.16</td><td>0.9</td></tr>'+
    '<tr class="'+(rh.tier==='C'?'hi':'')+'"><td>C 高端</td><td>13.16</td><td>15.04</td><td>1.2</td></tr></table></div>';
  let rhCalcFml;
  if(rh.mode==='R-H'){
    rhCalcFml='target_added = max(0, '+f2(rh.target_pv_total,2)+' − '+f2(rh.existing,2)+') = <span class="r">'+f2(rh.target_added,2)+' kWp</span>\nadded_kwp_pre = min(target_added, remaining_capped) = <span class="r">'+f2(rh.added_kwp_pre,2)+' kWp</span>\nadded_panels = floor('+f2(rh.added_kwp_pre,2)+' / '+PV_PANEL.p_kw+') = <span class="r">'+rh.added_panels+' 块</span>\nadded_kwp = <span class="r">'+f2(rh.added_kwp,2)+' kWp</span>\nPV_total = <span class="r">'+f2(rh.PV_total,2)+' kWp</span> (≤25 ✅)';
  }else{
    rhCalcFml='<span class="c"># R-B：不加板</span>\nPV_total = existing = <span class="r">'+f2(rh.PV_total,2)+' kWp</span>';
  }
  h+=blk('八','【R-H · 步骤 2.3】方案档目标 + 增量光伏','PV_total = '+f2(rh.PV_total,2)+' kWp',
    '<div class="ssec"><div class="sstit">方案档参数表 '+srcTag('DE_基础参数.md')+'</div>'+tierTbl+'</div>'+
    '<div class="ssec"><div class="sstit">触发条件</div>'+
    '<div class="fml">trigger = (EV&gt;0) ∨ heat_pump ∨ electric_heat = <span class="r">'+rh.trigger+'</span>\ntarget = <span class="r">'+f2(rh.target_pv_total,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">增量计算</div>'+
    '<div class="fml">'+rhCalcFml+'</div></div>',false,'rh');
  h+=renderInverterBlock('九',rh.PV_total,inv,rh.tier);
  const specsBadge=BATT_SPECS.map(s=>s===rh.bat_kWh?'<b style="color:var(--ora)">['+s+']</b>':s).join(' · ');
  h+=blk('十','【R-H · 步骤 2.4】电池容量推荐',f2(rh.bat_kWh,1)+' kWh',
    '<div class="ssec"><div class="sstit">配储率法 '+srcTag('DE_基础参数.md')+'</div>'+
    '<div class="fml">storage_ratio = {A:0.7, B:0.9, C:1.2}['+rh.tier+'] = <span class="r">'+rh.ratio+'</span>\nBat_target = '+f2(rh.PV_total,2)+' × '+rh.ratio+' = <span class="r">'+f2(rh.bat_target,2)+' kWh</span></div></div>'+
    '<div class="ssec"><div class="sstit">向上取整（最低 5，最高 50）</div>'+
    '<div class="fml">规格集: '+specsBadge+'\nBat_kWh = <span class="r">'+f2(rh.bat_kWh,1)+' kWh</span></div></div>',false,'rh');
  const annualGen=rh.PV_total*YIELD[r.state];
  // v3: 系统造价仅算新增 added_kwp，不含既有 PV（R-B 时 added_kwp=0 → PV 成本=0）
  const pvCost=rh.added_kwp*COST.pv_eur_per_kwp;
  const sysCost=pvCost+inv.inv_kw*COST.inv_eur_per_kwp+rh.bat_kWh*COST.batt_eur_per_kwh;
  const noAdd=rh.added_kwp<=0;
  h+=blk('十一','【R-H 综合结果】方案概览',rh.mode+' · '+rh.tier+'档',
    '<div class="ogrid n5">'+
    '<div class="ocard rh"><div class="ocl">📐 既有 PV</div><div class="ocv ora">'+f2(rh.existing,2)+'</div><div class="ock">kWp （不计入造价）</div></div>'+
    '<div class="ocard rh"><div class="ocl">➕ 新增 PV</div><div class="ocv ora">'+f2(rh.added_kwp,2)+'</div><div class="ock">kWp ('+rh.added_panels+'块)</div></div>'+
    '<div class="ocard rh"><div class="ocl">☀️ PV 总</div><div class="ocv ora">'+f2(rh.PV_total,2)+'</div><div class="ock">kWp</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ 逆变器</div><div class="ocv">'+inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="ocard rh"><div class="ocl">🔋 电池</div><div class="ocv ora">'+f2(rh.bat_kWh,1)+'</div><div class="ock">kWh</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">附：年发电 + 粗算造价（v3：仅计新增 PV）'+srcTag('DE_兜底年发电系数.md')+'</div>'+
    '<div class="fml">兜底系数('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\n年发电 ≈ '+f2(rh.PV_total,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/年</span>\n自给率 ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\n<span class="c"># v3：系统造价仅算新增 PV 部分，不含既有 PV 资产</span>\nPV   : <span class="y">added_kwp</span> '+f2(rh.added_kwp,2)+' × 550 = '+f0(pvCost)+' €'+(noAdd?'  <span class="y">⚠ R-B/无增量 → PV 成本 = 0</span>':'')+'\n<span class="c"># 既有 PV '+f2(rh.existing,2)+' kWp 不计入造价</span>\n逆变器: '+inv.inv_kw+' × 330  = '+f0(inv.inv_kw*COST.inv_eur_per_kwp)+' €\n电池 : '+f2(rh.bat_kWh,1)+' × 400 = '+f0(rh.bat_kWh*COST.batt_eur_per_kwh)+' €\n合计 = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'rh');
  h+=renderEnergyFlowBlock('十二',energy,'rh');
  h+=renderROIBlock('十三',roi,'rh');
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// ── N 全套新建渲染 ──
function renderN(r,n,energy,roi){
  const tierTbl='<div class="tw"><table><tr><th>档</th><th>默认 target</th><th>触发上调</th><th>配储率</th></tr>'+
    '<tr class="'+(n.tier==='A'?'hi':'')+'"><td>A 经济</td><td>7.05</td><td>7.05</td><td>0.7</td></tr>'+
    '<tr class="'+(n.tier==='B'?'hi':'')+'"><td>B 标准</td><td>10.34</td><td>13.16</td><td>0.9</td></tr>'+
    '<tr class="'+(n.tier==='C'?'hi':'')+'"><td>C 高端</td><td>13.16</td><td>15.04</td><td>1.2</td></tr></table></div>';
  const roofBadge=n.roof_limited?'<span class="modeBadge modeSkip" title="屋顶受限">⚠ 屋顶受限</span>':'<span class="modeBadge modePass">✓ 屋顶足够</span>';
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">年用电量</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/年</div></div>'+
    '<div class="card"><div class="cl">日均用电</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/天</div></div>'+
    '<div class="card hi3"><div class="cl">模式</div><div class="cv pur">N · 全套新建</div><div class="cu">'+n.tier+'档'+(n.roof_limited?' · 屋顶受限':'')+'</div></div>'+
    '<div class="card hi3"><div class="cl">PV 容量</div><div class="cv '+(n.roof_limited?'yel':'pur')+'">'+f2(n.actual_pv,2)+'</div><div class="cu">kWp ('+n.actual_panels+' 块)'+(n.roof_limited?' ⚠':'')+'</div></div>'+
    '<div class="card hi"><div class="cl">逆变器</div><div class="cv">'+n.inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="card hi3"><div class="cl">推荐电池</div><div class="cv pur">'+f2(n.bat_kWh,1)+'</div><div class="cu">kWh · ratio '+n.ratio+'</div></div></div>';
  h+=renderLP(r);
  h+=blk('五','【N · 步骤 1】方案档目标','target = '+f2(n.target_pv_total,2)+' kWp',
    '<div class="ssec"><div class="sstit">方案档参数表 '+srcTag('德国 N 场景计算流程.md')+' '+srcTag('DE_基础参数.md')+'</div>'+tierTbl+'</div>'+
    '<div class="ssec"><div class="sstit">触发条件检查</div>'+
    '<div class="fml">trigger = (EV&gt;0) ∨ heat_pump ∨ electric_heat\n       = ('+r.miles+'&gt;0) ∨ '+(r.system==='Heat pump (heating & cooling)')+' ∨ '+(r.system==='Electric heating')+'\n       = <span class="r">'+n.trigger+'</span>\n\ntarget_pv_total = <span class="r">'+f2(n.target_pv_total,2)+' kWp</span>\ntarget_pv_capped = min(target, 25) = <span class="r">'+f2(n.target_pv_capped,2)+' kWp</span>  <span class="c"># PV 硬上限</span></div></div>',false,'n');
  // v3 新增：N 场景屋顶物理约束检查
  h+=blk('六','【N · 步骤 1.5】屋顶物理约束（v3）',roofBadge+' roof_capped = '+f2(n.roof_capped,2)+' kWp',
    '<div class="ssec"><div class="sstit">SAM3D 封顶规则</div>'+
    '<div class="fml"><span class="c"># v3：N 场景增加屋顶物理约束——若 SAM3D 满铺 &lt; 方案目标，PV 只能装到 SAM3D 满铺</span>\n'+
      'SAM3D 满铺 = <span class="r">'+f2(n.sam3d,2)+' kWp</span>\n'+
      'target_pv_capped = <span class="r">'+f2(n.target_pv_capped,2)+' kWp</span>\n'+
      'roof_capped = min(target_pv_capped, SAM3D) = min('+f2(n.target_pv_capped,2)+', '+f2(n.sam3d,2)+') = <span class="r">'+f2(n.roof_capped,2)+' kWp</span>'+
      (n.roof_limited?'  <span class="y">⚠ SAM3D &lt; 目标→屋顶受限，只能出 '+f2(n.sam3d,2)+' kWp</span>':'  <span class="c"># 屋顶足够装入目标</span>')+
      '</div></div>'+
    '<div class="ssec"><div class="sstit">2D 面积参考</div>'+
    '<div class="kvrow"><span class="k">2D 输入</span><span class="v">'+f2(n.mask2d,1)+' m²</span></div>'+
    '<div class="kvrow"><span class="k">SAM3D 输入</span><span class="v">'+f2(n.sam3d,2)+' kWp</span></div>'+
    '<div class="note">2D 面积仅作参考显示；N 场景以 SAM3D 为屋顶物理上限。</div></div>',false,'n');
  h+=blk('七','【N · 步骤 2】PV 实装（面板取整 + 屋顶上限）','pv_pre = '+f2(n.pv_pre,2)+' kWp',
    '<div class="ssec"><div class="sstit">面板取整（不超过屋顶）</div>'+
    '<div class="fml">panels = (ceil(roof_capped / panel_kw) 且 面积 ≤ SAM3D)\n       = <span class="r">'+n.panels+' 块</span>\npv_pre = '+n.panels+' × '+PV_PANEL.p_kw+' = <span class="r">'+f2(n.pv_pre,2)+' kWp</span>\nassert pv_pre ≤ min(25, SAM3D='+f2(n.sam3d,2)+') ✅</div></div>'+
    '<div class="note">v3：面板取整遵守双重上限 — PV_HARDCAP=25 与 SAM3D，避免超过屋顶。</div>',false,'n');
  h+=renderInverterBlock('八',n.pv_pre,n.inv,n.tier);
  const specsBadge=BATT_SPECS.map(s=>s===n.bat_kWh?'<b style="color:var(--pur)">['+s+']</b>':s).join(' · ');
  h+=blk('九','【N · 步骤 4】电池容量推荐（配储率法）',f2(n.bat_kWh,1)+' kWh',
    '<div class="ssec"><div class="sstit">配储率 '+srcTag('DE_基础参数.md')+' '+srcTag('容配比校验流程_DE.md')+'</div>'+
    '<div class="fml">storage_ratio = {A:0.7, B:0.9, C:1.2}['+n.tier+'] = <span class="r">'+n.ratio+'</span>\nBat_target = PV_actual × ratio = '+f2(n.actual_pv,2)+' × '+n.ratio+' = <span class="r">'+f2(n.bat_target,2)+' kWh</span></div></div>'+
    '<div class="ssec"><div class="sstit">向上取整（最低 5，最高 50）</div>'+
    '<div class="fml">规格集: '+specsBadge+'\nBat_kWh = <span class="r">'+f2(n.bat_kWh,1)+' kWh</span></div></div>'+
    '<div class="note">DoD = 0.9 · RTE = 0.95 用于后续能量流仿真，不进入电池规格选型。</div>',false,'n');
  const annualGen=n.actual_pv*YIELD[r.state];
  const sysCost=n.actual_pv*COST.pv_eur_per_kwp+n.inv.inv_kw*COST.inv_eur_per_kwp+n.bat_kWh*COST.batt_eur_per_kwh;
  h+=blk('十','【N 综合结果】方案概览','N · '+n.tier+'档'+(n.roof_limited?' · 屋顶受限':''),
    '<div class="ogrid n4">'+
    '<div class="ocard n"><div class="ocl">☀️ PV 容量'+(n.roof_limited?' ⚠':'')+'</div><div class="ocv '+(n.roof_limited?'yel':'pur')+'">'+f2(n.actual_pv,2)+'</div><div class="ock">kWp ('+n.actual_panels+' 块)'+(n.roof_limited?' · 屋顶受限':'')+'</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ 逆变器</div><div class="ocv">'+n.inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="ocard n"><div class="ocl">🔋 电池</div><div class="ocv pur">'+f2(n.bat_kWh,1)+'</div><div class="ock">kWh · ratio '+n.ratio+'</div></div>'+
    '<div class="ocard"><div class="ocl">💰 系统造价</div><div class="ocv">'+f0(sysCost)+'</div><div class="ock">€（税前粗算）</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">附：年发电 + 粗算造价 '+srcTag('DE_兜底年发电系数.md')+'</div>'+
    '<div class="fml">兜底系数('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\n年发电 ≈ '+f2(n.actual_pv,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/年</span>\n自给率 ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\nPV   : '+f2(n.actual_pv,2)+' × 550 = '+f0(n.actual_pv*COST.pv_eur_per_kwp)+' €\n逆变器: '+n.inv.inv_kw+' × 330  = '+f0(n.inv.inv_kw*COST.inv_eur_per_kwp)+' €\n电池 : '+f2(n.bat_kWh,1)+' × 400 = '+f0(n.bat_kWh*COST.batt_eur_per_kwh)+' €\n合计 = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'n');
  h+=renderEnergyFlowBlock('十一',energy,'n');
  h+=renderROIBlock('十二',roi,'n');
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// ── 参数库 Tab 渲染 ──
function renderParams(){
  const stateTbl='<div class="tw"><table><tr><th>缩写</th><th style="text-align:left">英文</th><th style="text-align:left">中文</th><th>年用电 kWh</th><th>发电系数</th></tr>'+
    DE_STATES.map(s=>'<tr><td>'+s[0]+'</td><td style="text-align:left">'+s[1]+'</td><td style="text-align:left">'+s[2]+'</td><td>'+s[3]+'</td><td>'+s[4]+'</td></tr>').join('')+'</table></div>';
  const monthTbl='<div class="tw"><table><tr><th>月份</th><th>cool</th><th>heat</th><th>季节</th><th>天数</th><th>用电占比</th><th>发电占比</th></tr>'+
    MONTH_FLAGS.map((m,i)=>'<tr><td>'+MNZ[i]+'</td><td>'+m[1]+'</td><td>'+m[2]+'</td><td>'+m[3]+'</td><td>'+DAYS_IN_MONTH[i]+'</td><td>'+DE_MONTHLY[i].toFixed(4)+'</td><td>'+DE_GEN_MONTHLY[i].toFixed(4)+'</td></tr>').join('')+'</table></div>';
  const ucTbl='<div class="tw"><table><tr><th>强度</th><th>annual</th><th>cool_month</th><th>heat_month</th><th>cool_peak</th><th>heat_peak</th></tr>'+
    Object.entries(UC).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v.am+'</td><td>'+v.cmm+'</td><td>'+v.hmm+'</td><td>'+v.cpm+'</td><td>'+v.hpm+'</td></tr>').join('')+'</table></div>';
  const occTbl='<div class="tw"><table><tr><th>occupancy</th><th>daytime_mult</th><th>白天时段</th><th style="text-align:left">说明</th></tr>'+
    Object.entries(OCC).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td><td>H09–H17</td><td style="text-align:left">'+OCC_ZH[k]+'</td></tr>').join('')+'</table></div>';
  const hvacTbl='<div class="tw"><table><tr><th style="text-align:left">system</th><th>base_thermal_load_kwh</th><th style="text-align:left">说明</th></tr>'+
    '<tr><td style="text-align:left">No heating/cooling</td><td>0</td><td style="text-align:left">无额外电量</td></tr>'+
    '<tr><td style="text-align:left">Air conditioning</td><td>0</td><td style="text-align:left">仅重分配冷季月份和峰时段</td></tr>'+
    '<tr><td style="text-align:left">Electric heating</td><td>3000</td><td style="text-align:left">德国冬季寒冷；电采暖基础热负荷较高</td></tr>'+
    '<tr><td style="text-align:left">Heat pump</td><td>2000</td><td style="text-align:left">热泵效率高；但德国冬季供暖需求大</td></tr></table></div>';
  const evTbl='<div class="tw"><table><tr><th>小时</th><th>overnight</th><th>mixed</th><th>daytime</th><th>solar_opt</th></tr>'+
    Array.from({length:24},(_,hh)=>'<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+EVP.mostly_overnight[hh]+'</td><td>'+EVP.mixed_day_and_night[hh]+'</td><td>'+EVP.mostly_daytime[hh]+'</td><td>'+EVP.solar_optimized[hh]+'</td></tr>').join('')+'</table></div>';
  const flagRows=HOUR_FLAGS.map(([hh,dt,cp,hp,mr,er])=>{
    const flags=[];
    if(dt)flags.push('☀白天');if(cp)flags.push('❄制冷峰');if(hp)flags.push('🔥制热峰');
    if(mr)flags.push('🌅早高峰');if(er)flags.push('🌆晚高峰');
    return '<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+dt+'</td><td>'+cp+'</td><td>'+hp+'</td><td>'+mr+'</td><td>'+er+'</td><td class="tag" style="text-align:left">'+flags.join(' ')+'</td></tr>';
  }).join('');
  const hourFlagTbl='<div class="tw"><table><tr><th>小时</th><th>白天</th><th>制冷峰</th><th>制热峰</th><th>早高峰</th><th>晚高峰</th><th style="text-align:left">说明</th></tr>'+flagRows+'</table></div>';
  const hourShareTbl='<div class="tw"><table><tr><th>小时</th><th>占比</th></tr>'+
    DE_HOURLY.map((v,hh)=>'<tr><td>H'+String(hh).padStart(2,'0')+'</td><td>'+v.toFixed(4)+'</td></tr>').join('')+'</table></div>';
  const baseTbl='<div class="tw"><table><tr><th style="text-align:left">参数</th><th>值</th><th style="text-align:left">说明</th></tr>'+
    '<tr><td style="text-align:left">PV 单板功率</td><td>'+PV_PANEL.p_kw+' kW</td><td style="text-align:left">JKM470N-60HL4，1903×1134 mm</td></tr>'+
    '<tr><td style="text-align:left">屋顶坡度（默认）</td><td>'+ROOF_TILT_DEG+'°</td><td style="text-align:left">cos40 ≈ 0.766</td></tr>'+
    '<tr><td style="text-align:left">屋顶利用率</td><td>'+ROOF_USE_RATIO+'</td><td style="text-align:left">2D 兜底面积法</td></tr>'+
    '<tr><td style="text-align:left">PV 硬上限</td><td>'+PV_HARDCAP+' kWp</td><td style="text-align:left">户用强制约束</td></tr>'+
    '<tr><td style="text-align:left">target / max SCR</td><td>130% / 150%</td><td style="text-align:left">容配比目标 / 上限</td></tr>'+
    '<tr><td style="text-align:left">逆变器最大功率</td><td>'+INV_MAX_KW+' kW</td><td style="text-align:left">DE 三相电，按 CMS 卡 24kW</td></tr>'+
    '<tr><td style="text-align:left">逆变器规格 A/B</td><td>'+INV_SPECS.A.join(', ')+'</td><td style="text-align:left">三相 kW</td></tr>'+
    '<tr><td style="text-align:left">逆变器规格 C</td><td>'+INV_SPECS.C.join(', ')+'</td><td style="text-align:left">三相 kW</td></tr>'+
    '<tr><td style="text-align:left">配储率 A/B/C</td><td>0.7 / 0.9 / 1.2</td><td style="text-align:left">PV × ratio = 电池目标</td></tr>'+
    '<tr><td style="text-align:left">电池规格库</td><td>'+BATT_SPECS.join(', ')+'</td><td style="text-align:left">kWh，min 5 / max 50</td></tr>'+
    '<tr><td style="text-align:left">DoD × RTE</td><td>0.9 × 0.95 = 0.855</td><td style="text-align:left">能量流仿真用</td></tr>'+
    '<tr><td style="text-align:left">PV / 逆变器 / 电池单价</td><td>550 / 330 / 400</td><td style="text-align:left">EUR per kWp / kWp / kWh</td></tr>'+
    '<tr><td style="text-align:left">购电 / 售电</td><td>0.35 / 0.07</td><td style="text-align:left">EUR/kWh</td></tr></table></div>';
  let h='<div class="params-hero"><h2>📚 参数库 · 🇩🇪 DE</h2><p>当前展示德国参数全集（14 张数据表）。AU 参数将在后续版本接入。所有参数与 R-H/R-B/N 计算流程实时联动。</p></div>';
  h+=blk('A1','基础参数（PV/逆变器/电池/经济）','DE_基础参数.md',baseTbl,true);
  h+=blk('A2','各州预设年用电 + 兜底发电系数','16 州',stateTbl,true);
  h+=blk('A3','月份标记 + 月度用电/发电比例','12 月',monthTbl);
  h+=blk('A4','用电强度系数 (UC)','4 档',ucTbl);
  h+=blk('A5','在室占用系数 (occupancy)','3 档',occTbl);
  h+=blk('A6','暖通空调热负荷 (HVAC)','4 类',hvacTbl);
  h+=blk('A7','EV 充电分布 (24×4 模式)','24 小时',evTbl);
  h+=blk('A8','小时标志位 (daytime/peak/rush)','24 小时',hourFlagTbl);
  h+=blk('A9','小时用电比例 (DE_hourly_share)','全国统一',hourShareTbl);
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// ── 说明 Tab ──
function renderAbout(){
  document.getElementById('out').innerHTML='<div class="about">'+
    '<h1>德国负荷 + 方案计算器 v4 · V1.13 集成说明</h1>'+
    '<p>v4 在 v3 基础上接入 DE V1.13 的四步计算链路：Load Profile、系统组成、能量流、ROI。</p>'+
    '<h2>① 项目 ID 自动拉取</h2>'+
    '<p>左侧输入项目 ID 后，页面会拉取 <code>request.json</code>、<code>panel_location.json</code>、<code>detect_building.json</code>，自动填入州、Q1-Q5、既有 PV、SAM3D 满铺和 2D 屋顶面积。R 改造与 N 新建共用同一份项目数据。</p>'+
    '<h2>② Load Profile 跳过支持</h2>'+
    '<ul>'+
    '<li><b>� Skip for now</b> 按钮一键全部跳过 Q1–Q5，使用预设默认计算</li>'+
    '<li>Q1–Q5 每个下拉框顶部新增「不知道 / 跳过」选项，可单题跳过</li>'+
    '<li><b>单题跳过默认值</b>：'+
      '<ul>'+
      '<li>Q1 在家模式 → 家中常有人（occ_v = 1.2，对齐 V1.13 DEFAULTS）</li>'+
      '<li>Q2 冷暖设备 → No system（t_base = 0）</li>'+
      '<li>Q3 使用强度 → Medium（am = 1.0）</li>'+
      '<li>Q4 EV 里程 → No EV（0 km）</li>'+
      '<li>Q5 EV 充电时段 → Mostly overnight</li>'+
      '</ul></li>'+
    '<li>跳过项会在依赖关系下自动隐藏：Q2 跳过 → Q3 隐藏；Q4 跳过 → Q5 隐藏</li>'+
    '</ul>'+
    '<h2>③ R-H 分支 2 新增 13.16 封顶</h2>'+
    '<p>当用户在 R1 选择「不知道 / 跳过」时，原公式：</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">remaining       = roof_full_kwp_3d × 0.55\nexisting_pv_kwp = min(roof_full_kwp_3d × 0.45, <b style="color:var(--yel)">13.16</b>)</pre>'+
    '<p>封顶值 <code>13.16</code> = <code>TIER_TARGET.C.base</code>，避免反推出的既有 PV 超过 C 方案默认目标值，导致 R-H 增量为 0 或逻辑不一致。</p>'+
    '<h2>④ R-H 系统造价仅计新增 PV</h2>'+
    '<p>原版本中 <code>sysCost = PV_total × 550 + 逆变器 + 电池</code>，会把既有 PV 的钱也算进去。v3 改为：</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">sysCost = <b style="color:var(--yel)">added_kwp</b> × 550 + inv × 330 + bat × 400</pre>'+
    '<p>既有 PV 作为用户已有资产不计入升级造价。R-B 模式（added=0）时 PV 成本 → 0。</p>'+
    '<h2>⑤ N 场景增加 SAM3D / 2D 输入 + 屋顶物理约束</h2>'+
    '<p>N 场景与 R-H 共用 SAM3D 满铺 kWp 与屋顶 2D 面积输入。新增屋顶物理约束：</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">target_pv_capped = min(target_pv_total, 25)\nroof_capped      = min(target_pv_capped, <b style="color:var(--yel)">SAM3D</b>)\npanels           = (ceil(roof_capped / panel_kw) 且 面积 ≤ SAM3D)</pre>'+
    '<p>例：目标 7.05 / SAM3D 3.76 → roof_capped = 3.76 → panels = 8 → pv_pre = 3.76 kWp，并标记 ⚠ 屋顶受限。</p>'+
    '<h2>⑥ V1.13 能量流 + ROI</h2>'+
    '<p>步骤 3 使用 12×24 月度小时矩阵和日循环电池模型，输出 SCR/SSR、购电、馈网；步骤 4 用德国电价参数计算 20 年现金流、IRR、NPV 和 Payback。</p>'+
    '<pre style="background:var(--sur2);padding:10px;border-radius:4px;font-family:var(--mono);font-size:12px;color:var(--blue)">direct = min(gen, load)\ncharge = min(surplus, usable_capacity - soc)\ndischarge = min(deficit, soc × RTE)\nsaving = baseline_cost - remain_cost + export_income</pre>'+
    '<h2>参考文档</h2>'+
    '<ul><li>V1.13 德国 emily 计算/脚本/de_load_profile.py</li><li>V1.13 德国 emily 计算/脚本/de_system_composition.py</li><li>V1.13 德国 emily 计算/脚本/de_energy_flow.py</li><li>V1.13 德国 emily 计算/脚本/de_roi_calculation.py</li></ul>'+
    '</div>';
}

// ── 启动 ──
bindTabs();
buildSidebar();
upd2();
