// ═══════════════════════════════════════════════════════════════════════
//  德国负荷 + R-H 计算器 · 渲染逻辑
// ═══════════════════════════════════════════════════════════════════════

function render(r,rh){
  const mxd=Math.max(...r.fkd),mxm=Math.max(...r.fkm);
  const stateName=DE_STATES.find(s=>s[0]===r.state);
  const szh=SYS_ZH[r.system]||r.system,uzh=USE_ZH[r.usage]||r.usage,ozh=OCC_ZH[r.occ]||r.occ;
  const dtList=[...DTH].sort((a,b)=>a-b).map(h=>'H'+String(h).padStart(2,'0')).join(',');
  const cpList=[...CPH].sort((a,b)=>a-b).map(h=>'H'+String(h).padStart(2,'0')).join(',');
  const hpList=[...HPH].sort((a,b)=>a-b).map(h=>'H'+String(h).padStart(2,'0')).join(',');

  // ━━━ 摘要卡片 ━━━
  let h=`<div class="cards">
    <div class="card hi"><div class="cl">年用电量</div><div class="cv">${f0(r.final)}</div><div class="cu">kWh/年</div></div>
    <div class="card"><div class="cl">日均用电</div><div class="cv">${f2(r.davg,1)}</div><div class="cu">kWh/天</div></div>
    <div class="card"><div class="cl">白天 H09–H17</div><div class="cv">${fp(r.dtp)}</div><div class="cu">${f2(r.dtk)} kWh/天</div></div>
    <div class="card hi2"><div class="cl">模式</div><div class="cv ora">${rh.mode}</div><div class="cu">${rh.mode==='R-H'?'光储混合扩容':'纯储能升级'}</div></div>
    <div class="card hi2"><div class="cl">PV 总容量</div><div class="cv ora">${f2(rh.PV_total,2)}</div><div class="cu">kWp（增 ${f2(rh.added_kwp,2)}）</div></div>
    <div class="card hi2"><div class="cl">推荐电池</div><div class="cv ora">${f2(rh.bat_kWh,1)}</div><div class="cu">kWh（${rh.tier}档 ×${rh.ratio}）</div></div>
  </div>`;

  // ━━━ 第一步 年用电量 ━━━
  h+=blk('一','年用电量（DE）',`${f0(r.final)} kWh`,`
  <div class="ssec"><div class="sstit">输入回显</div>
   <div class="kvrow"><span class="k">联邦州</span><span class="v">${stateName[0]} · ${stateName[2]}</span></div>
   <div class="kvrow"><span class="k">基准用电量 BASE</span><span class="v">${f0(r.base)} kWh/年</span></div>
   <div class="kvrow"><span class="k">在家模式 occ</span><span class="v">${ozh} (${r.occ_v.toFixed(2)}×)</span></div>
   <div class="kvrow"><span class="k">冷暖设备 system</span><span class="v">${szh}</span></div>
   <div class="kvrow"><span class="k">使用强度 usage</span><span class="v">${uzh} (annual_mult=${r.u.am.toFixed(2)})</span></div>
   <div class="kvrow"><span class="k">EV 里程 / 充电</span><span class="v">${r.miles.toLocaleString()} km / ${r.evc}</span></div>
  </div>
  <div class="ssec"><div class="sstit">1-A 暖通额外用电 ${srcTag('DE_暖通空调热负荷.md')} ${srcTag('DE_用电强度系数.md')}</div>
  <div class="fml">暖通额外 = base_thermal_load[${esc(szh)}] × annual_mult[${uzh}]
         = ${f0(r.t_base)} kWh × ${r.u.am.toFixed(3)}
<span class="r">         = ${f2(r.t_ext)} kWh</span></div></div>
  <div class="ssec"><div class="sstit">1-B 电动车额外用电 ${srcTag('GLOBAL_ev_params.md')}</div>
  <div class="fml">EV额外 = ${r.miles.toLocaleString()} km × ${EV_KWH_PER_KM} kWh/km = <span class="r">${f2(r.ev_ext)} kWh</span></div></div>
  <div class="ssec"><div class="sstit">1-C 年用电量合计 ${srcTag('DE_预设各州年用电量.md')}</div>
  <div class="fml">年用电量 = BASE(${r.state}) + 暖通额外 + EV额外
         = ${f0(r.base)} + ${f2(r.t_ext)} + ${f2(r.ev_ext)}
<span class="r">         = ${f2(r.final)} kWh</span></div></div>`);

  // ━━━ 第二步 月度分布 ━━━
  const mbars=r.fkm.map((v,i)=>{
    const ht=Math.round(v/mxm*52);
    const cls=(r.sf.c[i]&&r.pc&&r.sf.h[i]&&r.ph)?'both':(r.sf.c[i]&&r.pc)?'cool':(r.sf.h[i]&&r.ph)?'heat':'';
    return `<div class="mbar ${cls}" style="height:${ht}px" title="${MNZ[i]}: ${f2(v)} kWh"></div>`;
  }).join('');
  const mrows=MNZ.map((m,i)=>{
    const cls=(r.sf.c[i]&&r.pc&&r.sf.h[i]&&r.ph)?'both':(r.sf.c[i]&&r.pc)?'cool':(r.sf.h[i]&&r.ph)?'heat':'';
    const tag=(r.sf.c[i]&&r.pc?'❄':'')+(r.sf.h[i]&&r.ph?'🔥':'');
    return `<tr class="${cls}"><td>${m}</td><td>${r.bms[i].toFixed(4)}</td><td>${r.sm[i].toFixed(3)}</td><td>${f2(r.rb[i])}</td><td>${f2(r.nb[i])}</td><td>${f2(r.ta[i])}</td><td>${f2(r.ea[i])}</td><td><b>${f2(r.fkm[i])}</b></td><td>${fp(r.fsm[i]*100)}</td><td class="tag">${tag}</td></tr>`;
  }).join('');
  h+=blk('二','月度分布','',`
  <div class="ssec"><div class="sstit">月份标记 ${srcTag('DE_月份标记.md')}</div>
  <div style="font-size:11px;color:var(--dim);font-family:var(--mono)">制冷月：6,7,8月 &nbsp;|&nbsp; 制热月：1,2,3,4,10,11,12月</div></div>
  <div class="ssec"><div class="sstit">计算公式 ${srcTag('DE_月度比例.md')} ${srcTag('DE_用电强度系数.md')}</div>
  <div class="fml">季节系数[m]  = 1 + IF(制冷设备∧制冷季, cmm−1, 0) + IF(制热设备∧制热季, hmm−1, 0)
重塑基准[m]  = BASE × 月份基准占比[m] × 季节系数[m]
归一基准[m]  = 重塑[m] / SUM(重塑) × BASE
暖通分配[m]  = 暖通权重[m] / SUM(权重) × 暖通额外
月用电量[m]  = 归一基准 + 暖通分配 + EV额外/12</div>
  <div style="display:flex;gap:14px;align-items:flex-end">
    <div style="flex:1"><div class="mchart">${mbars}</div><div class="mlbls">${MNZ.map(m=>`<span>${m.replace('月','')}</span>`).join('')}</div></div>
    <div class="legend"><span style="color:#0088aa">■</span> 制冷季<br><span style="color:#8b2e1a">■</span> 制热季<br><span style="color:#8050b8">■</span> 冷暖季</div>
  </div></div>
  <div class="ssec"><div class="sstit">逐月完整明细</div>
  <div class="tw"><table>
   <tr><th>月份</th><th>基础占比</th><th>季节系数</th><th>重塑基准</th><th>归一基准</th><th>暖通分配</th><th>EV分配</th><th>月用电</th><th>占比</th><th></th></tr>
   ${mrows}
  </table></div></div>`);

  // ━━━ 第三步 24小时分布 ━━━
  const brows=Array.from({length:24},(_,hh)=>{
    const isD=DTH.has(hh),isCp=CPH.has(hh)&&r.pc,isHp=HPH.has(hh)&&r.ph,isEV=r.ev_dist[hh]>0;
    const cls=isD?'d':(isCp||isHp)?'p':isEV?'e':'';
    return `<div class="brow"><div class="blbl">H${String(hh).padStart(2,'0')}</div><div class="btrk"><div class="bfil ${cls}" style="width:${r.fkd[hh]/mxd*100}%"></div></div><div class="bval">${r.fkd[hh].toFixed(3)}</div></div>`;
  }).join('');
  const flagRows=HOUR_FLAGS.map(([hh,dt,cp,hp,mr,er])=>{
    const flags=[];
    if(dt)flags.push('☀白天');if(cp)flags.push('❄制冷峰');if(hp)flags.push('🔥制热峰');
    if(mr)flags.push('🌅早高峰');if(er)flags.push('🌆晚高峰');
    return `<tr><td>H${String(hh).padStart(2,'0')}</td><td>${dt}</td><td>${cp}</td><td>${hp}</td><td>${mr}</td><td>${er}</td><td class="tag" style="text-align:left">${flags.join(' ')}</td></tr>`;
  }).join('');
  const hrows=Array.from({length:24},(_,hh)=>{
    const tags=[];
    if(DTH.has(hh))tags.push('☀');if(CPH.has(hh)&&r.pc)tags.push('❄');if(HPH.has(hh)&&r.ph)tags.push('🔥');
    if(r.ev_dist[hh]>0)tags.push(`EV${r.ev_dist[hh].toFixed(3)}`);
    return `<tr><td>H${String(hh).padStart(2,'0')}</td><td>${r.hb[hh].toFixed(4)}</td><td>${r.om[hh].toFixed(3)}</td><td>${r.pm[hh].toFixed(4)}</td><td>${r.adj[hh].toFixed(5)}</td><td>${r.ns[hh].toFixed(5)}</td><td>${r.nek[hh].toFixed(4)}</td><td>${r.evk[hh].toFixed(4)}</td><td>${r.fkd[hh].toFixed(4)}</td><td><b>${r.fhs[hh].toFixed(5)}</b></td><td class="tag">${tags.join(' ')}</td></tr>`;
  }).join('');
  const sfhs=r.fhs.reduce((a,b)=>a+b,0);
  h+=blk('三','24小时分布',`日均 ${f2(r.davg,2)} kWh`,`
  <div class="ssec"><div class="sstit">小时标志位参数表 ${srcTag('DE_小时标记.md')}</div>
  <div class="tw"><table>
    <tr><th>小时</th><th>白天</th><th>制冷峰</th><th>制热峰</th><th>早高峰</th><th>晚高峰</th><th style="text-align:left">说明</th></tr>
    ${flagRows}
  </table></div>
  <div style="margin-top:6px;font-size:10px;color:var(--dim)">白天：${dtList} | 制冷峰：${cpList} | 制热峰：${hpList}</div></div>
  <div class="ssec"><div class="sstit">计算公式 ${srcTag('DE_小时比例.md')} ${srcTag('GLOBAL_occupancy_factors.md')}</div>
  <div class="fml">调整份额[h]  = 基础小时占比[h] × 在家系数[h] × 峰值系数[h]
归一份额[h]  = 调整[h] / SUM(调整)
非EV用电[h]  = (BASE+暖通)/365 × 归一份额[h]   <span class="c">日均非EV = ${f2(r.dne,4)}</span>
EV用电[h]    = (EV额外/365) × EV充电分布[h]    <span class="c">日均EV   = ${f2(r.dev,4)}</span>
最终份额[h]  = (非EV[h]+EV[h]) / 日均用电</div>
  <div style="display:flex;gap:12px">
    <div class="legend" style="white-space:nowrap"><span style="color:var(--yel)">■</span> 白天<br><span style="color:var(--ora)">■</span> 暖通峰<br><span style="color:var(--grn)">■</span> EV充电</div>
    <div style="flex:1">${brows}</div>
  </div>
  <div class="ver">✅ Σ 最终小时份额 = ${sfhs.toFixed(6)}</div></div>
  <div class="ssec"><div class="sstit">完整24小时明细</div>
  <div class="tw"><table>
   <tr><th>小时</th><th>基础占比</th><th>在家系数</th><th>峰值系数</th><th>调整占比</th><th>归一占比</th><th>非EV kWh</th><th>EV kWh</th><th>kWh/天</th><th>最终占比</th><th></th></tr>
   ${hrows}
  </table></div></div>`);

  // ━━━ 第四步 最终输出 ━━━
  const dtS=[...DTH].reduce((a,hh)=>a+r.fhs[hh],0);
  const epS=[18,19,20].reduce((a,hh)=>a+r.fhs[hh],0);
  const onS=[18,19,20,21,22,23,0,1,2,3,4,5].reduce((a,hh)=>a+r.fhs[hh],0);
  h+=blk('四','负荷曲线最终输出','',`
  <div class="ssec"><div class="sstit">推导计算</div>
  <div class="fml">日均用电  = ${f2(r.final)} / 365 <span class="r">= ${f2(r.davg,4)} kWh/天</span>
白天用电  = davg × Σ最终占比[H09–H17] = ${f2(r.davg,4)} × ${dtS.toFixed(5)} <span class="r">= ${f2(r.dtk,4)} kWh (${fp(r.dtp)})</span>
晚高峰    = davg × Σ最终占比[H18–H20] = ${f2(r.davg,4)} × ${epS.toFixed(5)} <span class="r">= ${f2(r.epk,4)} kWh (${fp(r.epp)})</span>
整夜用电  = davg × Σ最终占比[H18–H05] = ${f2(r.davg,4)} × ${onS.toFixed(5)} <span class="r">= ${f2(r.onk,4)} kWh (${fp(r.onp)})</span></div></div>
  <div class="ogrid">
    <div class="ocard"><div class="ocl">☀ 白天用电 H09–H17</div><div class="ocv">${fp(r.dtp)}</div><div class="ock">${f2(r.dtk,4)} kWh/天</div></div>
    <div class="ocard"><div class="ocl">🌆 晚高峰 H18–H20</div><div class="ocv">${fp(r.epp)}</div><div class="ock">${f2(r.epk,4)} kWh/天</div></div>
    <div class="ocard"><div class="ocl">🌙 整夜 H18–H05</div><div class="ocv">${fp(r.onp)}</div><div class="ock">${f2(r.onk,4)} kWh/天</div></div>
  </div>`);

  // ━━━ 第五步 R-H 步骤 0：既有 PV 映射 ━━━
  const pvOpts=[[4,'Under 5 kWp','区间中位偏下；DE 早期老系统多在 3–5'],[7,'5–10 kWp','DE 老系统主流段中位'],[12,'10–15 kWp','中位'],[17,'15–20 kWp','中位'],[22,'20+ kWp','25 kWp 硬约束保守值']];
  const pvMapTbl=`<div class="tw"><table>
   <tr><th>前端选项</th><th>映射 existing_pv_kwp</th><th style="text-align:left">取值理由</th></tr>
   ${pvOpts.map(o=>`<tr class="${rh.userKnown&&rh.existing===o[0]?'hi':''}"><td>${o[1]}</td><td>${o[0]}</td><td style="text-align:left">${o[2]}</td></tr>`).join('')}
   <tr class="${!rh.userKnown?'hi':''}"><td>Not sure / 跳过</td><td>null（走估算）</td><td style="text-align:left">使用 SAM3D × 0.45 反推</td></tr>
  </table></div>`;
  h+=blk('五','【R-H · 步骤 0】既有 PV 容量映射',`existing = ${f2(rh.existing,2)} kWp`,`
  <div class="ssec"><div class="sstit">选项 → 数值映射 ${srcTag('R-H计算流程.md')}</div>${pvMapTbl}</div>
  <div class="ssec"><div class="sstit">本次取值</div>
  <div class="fml">用户输入  : ${rh.userKnown?'已选档位':'未填 / 跳过'}
existing_pv_kwp = <span class="r">${f2(rh.existing,2)} kWp</span> ${rh.userKnown?'<span class="c"># 直接映射</span>':'<span class="c"># = SAM3D × 0.45 = '+f2(rh.sam3d,2)+' × 0.45</span>'}</div></div>`,false,true);

  // ━━━ 第六步 屋顶面积 + 剩余 ━━━
  const branchDesc={
    1:'分支 1：用户填了 existing 且 SAM3D − existing ≥ 1 板 → 用 3D 差值',
    1.5:'分支 1（兜底）：3D − existing &lt; 0，使用 2D 面积兜底',
    2:'分支 2：用户未填 → remaining = 3D × 0.55, existing ≈ 3D × 0.45',
    3:'分支 3：用户填了 existing 但 SAM3D 铺不上 → 使用 2D 面积兜底'
  }[rh.branch];
  h+=blk('六','【R-H · 步骤 2.1】屋顶面积 + 剩余可铺设容量',`remaining = ${f2(rh.remaining,2)} kWp`,`
  <div class="ssec"><div class="sstit">参数与输入 ${srcTag('DE_基础参数.md')}</div>
   <div class="kvrow"><span class="k">屋顶坡度（DE 预设）</span><span class="v">${ROOF_TILT_DEG}° （cos = ${rh.cos40.toFixed(4)}）</span></div>
   <div class="kvrow"><span class="k">组件尺寸 L×W</span><span class="v">${PV_PANEL.L_mm}×${PV_PANEL.W_mm} mm</span></div>
   <div class="kvrow"><span class="k">单板面积 / 功率</span><span class="v">${f2(PANEL_AREA,3)} m² / ${PV_PANEL.p_kw} kW</span></div>
   <div class="kvrow"><span class="k">屋顶利用率</span><span class="v">${ROOF_USE_RATIO}</span></div>
   <div class="kvrow"><span class="k">2D 面积输入</span><span class="v">${f2(rh.mask2d,1)} m²</span></div>
   <div class="kvrow"><span class="k">SAM3D 满铺输入</span><span class="v">${f2(rh.sam3d,2)} kWp</span></div>
  </div>
  <div class="ssec"><div class="sstit">2D 面积法兜底</div>
  <div class="fml">roof_area_m2       = mask_2d / cos(40°) ≈ mask_2d × 1.305
                  = ${f2(rh.mask2d,1)} / ${rh.cos40.toFixed(4)} = <span class="r">${f2(rh.roof_area_m2,2)} m²</span>
usable_area_m2     = roof_area_m2 × 0.45 = <span class="r">${f2(rh.usable_area_m2,2)} m²</span>
max_panels_area    = floor(${f2(rh.usable_area_m2,2)} / ${f2(PANEL_AREA,3)}) = <span class="r">${rh.max_panels_area} 块</span>
roof_full_kwp_area = ${rh.max_panels_area} × ${PV_PANEL.p_kw} = <span class="r">${f2(rh.roof_full_kwp_area,2)} kWp</span></div></div>
  <div class="ssec"><div class="sstit">剩余可铺设容量分支判定</div>
  <div class="fml"><span class="o">${branchDesc}</span>

remaining        = <span class="r">${f2(rh.remaining,3)} kWp</span>
remaining_capped = min(remaining, 25 − existing) = min(${f2(rh.remaining,2)}, ${f2(PV_HARDCAP-rh.existing,2)})
                = <span class="r">${f2(rh.remaining_capped,3)} kWp</span></div></div>`,false,true);

  // ━━━ 第七步 模式判定 ━━━
  let modeFml;
  if(rh.existing>=PV_HARDCAP) modeFml=`existing(${f2(rh.existing,2)}) ≥ 25  → R-B（已达硬上限，仅加电池）`;
  else if(rh.remaining_capped<REMAIN_MIN_RH) modeFml=`remaining_capped(${f2(rh.remaining_capped,2)}) &lt; 2.0 → R-B（剩余太小）`;
  else modeFml=`existing &lt; 25 且 remaining_capped ≥ 2.0 → R-H（光储混合扩容）`;
  h+=blk('七','【R-H · 步骤 2.2】模式判定',`<span class="modeBadge ${rh.mode==='R-H'?'modeRH':'modeRB'}">${rh.mode}</span>`,`
  <div class="ssec"><div class="sstit">业务规则 ${srcTag('R-H计算流程.md')}</div>
  <div class="fml">if existing &gt;= 25:                mode = "R-B"   <span class="c"># 已达硬上限</span>
elif remaining_capped &lt; 2.0:    mode = "R-B"   <span class="c"># 剩余太小</span>
else:                           mode = "R-H"   <span class="c"># 加板 + 加电池</span></div></div>
  <div class="ssec"><div class="sstit">本次判定</div>
  <div class="fml"><span class="r">${modeFml}</span></div></div>`,false,true);

  // ━━━ 第八步 R-H 增量光伏 ━━━
  const tierTbl=`<div class="tw"><table>
   <tr><th>档</th><th>默认 target</th><th>EV/热泵/电暖触发</th><th>配储率</th></tr>
   <tr class="${rh.tier==='A'?'hi':''}"><td>A 经济</td><td>7.05 kWp</td><td>7.05 kWp（不变）</td><td>0.7</td></tr>
   <tr class="${rh.tier==='B'?'hi':''}"><td>B 标准</td><td>10.34 kWp</td><td>13.16 kWp</td><td>0.9</td></tr>
   <tr class="${rh.tier==='C'?'hi':''}"><td>C 高端</td><td>13.16 kWp</td><td>15.04 kWp</td><td>1.2</td></tr>
  </table></div>`;
  let rhCalcFml;
  if(rh.mode==='R-H'){
    rhCalcFml=`target_added   = max(0, target_pv_total − existing)
              = max(0, ${f2(rh.target_pv_total,2)} − ${f2(rh.existing,2)}) = <span class="r">${f2(rh.target_added,2)} kWp</span>
added_kwp_pre  = min(target_added, remaining_capped)
              = min(${f2(rh.target_added,2)}, ${f2(rh.remaining_capped,2)}) = <span class="r">${f2(rh.added_kwp_pre,2)} kWp</span>
added_panels   = floor(${f2(rh.added_kwp_pre,2)} / ${PV_PANEL.p_kw}) = <span class="r">${rh.added_panels} 块</span>
added_kwp      = ${rh.added_panels} × ${PV_PANEL.p_kw} = <span class="r">${f2(rh.added_kwp,2)} kWp</span>
PV_total       = existing + added_kwp = ${f2(rh.existing,2)} + ${f2(rh.added_kwp,2)} = <span class="r">${f2(rh.PV_total,2)} kWp</span>
assert PV_total ≤ 25 ✅`;
  }else{
    rhCalcFml=`<span class="c"># 当前为 R-B 模式（不加板，仅加电池）</span>
Added_kWp = 0
PV_total  = existing = <span class="r">${f2(rh.PV_total,2)} kWp</span>`;
  }
  h+=blk('八','【R-H · 步骤 2.3】方案档目标 + 增量光伏',`PV_total = ${f2(rh.PV_total,2)} kWp`,`
  <div class="ssec"><div class="sstit">方案档参数表 ${srcTag('DE_基础参数.md')}</div>${tierTbl}</div>
  <div class="ssec"><div class="sstit">触发条件检查</div>
  <div class="fml">trigger = (EV里程&gt;0) ∨ (热泵) ∨ (电暖)
       = (${r.miles}&gt;0)=${r.miles>0} ∨ heat_pump=${r.system==='Heat pump (heating & cooling)'} ∨ electric_heat=${r.system==='Electric heating'}
       = <span class="r">${rh.trigger}</span>
target_pv_total = ${rh.tier}档 × (${rh.trigger?'触发→ boost':'未触发→ base'}) = <span class="r">${f2(rh.target_pv_total,2)} kWp</span></div></div>
  <div class="ssec"><div class="sstit">增量计算</div>
  <div class="fml">${rhCalcFml}</div></div>`,false,true);

  // ━━━ 第九步 电池推荐 ━━━
  const specsBadge=BATT_SPECS.map(s=>s===rh.bat_kWh?`<b style="color:var(--ora)">[${s}]</b>`:s).join(' · ');
  h+=blk('九','【R-H · 步骤 2.4】电池容量推荐',`${f2(rh.bat_kWh,1)} kWh`,`
  <div class="ssec"><div class="sstit">配储率（按方案档）${srcTag('DE_基础参数.md')}</div>
  <div class="fml">storage_ratio  = {A:0.7, B:0.9, C:1.2}[${rh.tier}] = <span class="r">${rh.ratio}</span>
Bat_target_kWh = PV_total × storage_ratio = ${f2(rh.PV_total,2)} × ${rh.ratio} = <span class="r">${f2(rh.bat_target,2)} kWh</span></div></div>
  <div class="ssec"><div class="sstit">向上取整到标准规格（最低 5 kWh）</div>
  <div class="fml">标准规格集 (kWh): ${specsBadge}
Bat_kWh = ceil_to_spec( max(5, ${f2(rh.bat_target,2)}) ) = <span class="r">${f2(rh.bat_kWh,1)} kWh</span>
DoD = 0.9 → 可用容量 ≈ ${f2(rh.bat_kWh*0.9,2)} kWh
RTE = 0.95 → 单程效率 ≈ ${f2(Math.sqrt(0.95),3)}</div></div>`,false,true);

  // ━━━ 第十步 综合结果 ━━━
  const annualGenEst=rh.PV_total*YIELD[r.state];
  const sysCost=rh.PV_total*COST.pv_eur_per_kwp + rh.PV_total*COST.inv_eur_per_kwp + rh.bat_kWh*COST.batt_eur_per_kwh;
  h+=blk('十','【R-H 综合结果】方案概览',`${rh.mode} · ${rh.tier}档`,`
  <div class="ogrid rh">
    <div class="ocard rh"><div class="ocl">📐 既有 PV existing</div><div class="ocv ora">${f2(rh.existing,2)}</div><div class="ock">kWp</div></div>
    <div class="ocard rh"><div class="ocl">➕ 新增 PV added_kwp</div><div class="ocv ora">${f2(rh.added_kwp,2)}</div><div class="ock">kWp（${rh.added_panels} 块板）</div></div>
    <div class="ocard rh"><div class="ocl">☀️ PV 总容量</div><div class="ocv ora">${f2(rh.PV_total,2)}</div><div class="ock">kWp（≤ 25 ✅）</div></div>
    <div class="ocard rh"><div class="ocl">🔋 推荐电池</div><div class="ocv ora">${f2(rh.bat_kWh,1)}</div><div class="ock">kWh（目标 ${f2(rh.bat_target,2)}）</div></div>
  </div>
  <div class="ssec" style="margin-top:14px"><div class="sstit">附：年发电量兜底估算 ${srcTag('DE_兜底年发电系数.md')}</div>
  <div class="fml">兜底系数(${r.state}) = ${YIELD[r.state]} kWh/kWp/yr
年发电量 ≈ PV_total × yield = ${f2(rh.PV_total,2)} × ${YIELD[r.state]} = <span class="r">${f0(annualGenEst)} kWh/年</span>
对比年用电量 ${f0(r.final)} kWh → 自给率（理论上限）≈ <span class="r">${fp(annualGenEst/r.final*100)}</span></div></div>
  <div class="ssec"><div class="sstit">附：粗算系统造价（待后续模块细化）${srcTag('DE_基础参数.md')}</div>
  <div class="fml">PV 板  : ${f2(rh.PV_total,2)} × 550 €/kWp  = <span class="r">${f0(rh.PV_total*COST.pv_eur_per_kwp)} €</span>
逆变器 : ${f2(rh.PV_total,2)} × 330 €/kWp  = <span class="r">${f0(rh.PV_total*COST.inv_eur_per_kwp)} €</span>
电池   : ${f2(rh.bat_kWh,1)} × 400 €/kWh  = <span class="r">${f0(rh.bat_kWh*COST.batt_eur_per_kwh)} €</span>
─────────────────────────────────────
合计   = <span class="r">${f0(sysCost)} € (税前，GST 0%)</span></div></div>
  <div class="note" style="margin-top:10px">
   <b>后续模块（待开发）</b>：① 逆变器选型（目标 130%, 最大 150%, 三相 ≤ 24kW；规格 ${rh.tier==='C'?'5,6,8,10,12,15,18,20,22':'5,6,8,10,12,15'} kW）
   ② 容配比校验  ③ 能量流模拟（按月/小时）  ④ 财务计算（购电 0.35 / 售电 0.07 €/kWh, 通胀 2%, 利率 3.5%）
  </div>`,true,true);

  // ━━━ 附录：德国参数全表 ━━━
  const stateTbl=`<div class="tw"><table>
   <tr><th>缩写</th><th style="text-align:left">英文</th><th style="text-align:left">中文</th><th>年用电 kWh</th><th>发电系数</th></tr>
   ${DE_STATES.map(s=>`<tr class="${s[0]===r.state?'hi':''}"><td>${s[0]}</td><td style="text-align:left">${s[1]}</td><td style="text-align:left">${s[2]}</td><td>${s[3]}</td><td>${s[4]}</td></tr>`).join('')}
  </table></div>`;
  const monthTbl=`<div class="tw"><table>
   <tr><th>月份</th><th>cool</th><th>heat</th><th>季节</th><th>天数</th><th>用电占比</th><th>发电占比</th></tr>
   ${MONTH_FLAGS.map((m,i)=>`<tr><td>${MNZ[i]}</td><td>${m[1]}</td><td>${m[2]}</td><td>${m[3]}</td><td>${DAYS_IN_MONTH[i]}</td><td>${DE_MONTHLY[i].toFixed(4)}</td><td>${DE_GEN_MONTHLY[i].toFixed(4)}</td></tr>`).join('')}
  </table></div>`;
  const ucTbl=`<div class="tw"><table>
   <tr><th>强度</th><th>annual</th><th>cool_month</th><th>heat_month</th><th>cool_peak</th><th>heat_peak</th></tr>
   ${Object.entries(UC).map(([k,v])=>`<tr class="${k===r.usage?'hi':''}"><td>${k}</td><td>${v.am}</td><td>${v.cmm}</td><td>${v.hmm}</td><td>${v.cpm}</td><td>${v.hpm}</td></tr>`).join('')}
  </table></div>`;
  const occTbl=`<div class="tw"><table>
   <tr><th>occupancy</th><th>daytime_mult</th><th>白天时段</th><th style="text-align:left">说明</th></tr>
   ${Object.entries(OCC).map(([k,v])=>`<tr class="${k===r.occ?'hi':''}"><td>${k}</td><td>${v}</td><td>H09–H17</td><td style="text-align:left">${OCC_ZH[k]}</td></tr>`).join('')}
  </table></div>`;
  const hvacTbl=`<div class="tw"><table>
   <tr><th style="text-align:left">system</th><th>base_thermal_load_kwh</th><th style="text-align:left">说明</th></tr>
   <tr class="${r.system==='No heating or cooling system'?'hi':''}"><td style="text-align:left">No heating/cooling</td><td>0</td><td style="text-align:left">无额外电量</td></tr>
   <tr class="${r.system==='Air conditioning'?'hi':''}"><td style="text-align:left">Air conditioning</td><td>0</td><td style="text-align:left">仅重分配冷季月份和峰时段；不增加年电量</td></tr>
   <tr class="${r.system==='Electric heating'?'hi':''}"><td style="text-align:left">Electric heating</td><td>3000</td><td style="text-align:left">德国冬季寒冷；电采暖基础热负荷较高</td></tr>
   <tr class="${r.system==='Heat pump (heating & cooling)'?'hi':''}"><td style="text-align:left">Heat pump</td><td>2000</td><td style="text-align:left">热泵效率高；但德国冬季长供暖需求大</td></tr>
  </table></div>`;
  const evTbl=`<div class="tw"><table>
   <tr><th>小时</th><th>mostly_overnight</th><th>mixed_day_night</th><th>mostly_daytime</th><th>solar_optimized</th></tr>
   ${Array.from({length:24},(_,hh)=>`<tr><td>H${String(hh).padStart(2,'0')}</td><td>${EVP.mostly_overnight[hh]}</td><td>${EVP.mixed_day_and_night[hh]}</td><td>${EVP.mostly_daytime[hh]}</td><td>${EVP.solar_optimized[hh]}</td></tr>`).join('')}
  </table></div>`;
  const genHourTbl=`<div class="tw"><table>
   <tr><th>小时</th>${MNZ.map(m=>`<th>${m}</th>`).join('')}</tr>
   ${DE_GEN_HOUR_TBL()}
  </table></div>`;
  h+=blk('附','德国参数全表（可视化附录）','14 张数据表',`
  <div class="ssec"><div class="sstit">A1 各州预设年用电量 + 兜底发电系数 ${srcTag('DE_预设各州年用电量.md')} ${srcTag('DE_兜底年发电系数.md')}</div>${stateTbl}</div>
  <div class="ssec"><div class="sstit">A2 月份标记 + 月度比例 + 月度发电兜底 ${srcTag('DE_月份标记.md')} ${srcTag('DE_月度比例.md')} ${srcTag('DE_月度发电兜底.md')}</div>${monthTbl}</div>
  <div class="ssec"><div class="sstit">A3 用电强度系数 ${srcTag('DE_用电强度系数.md')}</div>${ucTbl}</div>
  <div class="ssec"><div class="sstit">A4 在室占用系数 ${srcTag('GLOBAL_occupancy_factors.md')}</div>${occTbl}</div>
  <div class="ssec"><div class="sstit">A5 暖通空调热负荷 ${srcTag('DE_暖通空调热负荷.md')}</div>${hvacTbl}</div>
  <div class="ssec"><div class="sstit">A6 EV 充电分布 ${srcTag('DE 电动汽车充电负荷.md')}</div>${evTbl}</div>
  <div class="ssec"><div class="sstit">A7 小时×月 发电兜底 (kWh/kWp) ${srcTag('DE_小时发电兜底数据.md')}</div>${genHourTbl}</div>`);

  document.getElementById('out').innerHTML=h;
  document.querySelectorAll('.shdr').forEach(el=>{
    el.addEventListener('click',()=>{
      const b=el.nextElementSibling,ch=el.querySelector('.chev'),o=b.classList.contains('open');
      b.classList.toggle('open',!o);el.classList.toggle('open',!o);ch&&ch.classList.toggle('open',!o);
    });
  });
}

// 小时×月 发电兜底数据（kWh/kWp，行=小时 0..23，列=Jan..Dec）
const DE_GEN_HOUR=[[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0.063,0.021,0,0,0,0,0],[0,0,0.026,0,0.094,0.145,0.107,0.025,0,0,0,0],[0,0,0.125,0.101,0.185,0.223,0.188,0.126,0.028,0,0,0],[0,0.085,0.216,0.197,0.266,0.292,0.262,0.22,0.137,0.087,0.049,0],[0.078,0.161,0.292,0.283,0.339,0.352,0.325,0.302,0.237,0.166,0.107,0.055],[0.143,0.219,0.347,0.356,0.399,0.4,0.381,0.371,0.32,0.23,0.152,0.1],[0.183,0.254,0.376,0.409,0.442,0.434,0.417,0.42,0.38,0.275,0.178,0.126],[0.192,0.261,0.382,0.442,0.467,0.452,0.438,0.447,0.412,0.294,0.181,0.129],[0.167,0.239,0.359,0.454,0.474,0.457,0.445,0.453,0.418,0.287,0.16,0.109],[0.113,0.192,0.306,0.443,0.463,0.446,0.435,0.437,0.393,0.255,0.121,0.069],[0.04,0.124,0.231,0.41,0.433,0.419,0.409,0.399,0.335,0.199,0.068,0.023],[0,0.043,0.142,0.356,0.386,0.378,0.367,0.339,0.253,0.128,0,0],[0,0,0.049,0.283,0.324,0.323,0.312,0.264,0.155,0.048,0,0],[0,0,0,0.197,0.251,0.257,0.246,0.179,0.053,0,0,0],[0,0,0,0.101,0.173,0.182,0.171,0.09,0,0,0,0],[0,0,0,0,0.091,0.101,0.091,0,0,0,0,0],[0,0,0,0,0,0.022,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0]];
function DE_GEN_HOUR_TBL(){
  return DE_GEN_HOUR.map((row,hh)=>`<tr><td>H${String(hh).padStart(2,'0')}</td>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr>`).join('');
}

// ── 主 update ──────────────────────────────────────────────────────────
function upd(){
  const sys=document.getElementById('s-q2').value,km=document.getElementById('s-q4').value;
  document.getElementById('f-q3').classList.toggle('hidden',sys==='No heating or cooling system');
  document.getElementById('f-q5').classList.toggle('hidden',km==='0');
  const r=calcLoad(
    document.getElementById('s-state').value,sys,
    document.getElementById('s-q3').value,parseInt(km)||0,
    document.getElementById('s-q1').value,document.getElementById('s-q5').value
  );
  const rh=calcRH(
    parseFloat(document.getElementById('s-pv').value),
    parseFloat(document.getElementById('s-3d').value)||0,
    parseFloat(document.getElementById('s-2d').value)||0,
    document.getElementById('s-tier').value,
    sys,parseInt(km)||0
  );
  render(r,rh);
}
document.querySelectorAll('select,input').forEach(e=>e.addEventListener('input',upd));
document.querySelectorAll('select,input').forEach(e=>e.addEventListener('change',upd));
upd();
