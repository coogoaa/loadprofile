// ═══════════════════════════════════════════════════════════════════════
//  德国负荷 + R-H 计算器 · 参数与计算逻辑
//  数据源：参考/德国版 Emily 计算/德国参数/DE_*.md
//          参考/德国版 Emily 计算/计算流程/R-H计算流程.md
// ═══════════════════════════════════════════════════════════════════════

// ── 德国参数：各州预设年用电量 / 兜底年发电系数 ───────────────────────
const DE_STATES=[
 ['BW','Baden-Württemberg','巴登-符腾堡州',3210,1123],
 ['BY','Bavaria','拜仁州（巴伐利亚）',3302,1123],
 ['BE','Berlin','柏林州',2469,1055],
 ['BB','Brandenburg','勃兰登堡州',3082,1052],
 ['HB','Bremen','不来梅州',2944,991],
 ['HH','Hamburg','汉堡州',2740,985],
 ['HE','Hesse','黑森州',3327,1079],
 ['NI','Lower Saxony','下萨克森州',3411,1017],
 ['MV','Mecklenburg-Vorpommern','梅克伦堡-前波美拉尼亚',2856,1022],
 ['NW','North Rhine–Westphalia','北莱茵-威斯特法伦',3280,1035],
 ['RP','Rhineland-Palatinate','莱茵兰-普法尔茨',3321,1100],
 ['SL','Saarland','萨尔州',3321,1089],
 ['SN','Saxony','萨克森州',2845,1067],
 ['ST','Saxony-Anhalt','萨克森-安哈尔特',3133,1074],
 ['SH','Schleswig-Holstein','石勒苏益格-荷尔斯泰因',3221,983],
 ['TH','Thuringia','图林根州',2994,1041]
];
const BASE={},YIELD={};DE_STATES.forEach(r=>{BASE[r[0]]=r[3];YIELD[r[0]]=r[4];});

// 月度用电比例（全国统一）
const DE_MONTHLY=[0.0789,0.0791,0.0773,0.0822,0.0839,0.0876,0.0917,0.0887,0.0853,0.0838,0.0819,0.0796];
// 月度发电兜底比例
const DE_GEN_MONTHLY=[0.022,0.0385,0.0725,0.1128,0.144,0.1514,0.1505,0.1294,0.0881,0.0514,0.0229,0.0165];
const DAYS_IN_MONTH=[31,28,31,30,31,30,31,31,30,31,30,31];
// 小时用电比例（全国统一）
const DE_HOURLY=[0.0301,0.0258,0.0239,0.0232,0.0236,0.0252,0.03,0.0358,0.041,0.0446,0.0474,0.0518,0.0513,0.0481,0.0459,0.0454,0.0475,0.0535,0.0587,0.0591,0.0556,0.0508,0.0451,0.0366];
// 月份标记
const MONTH_FLAGS=[[1,0,1,'Winter'],[2,0,1,'Winter'],[3,0,1,'Spring'],[4,0,1,'Spring'],[5,0,0,'Spring'],[6,1,0,'Summer'],[7,1,0,'Summer'],[8,1,0,'Summer'],[9,0,0,'Autumn'],[10,0,1,'Autumn'],[11,0,1,'Autumn'],[12,0,1,'Winter']];
const COOL_M=MONTH_FLAGS.map(r=>r[1]),HEAT_M=MONTH_FLAGS.map(r=>r[2]);
// 小时标记：[hour, daytime, cool_peak, heat_peak, morning_rush, evening_rush]
const HOUR_FLAGS=[[0,0,0,0,0,0],[1,0,0,0,0,0],[2,0,0,0,0,0],[3,0,0,0,0,0],[4,0,0,0,0,0],[5,0,0,0,0,0],[6,0,0,1,0,0],[7,0,0,1,0,0],[8,0,0,1,1,0],[9,1,0,1,1,0],[10,1,0,0,1,0],[11,1,0,0,0,0],[12,1,0,0,0,0],[13,1,0,0,0,0],[14,1,1,0,0,0],[15,1,1,0,0,0],[16,1,1,0,0,0],[17,1,1,0,0,0],[18,0,1,1,0,1],[19,0,1,1,0,1],[20,0,0,1,0,1],[21,0,0,1,0,0],[22,0,0,1,0,0],[23,0,0,0,0,0]];
const DTH=new Set(HOUR_FLAGS.filter(r=>r[1]).map(r=>r[0]));
const CPH=new Set(HOUR_FLAGS.filter(r=>r[2]).map(r=>r[0]));
const HPH=new Set(HOUR_FLAGS.filter(r=>r[3]).map(r=>r[0]));
// 暖通热负荷
const HVAC={"No heating or cooling system":0,"Air conditioning":0,"Electric heating":3000,"Heat pump (heating & cooling)":2000};
// 用电强度系数
const UC={Low:{am:0.7,cmm:1.05,hmm:1.08,cpm:1.10,hpm:1.08},Medium:{am:1.0,cmm:1.10,hmm:1.15,cpm:1.20,hpm:1.15},High:{am:1.3,cmm:1.20,hmm:1.25,cpm:1.35,hpm:1.25},"Very high":{am:1.6,cmm:1.35,hmm:1.40,cpm:1.50,hpm:1.40}};
// 在室占用系数
const OCC={"Mostly away during the day":0.6,"Working from home":1.4,"Someone always at home":1.2};
// EV 充电分布
const EVP={
 mostly_overnight:[0.125,0.125,0.125,0.125,0.125,0.125,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.125,0.125],
 mixed_day_and_night:[0.075,0.075,0.075,0.075,0.075,0.075,0,0,0,0,0.067,0.067,0.067,0.067,0.067,0.067,0,0,0,0,0,0,0.075,0.075],
 mostly_daytime:[0,0,0,0,0,0,0,0,0,0,0.167,0.167,0.167,0.167,0.167,0.167,0,0,0,0,0,0,0,0],
 solar_optimized:[0.025,0.025,0.025,0.025,0.025,0.025,0,0,0,0.04,0.072,0.104,0.128,0.136,0.128,0.104,0.088,0,0,0,0,0,0.025,0.025]
};
// PV 组件与屋顶
const PV_PANEL={p_kw:0.470,L_mm:1903,W_mm:1134};
const PANEL_AREA=1.903*1.134; // ≈2.158 m²
const ROOF_TILT_DEG=40,ROOF_USE_RATIO=0.45;
// 方案档目标 (base=默认, boost=触发时)
const TIER_TARGET={A:{base:7.05,boost:7.05,ratio:0.7},B:{base:10.34,boost:13.16,ratio:0.9},C:{base:13.16,boost:15.04,ratio:1.2}};
// 电池规格
const BATT_SPECS=[5,6.5,9.6,10,13.5,16,20,25,30,35,40,45,50];
const PV_HARDCAP=25,REMAIN_MIN_RH=2.0;
// 成本参数
const COST={pv_eur_per_kwp:550,inv_eur_per_kwp:330,batt_eur_per_kwh:400,grid_buy:0.35,grid_sell:0.07,daily_fixed:0.7,inflation:0.02,cash_rate:0.035};

const COOL_SYS=new Set(["Air conditioning","Heat pump (heating & cooling)"]);
const HEAT_SYS=new Set(["Electric heating","Heat pump (heating & cooling)"]);
const EV_KWH_PER_KM=0.18;
const MNZ=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const SYS_ZH={"No heating or cooling system":"无冷暖设备","Air conditioning":"空调","Electric heating":"电暖","Heat pump (heating & cooling)":"热泵（冷暖两用）"};
const USE_ZH={Low:"低",Medium:"中",High:"高","Very high":"非常高"};
const OCC_ZH={"Mostly away during the day":"白天大多不在家","Working from home":"在家办公","Someone always at home":"家中常有人"};

// ── Load Profile 计算（全部用 DE 参数） ────────────────────────────────
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

// ── R-H 计算（步骤 0 + 步骤 2）─────────────────────────────────────────
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
    if(roof_full_kwp_3d-existing>=PV_PANEL.p_kw){
      remaining=Math.max(0,roof_full_kwp_3d-existing);branch=1;
    }else if(roof_full_kwp_3d-existing<0){
      remaining=Math.max(0,roof_full_kwp_area-existing);branch=1.5;
    }else{
      remaining=Math.max(0,roof_full_kwp_area-existing);branch=3;
    }
    existing_out=existing;
  }else{
    remaining=roof_full_kwp_3d*0.55;
    existing_out=roof_full_kwp_3d*0.45;
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
  return{existing_input,userKnown,existing:existing_out,cos40,roof_area_m2,usable_area_m2,max_panels_area,roof_full_kwp_area,roof_full_kwp_3d,remaining,remaining_capped,branch,mode,trigger,tier,ratio,target_pv_total,target_added,added_kwp_pre,added_panels,added_kwp,PV_total,bat_target,bat_kWh,mask2d,sam3d};
}
function ceilToSpec(v,specs){for(const s of specs){if(s>=v)return s;}return specs[specs.length-1];}

// ── 工具 ────────────────────────────────────────────────────────────────
const f2=(v,d=2)=>v.toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const f0=v=>Math.round(v).toLocaleString('de-DE');
const fp=v=>v.toFixed(2)+'%';
const esc=s=>(''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function blk(n,title,badge,content,open=false,rh=false){
  return `<div class="sblock${rh?' rh':''}"><div class="shdr${open?' open':''}"><span class="snum${rh?' rh':''}">第${n}步</span><span class="stit">${title}</span><span class="sbadge">${badge}</span><span class="chev${open?' open':''}">▶</span></div><div class="sbody${open?' open':''}">${content}</div></div>`;
}
const srcTag=f=>`<span class="src-tag">📄 ${f}</span>`;

// 初始化州下拉
(function initStateOptions(){
  const sel=document.getElementById('s-state');
  DE_STATES.forEach(s=>{
    const op=document.createElement('option');
    op.value=s[0];op.textContent=`${s[0]} — ${s[2]}（${s[3]} kWh/年）`;
    sel.appendChild(op);
  });
  sel.value='NW'; // 默认北威州
})();
