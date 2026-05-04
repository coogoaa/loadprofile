// 德国负荷 + 方案计算器 v2 · 自包含
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
const SCR_TARGET=1.30,SCR_MAX=1.50,INV_MAX_KW=24;
const INV_SPECS={A:[5,6,8,10,12,15],B:[5,6,8,10,12,15],C:[5,6,8,10,12,15,18,20,22]};
const COST={pv_eur_per_kwp:550,inv_eur_per_kwp:330,batt_eur_per_kwh:400,grid_buy:0.35,grid_sell:0.07,daily_fixed:0.7,inflation:0.02,cash_rate:0.035};
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
const esc=s=>(''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
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
  }else{remaining=roof_full_kwp_3d*0.55;existing_out=roof_full_kwp_3d*0.45;branch=2;}
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
function calcN(load,tier){
  const trigger=(load.miles>0)||load.system==='Heat pump (heating & cooling)'||load.system==='Electric heating';
  const tierObj=TIER_TARGET[tier];
  const target_pv_total=trigger?tierObj.boost:tierObj.base;
  const target_pv_capped=Math.min(target_pv_total,PV_HARDCAP);
  let panels=Math.ceil(target_pv_capped/PV_PANEL.p_kw);
  if(panels*PV_PANEL.p_kw>PV_HARDCAP) panels=Math.floor(PV_HARDCAP/PV_PANEL.p_kw);
  const pv_pre=panels*PV_PANEL.p_kw;
  const inv=pickInverter(pv_pre,tier);
  const actual_pv=inv.final_pv;
  const actual_panels=Math.round(actual_pv/PV_PANEL.p_kw);
  const ratio=tierObj.ratio;
  const bat_target=actual_pv*ratio;
  const bat_kWh=ceilToSpec(Math.max(5,bat_target),BATT_SPECS);
  return{trigger,tier,ratio,target_pv_total,target_pv_capped,panels,pv_pre,inv,actual_pv,actual_panels,bat_target,bat_kWh};
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
    root.innerHTML=`<div class="slabel">v2 改进点</div>
     <div class="note">① 顶部 Tab 切换<br>② 新增 N 全套新建场景<br>③ 参数库独立 Tab，预留多国家</div>
     <div class="csv-src">📄 loadprofile_calculator_de_v2.html<br>📄 de_v2.js（自包含）</div>`;
    return;
  }
  const isN=currentScn==='n';
  root.innerHTML=`<div class="slabel">场景模式</div>
    <div class="scn-toggle">
      <button data-scn="rh" class="${!isN?'active':''}">🛠 R-H 改造</button>
      <button data-scn="n"  class="${ isN?'active':''}">🆕 N 全套新建</button>
    </div>
    <div class="slabel">负荷参数（Load Profile）</div>
    <div class="field"><label>联邦州</label><select id="s-state"></select></div>
    <div class="field"><label><span class="qb">Q1</span> 在家模式</label>
      <select id="s-q1">
        <option value="Mostly away during the day">白天大多不在家（0.6×）</option>
        <option value="Working from home" selected>在家办公（1.4×）</option>
        <option value="Someone always at home">家中常有人（1.2×）</option>
      </select></div>
    <div class="field"><label><span class="qb">Q2</span> 冷暖设备</label>
      <select id="s-q2">
        <option value="Heat pump (heating &amp; cooling)" selected>热泵（冷暖两用，2000）</option>
        <option value="Air conditioning">空调（仅制冷，0）</option>
        <option value="Electric heating">电暖（仅制热，3000）</option>
        <option value="No heating or cooling system">无冷暖设备</option>
      </select></div>
    <div class="field" id="f-q3"><label><span class="qb">Q3</span> 使用强度</label>
      <select id="s-q3">
        <option value="Low">低（0.7）</option>
        <option value="Medium" selected>中（1.0）</option>
        <option value="High">高（1.3）</option>
        <option value="Very high">非常高（1.6）</option>
      </select></div>
    <div class="field"><label><span class="qb">Q4</span> EV 年均里程</label>
      <select id="s-q4">
        <option value="0">无电动车</option>
        <option value="5000">5,000 km</option>
        <option value="10000" selected>10,000 km</option>
        <option value="15000">15,000 km</option>
        <option value="20000">20,000 km</option>
        <option value="25000">25,000+ km</option>
      </select></div>
    <div class="field hidden" id="f-q5"><label><span class="qb">Q5</span> EV 充电时段</label>
      <select id="s-q5">
        <option value="mostly_overnight" selected>主要夜间充电</option>
        <option value="mixed_day_and_night">日夜混合</option>
        <option value="mostly_daytime">主要白天</option>
        <option value="solar_optimized">光伏优化</option>
      </select></div>
    <div id="rh-fields" class="${isN?'hidden':''}">
      <div class="slabel">R-H 输入（既有 PV + 屋顶）</div>
      <div class="field"><label><span class="qb qbR">R1</span> 既有 PV 容量</label>
        <select id="s-pv">
          <option value="-1">不知道 / 跳过（按 55% 估算）</option>
          <option value="4">Under 5 kWp（→ 4）</option>
          <option value="7" selected>5–10 kWp（→ 7）</option>
          <option value="12">10–15 kWp（→ 12）</option>
          <option value="17">15–20 kWp（→ 17）</option>
          <option value="22">20+ kWp（→ 22）</option>
        </select></div>
      <div class="field"><label><span class="qb qbR">R2</span> SAM3D 满铺 kWp</label>
        <input type="number" id="s-3d" value="14" step="0.5" min="0"></div>
      <div class="field"><label><span class="qb qbR">R3</span> 屋顶 2D 面积 m²</label>
        <input type="number" id="s-2d" value="60" step="1" min="0"></div>
    </div>
    <div class="slabel">方案档</div>
    <div class="field"><label>${isN?'<span class="qb qbN">N1</span>':'<span class="qb qbR">R4</span>'} 方案档</label>
      <select id="s-tier">
        <option value="A">A 经济（配储 0.7）</option>
        <option value="B" selected>B 标准（配储 0.9）</option>
        <option value="C">C 高端（配储 1.2）</option>
      </select></div>
    ${isN?'<div class="note"><b>N 场景</b>：屋顶无既有光伏；按方案目标推 PV + 逆变器 + 电池。容配比 130%/150%，PV ≤ 25 kWp。</div>':'<div class="note">所有参数变动即时重算。R-H 在 existing&lt;25 且剩余≥2 kWp 时启用，否则降级 R-B。</div>'}
    <div class="csv-src">📄 DE_*.md（14 张）<br>📄 R-H计算流程.md<br>📄 德国 N 场景计算流程.md<br>📄 容配比校验流程_DE.md</div>`;
  const sel=document.getElementById('s-state');
  DE_STATES.forEach(s=>{const op=document.createElement('option');op.value=s[0];op.textContent=`${s[0]} — ${s[2]}（${s[3]} kWh/年）`;sel.appendChild(op);});
  sel.value='NW';
  root.querySelectorAll('.scn-toggle button').forEach(b=>b.addEventListener('click',()=>{currentScn=b.dataset.scn;buildSidebar();upd2();}));
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
  const sys=document.getElementById('s-q2').value,km=document.getElementById('s-q4').value;
  const f3=document.getElementById('f-q3'),f5=document.getElementById('f-q5');
  if(f3) f3.classList.toggle('hidden',sys==='No heating or cooling system');
  if(f5) f5.classList.toggle('hidden',km==='0');
  const r=calcLoad(document.getElementById('s-state').value,sys,document.getElementById('s-q3').value,parseInt(km)||0,document.getElementById('s-q1').value,document.getElementById('s-q5').value);
  const tier=document.getElementById('s-tier').value;
  if(currentScn==='rh'){
    const rh=calcRH(parseFloat(document.getElementById('s-pv').value),parseFloat(document.getElementById('s-3d').value)||0,parseFloat(document.getElementById('s-2d').value)||0,tier,sys,parseInt(km)||0);
    const inv=pickInverter(rh.PV_total,tier);
    renderRH(r,rh,inv);
  }else{
    const n=calcN(r,tier);
    renderN(r,n);
  }
}

// ── 渲染：Load Profile 公共部分 ──
function renderLP(r){
  const stateName=DE_STATES.find(s=>s[0]===r.state);
  const szh=SYS_ZH[r.system]||r.system,uzh=USE_ZH[r.usage]||r.usage,ozh=OCC_ZH[r.occ]||r.occ;
  const mxd=Math.max(...r.fkd),mxm=Math.max(...r.fkm);
  let h=blk('一','年用电量（DE）',f0(r.final)+' kWh',
    '<div class="ssec"><div class="sstit">输入回显</div>'+
    '<div class="kvrow"><span class="k">联邦州</span><span class="v">'+stateName[0]+' · '+stateName[2]+'</span></div>'+
    '<div class="kvrow"><span class="k">基准 BASE</span><span class="v">'+f0(r.base)+' kWh/年</span></div>'+
    '<div class="kvrow"><span class="k">在家模式</span><span class="v">'+ozh+' ('+r.occ_v.toFixed(2)+'×)</span></div>'+
    '<div class="kvrow"><span class="k">冷暖设备</span><span class="v">'+szh+'</span></div>'+
    '<div class="kvrow"><span class="k">使用强度</span><span class="v">'+uzh+' (am='+r.u.am.toFixed(2)+')</span></div>'+
    '<div class="kvrow"><span class="k">EV 里程</span><span class="v">'+r.miles.toLocaleString()+' km</span></div></div>'+
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

// ── R-H 渲染 ──
function renderRH(r,rh,inv){
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">年用电量</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/年</div></div>'+
    '<div class="card"><div class="cl">日均用电</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/天</div></div>'+
    '<div class="card hi2"><div class="cl">模式</div><div class="cv ora">'+rh.mode+'</div><div class="cu">'+(rh.mode==='R-H'?'光储混合扩容':'纯储能升级')+'</div></div>'+
    '<div class="card hi2"><div class="cl">PV 总容量</div><div class="cv ora">'+f2(rh.PV_total,2)+'</div><div class="cu">kWp（增 '+f2(rh.added_kwp,2)+'）</div></div>'+
    '<div class="card hi"><div class="cl">逆变器</div><div class="cv">'+inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="card hi2"><div class="cl">推荐电池</div><div class="cv ora">'+f2(rh.bat_kWh,1)+'</div><div class="cu">kWh（'+rh.tier+'档 ×'+rh.ratio+'）</div></div></div>';
  h+=renderLP(r);
  const pvOpts=[[4,'Under 5 kWp','区间中位偏下；DE 早期老系统多在 3–5'],[7,'5–10 kWp','DE 老系统主流段中位'],[12,'10–15 kWp','中位'],[17,'15–20 kWp','中位'],[22,'20+ kWp','25 kWp 硬约束保守值']];
  const pvMapTbl='<div class="tw"><table><tr><th>前端选项</th><th>映射</th><th style="text-align:left">取值理由</th></tr>'+
    pvOpts.map(o=>'<tr class="'+(rh.userKnown&&rh.existing===o[0]?'hi':'')+'"><td>'+o[1]+'</td><td>'+o[0]+'</td><td style="text-align:left">'+o[2]+'</td></tr>').join('')+
    '<tr class="'+(!rh.userKnown?'hi':'')+'"><td>Not sure / 跳过</td><td>null</td><td style="text-align:left">SAM3D × 0.45 反推</td></tr></table></div>';
  h+=blk('五','【R-H · 步骤 0】既有 PV 容量映射','existing = '+f2(rh.existing,2)+' kWp',
    '<div class="ssec"><div class="sstit">选项 → 数值映射 '+srcTag('R-H计算流程.md')+'</div>'+pvMapTbl+'</div>'+
    '<div class="ssec"><div class="sstit">本次取值</div>'+
    '<div class="fml">existing_pv_kwp = <span class="r">'+f2(rh.existing,2)+' kWp</span> '+(rh.userKnown?'<span class="c"># 直接映射</span>':'<span class="c"># = SAM3D × 0.45</span>')+'</div></div>',false,'rh');
  const branchDesc={1:'分支 1：用 3D 差值',1.5:'分支 1（兜底）：3D−existing &lt; 0，使用 2D 面积兜底',2:'分支 2：用户未填 → remaining=3D×0.55, existing=3D×0.45',3:'分支 3：SAM3D 铺不上 → 使用 2D 面积兜底'}[rh.branch];
  h+=blk('六','【R-H · 步骤 2.1】屋顶面积 + 剩余可铺设','remaining = '+f2(rh.remaining,2)+' kWp',
    '<div class="ssec"><div class="sstit">参数 '+srcTag('DE_基础参数.md')+'</div>'+
    '<div class="kvrow"><span class="k">屋顶坡度</span><span class="v">'+ROOF_TILT_DEG+'°</span></div>'+
    '<div class="kvrow"><span class="k">单板面积/功率</span><span class="v">'+f2(PANEL_AREA,3)+' m² / '+PV_PANEL.p_kw+' kW</span></div>'+
    '<div class="kvrow"><span class="k">屋顶利用率</span><span class="v">'+ROOF_USE_RATIO+'</span></div>'+
    '<div class="kvrow"><span class="k">2D / SAM3D 输入</span><span class="v">'+f2(rh.mask2d,1)+' m² / '+f2(rh.sam3d,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">2D 兜底</div>'+
    '<div class="fml">roof = mask_2d / cos(40°) = '+f2(rh.roof_area_m2,2)+' m²\nusable = '+f2(rh.usable_area_m2,2)+' m²\nmax_panels = '+rh.max_panels_area+' 块  →  <span class="r">'+f2(rh.roof_full_kwp_area,2)+' kWp</span></div></div>'+
    '<div class="ssec"><div class="sstit">分支判定</div>'+
    '<div class="fml"><span class="o">'+branchDesc+'</span>\nremaining = <span class="r">'+f2(rh.remaining,3)+' kWp</span>\nremaining_capped = <span class="r">'+f2(rh.remaining_capped,3)+' kWp</span></div></div>',false,'rh');
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
  const sysCost=rh.PV_total*COST.pv_eur_per_kwp+inv.inv_kw*COST.inv_eur_per_kwp+rh.bat_kWh*COST.batt_eur_per_kwh;
  h+=blk('十一','【R-H 综合结果】方案概览',rh.mode+' · '+rh.tier+'档',
    '<div class="ogrid n5">'+
    '<div class="ocard rh"><div class="ocl">📐 既有 PV</div><div class="ocv ora">'+f2(rh.existing,2)+'</div><div class="ock">kWp</div></div>'+
    '<div class="ocard rh"><div class="ocl">➕ 新增 PV</div><div class="ocv ora">'+f2(rh.added_kwp,2)+'</div><div class="ock">kWp ('+rh.added_panels+'块)</div></div>'+
    '<div class="ocard rh"><div class="ocl">☀️ PV 总</div><div class="ocv ora">'+f2(rh.PV_total,2)+'</div><div class="ock">kWp</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ 逆变器</div><div class="ocv">'+inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(inv.scr_pct)+'</div></div>'+
    '<div class="ocard rh"><div class="ocl">🔋 电池</div><div class="ocv ora">'+f2(rh.bat_kWh,1)+'</div><div class="ock">kWh</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">附：年发电 + 粗算造价 '+srcTag('DE_兜底年发电系数.md')+'</div>'+
    '<div class="fml">兜底系数('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\n年发电 ≈ '+f2(rh.PV_total,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/年</span>\n自给率 ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\nPV   : '+f2(rh.PV_total,2)+' × 550 = '+f0(rh.PV_total*COST.pv_eur_per_kwp)+' €\n逆变器: '+inv.inv_kw+' × 330  = '+f0(inv.inv_kw*COST.inv_eur_per_kwp)+' €\n电池 : '+f2(rh.bat_kWh,1)+' × 400 = '+f0(rh.bat_kWh*COST.batt_eur_per_kwh)+' €\n合计 = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'rh');
  document.getElementById('out').innerHTML=h;
  bindSblock();
}

// ── N 全套新建渲染 ──
function renderN(r,n){
  const tierTbl='<div class="tw"><table><tr><th>档</th><th>默认 target</th><th>触发上调</th><th>配储率</th></tr>'+
    '<tr class="'+(n.tier==='A'?'hi':'')+'"><td>A 经济</td><td>7.05</td><td>7.05</td><td>0.7</td></tr>'+
    '<tr class="'+(n.tier==='B'?'hi':'')+'"><td>B 标准</td><td>10.34</td><td>13.16</td><td>0.9</td></tr>'+
    '<tr class="'+(n.tier==='C'?'hi':'')+'"><td>C 高端</td><td>13.16</td><td>15.04</td><td>1.2</td></tr></table></div>';
  let h='<div class="cards">'+
    '<div class="card hi"><div class="cl">年用电量</div><div class="cv">'+f0(r.final)+'</div><div class="cu">kWh/年</div></div>'+
    '<div class="card"><div class="cl">日均用电</div><div class="cv">'+f2(r.davg,1)+'</div><div class="cu">kWh/天</div></div>'+
    '<div class="card hi3"><div class="cl">模式</div><div class="cv pur">N · 全套新建</div><div class="cu">'+n.tier+'档</div></div>'+
    '<div class="card hi3"><div class="cl">PV 容量</div><div class="cv pur">'+f2(n.actual_pv,2)+'</div><div class="cu">kWp ('+n.actual_panels+' 块)</div></div>'+
    '<div class="card hi"><div class="cl">逆变器</div><div class="cv">'+n.inv.inv_kw+'</div><div class="cu">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="card hi3"><div class="cl">推荐电池</div><div class="cv pur">'+f2(n.bat_kWh,1)+'</div><div class="cu">kWh · ratio '+n.ratio+'</div></div></div>';
  h+=renderLP(r);
  h+=blk('五','【N · 步骤 1】方案档目标','target = '+f2(n.target_pv_total,2)+' kWp',
    '<div class="ssec"><div class="sstit">方案档参数表 '+srcTag('德国 N 场景计算流程.md')+' '+srcTag('DE_基础参数.md')+'</div>'+tierTbl+'</div>'+
    '<div class="ssec"><div class="sstit">触发条件检查</div>'+
    '<div class="fml">trigger = (EV&gt;0) ∨ heat_pump ∨ electric_heat\n       = ('+r.miles+'&gt;0) ∨ '+(r.system==='Heat pump (heating & cooling)')+' ∨ '+(r.system==='Electric heating')+'\n       = <span class="r">'+n.trigger+'</span>\n\ntarget_pv_total = <span class="r">'+f2(n.target_pv_total,2)+' kWp</span>\ntarget_pv_capped = min(target, 25) = <span class="r">'+f2(n.target_pv_capped,2)+' kWp</span>  <span class="c"># PV 硬上限</span></div></div>',false,'n');
  h+=blk('六','【N · 步骤 2】PV 实装（向上取整为整块面板）','pv_pre = '+f2(n.pv_pre,2)+' kWp',
    '<div class="ssec"><div class="sstit">面板取整</div>'+
    '<div class="fml">panels = ceil(target / panel_kw) = ceil('+f2(n.target_pv_capped,2)+' / '+PV_PANEL.p_kw+') = <span class="r">'+n.panels+' 块</span>\npv_pre = '+n.panels+' × '+PV_PANEL.p_kw+' = <span class="r">'+f2(n.pv_pre,2)+' kWp</span>\nassert pv_pre ≤ 25 ✅</div></div>'+
    '<div class="note">N 场景假设屋顶物理可容纳目标 PV；实际部署时若屋顶受限，需手工调整。</div>',false,'n');
  h+=renderInverterBlock('七',n.pv_pre,n.inv,n.tier);
  const specsBadge=BATT_SPECS.map(s=>s===n.bat_kWh?'<b style="color:var(--pur)">['+s+']</b>':s).join(' · ');
  h+=blk('八','【N · 步骤 4】电池容量推荐（配储率法）',f2(n.bat_kWh,1)+' kWh',
    '<div class="ssec"><div class="sstit">配储率 '+srcTag('DE_基础参数.md')+' '+srcTag('容配比校验流程_DE.md')+'</div>'+
    '<div class="fml">storage_ratio = {A:0.7, B:0.9, C:1.2}['+n.tier+'] = <span class="r">'+n.ratio+'</span>\nBat_target = PV_actual × ratio = '+f2(n.actual_pv,2)+' × '+n.ratio+' = <span class="r">'+f2(n.bat_target,2)+' kWh</span></div></div>'+
    '<div class="ssec"><div class="sstit">向上取整（最低 5，最高 50）</div>'+
    '<div class="fml">规格集: '+specsBadge+'\nBat_kWh = <span class="r">'+f2(n.bat_kWh,1)+' kWh</span></div></div>'+
    '<div class="note">DoD = 0.9 · RTE = 0.95 用于后续能量流仿真，不进入电池规格选型。</div>',false,'n');
  const annualGen=n.actual_pv*YIELD[r.state];
  const sysCost=n.actual_pv*COST.pv_eur_per_kwp+n.inv.inv_kw*COST.inv_eur_per_kwp+n.bat_kWh*COST.batt_eur_per_kwh;
  h+=blk('九','【N 综合结果】方案概览','N · '+n.tier+'档',
    '<div class="ogrid n4">'+
    '<div class="ocard n"><div class="ocl">☀️ PV 容量</div><div class="ocv pur">'+f2(n.actual_pv,2)+'</div><div class="ock">kWp ('+n.actual_panels+' 块)</div></div>'+
    '<div class="ocard"><div class="ocl">⚡ 逆变器</div><div class="ocv">'+n.inv.inv_kw+'</div><div class="ock">kW · SCR '+fp(n.inv.scr_pct)+'</div></div>'+
    '<div class="ocard n"><div class="ocl">🔋 电池</div><div class="ocv pur">'+f2(n.bat_kWh,1)+'</div><div class="ock">kWh · ratio '+n.ratio+'</div></div>'+
    '<div class="ocard"><div class="ocl">💰 系统造价</div><div class="ocv">'+f0(sysCost)+'</div><div class="ock">€（税前粗算）</div></div></div>'+
    '<div class="ssec" style="margin-top:14px"><div class="sstit">附：年发电 + 粗算造价 '+srcTag('DE_兜底年发电系数.md')+'</div>'+
    '<div class="fml">兜底系数('+r.state+') = '+YIELD[r.state]+' kWh/kWp/yr\n年发电 ≈ '+f2(n.actual_pv,2)+' × '+YIELD[r.state]+' = <span class="r">'+f0(annualGen)+' kWh/年</span>\n自给率 ≈ <span class="r">'+fp(annualGen/r.final*100)+'</span>\n─────\nPV   : '+f2(n.actual_pv,2)+' × 550 = '+f0(n.actual_pv*COST.pv_eur_per_kwp)+' €\n逆变器: '+n.inv.inv_kw+' × 330  = '+f0(n.inv.inv_kw*COST.inv_eur_per_kwp)+' €\n电池 : '+f2(n.bat_kWh,1)+' × 400 = '+f0(n.bat_kWh*COST.batt_eur_per_kwh)+' €\n合计 = <span class="r">'+f0(sysCost)+' €</span></div></div>',true,'n');
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
    '<h1>德国负荷 + 方案计算器 v2 · 说明</h1>'+
    '<p>v2 在 v1（仅 R-H 改造）的基础上做了三项改进：</p>'+
    '<h2>① 顶部 Tab 切换</h2>'+
    '<ul><li><b>📊 场景计算</b>：负荷+R-H/N 场景实时计算（左侧切换 R-H 与 N）</li><li><b>📚 参数库</b>：DE 参数集中展示，预留多国家切换</li><li><b>ℹ 说明</b>：本页</li></ul>'+
    '<h2>② 新增 N 全套新建场景</h2>'+
    '<ul><li>不再需要既有 PV / 屋顶面积输入</li><li>按方案档目标 (A=7.05 / B=10.34→13.16 / C=13.16→15.04 kWp) 推 PV</li><li>容配比校验：target 130% / max 150%，三相 ≤ 24 kW，超限触发面板削减</li><li>电池：PV × 配储率 (0.7 / 0.9 / 1.2)，向上取标准规格 [5..50] kWh</li><li>用电时段（白天 / 晚高峰 / 夜间）保留计算，但仅作对比与人工调整参考</li></ul>'+
    '<h2>③ R-H 升级</h2>'+
    '<ul><li>新增独立的容配比校验步骤（v1 缺失）</li><li>采用与 N 共用的 <code>pickInverter()</code> 实现，逻辑统一</li></ul>'+
    '<h2>参考文档</h2>'+
    '<ul><li>参考/德国版 Emily 计算/计算流程/R-H计算流程.md</li><li>参考/德国版 Emily 计算/计算流程/德国 N 场景计算流程.md</li><li>参考/德国版 Emily 计算/计算流程/容配比校验流程_DE.md</li><li>参考/德国版 Emily 计算/德国参数/DE_*.md（14 张）</li></ul>'+
    '</div>';
}

// ── 启动 ──
bindTabs();
buildSidebar();
upd2();
