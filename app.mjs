import {estimateSide} from './side.mjs?v=21';
import {applyEquity} from './equity.mjs?v=21';
import {renderCashFlow} from './cashflow.mjs?v=21';
import {calculate,round,tax,limits,rates,quick} from './tax.mjs?v=21';
import {estimateBeijing,estimateCity} from './social.mjs?v=21';
import {withdrawal} from './withdrawal.mjs?v=21';
const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('zh-CN',{minimumFractionDigits:0,maximumFractionDigits:1}),yuan=n=>'¥ '+fmt(n);
let mode='annual',lastResult=null,socialDetails=null;
const months=Array.from({length:12},(_,i)=>i+1);
const opts=(selected=12)=>months.map(m=>`<option value="${m-1}" ${m===selected?'selected':''}>${m} 月</option>`).join('');
const num=(id,val=0,max=1000000000)=>`<input id="${id}" type="number" min="0" max="${max}" step="0.01" value="${val}">`;
const select=(id,options)=>`<select id="${id}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`;
const field=(id,title,input)=>`<div><label for="${id}">${title}</label>${input}</div>`;
const range=id=>`<div class="range"><span>扣除期间</span><select id="${id}-start" aria-label="${id} 扣除开始月份">${opts(1)}</select><span>至</span><select id="${id}-end" aria-label="${id} 扣除结束月份">${opts()}</select></div>`;
const block=(id,title,cap,body)=>`<div class="deduction-block"><div class="deduction-top"><label><input id="${id}-on" type="checkbox"><span class="deduction-name">${title}</span> <small>${cap}</small></label></div><div class="deduction-body" id="${id}-body" hidden>${body}</div></div>`;
$('bonus-month').innerHTML=opts();$('selected-month').innerHTML=opts(9);
const bonusAmountBox=$('bonus').closest('.two-col');
bonusAmountBox.insertAdjacentHTML('beforebegin','<div class="bonus-input-header"><h3 class="bonus-input-title">全年一次性奖金</h3><div class="segmented" id="bonus-entry-mode"><button type="button" data-bonus-mode="total" aria-pressed="true">填总金额</button><button type="button" data-bonus-mode="months" aria-pressed="false">按几个月工资</button></div></div><div id="bonus-months-fields" hidden><div class="two-col">'+field('bonus-months','奖金月数（个月）',num('bonus-months',2,120))+field('bonus-base-salary','税前月薪（元）',num('bonus-base-salary',25000))+'</div><label class="bonus-follow"><input id="bonus-follow-salary" type="checkbox" checked> 使用上方工资的平均月薪</label><p class="notice" id="bonus-estimate" role="status"></p></div>');
$('bonus').parentElement.parentElement.id='bonus-total-field';
document.querySelector('label[for="bonus"]').textContent='奖金总金额（元）';
let bonusEntryMode='total';
$('bonus-entry-mode').addEventListener('click',e=>{const button=e.target.closest('[data-bonus-mode]');if(!button)return;bonusEntryMode=button.dataset.bonusMode;$('bonus-months-fields').hidden=bonusEntryMode!=='months';$('bonus-total-field').hidden=bonusEntryMode==='months';bonusAmountBox.classList.toggle('bonus-month-only',bonusEntryMode==='months');document.querySelectorAll('[data-bonus-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.bonusMode===bonusEntryMode));update();});
$('bonus-base-salary').addEventListener('input',()=>{$('bonus-follow-salary').checked=false;});
$('monthly-input').innerHTML=`<div class="uniform-pay"><label for="uniform-salary">统一税前月薪</label><div class="uniform-controls">${num('uniform-salary',25000)}<button type="button" id="fill-salary">填入全部 12 个月</button></div><p class="hint" id="fill-status" role="status">每月工资相同，只需填写一次；填入后仍可修改个别月份。</p></div><div class="compact-grid">${months.map(m=>field('salary-'+m,m+' 月工资',num('salary-'+m,25000))).join('')}</div><p class="hint">填写实际发放月份的税前工资，包含普通绩效与季度奖金；全年一次性奖金单独填写。</p>`;

let workCount=1;
const workRow=(i,start=0)=>'<div class="work-row" data-work="'+i+'"><h4>第 '+(i+1)+' 段工作</h4><div class="two-col">'+field('work-start-'+i,'开始领工资的月份','<select id="work-start-'+i+'">'+opts(start+1)+'</select>')+field('work-end-'+i,'最后领工资的月份','<select id="work-end-'+i+'">'+opts()+'</select>')+'</div>'+field('work-pay-'+i,'这段时间税前月薪（元）',num('work-pay-'+i,25000))+(i?'<button class="add-btn" type="button" data-remove-work="'+i+'">删除这段</button>':'')+'</div>';
$('monthly-input').insertAdjacentHTML('afterend',block('work','今年有换工作 / 只上了几个月班','只填月份和月薪',
 '<p class="hint">一段工作填一次，空档月份自动按无工资、无单位社保缴费处理。按工资到账月份近似任职月份；同月两家公司发薪、离职后补发工资或自己续缴社保，暂不适用这个快捷估算。</p><div id="work-rows">'+workRow(0)+'</div><button class="add-btn" type="button" id="add-work" aria-describedby="work-add-hint">＋ 再加一段工作</button><p class="hint" id="work-add-hint" role="status"></p>'+field('work-first','第一段工作开始前，今年领过工资或固定实习报酬吗？',select('work-first',[['unknown','不确定 · 按入职后月份估算'],['no','没有 · 按本年首次工作估算'],['yes','有 · 请把前面的工作也加进来']]))+'<p class="hint">选“没有”时，假设单位采用首次取得工资政策，从年初累计每月 5,000 元基本减除；其他情况按在本单位月份累计。各段从头估算预扣，专项附加扣除仅模拟工作月份申报，全年符合条件的扣除仍用于年度税额。不会模拟所有单位的特殊预扣方式。</p><div id="work-result" class="notice"></div>'));
$('add-work').addEventListener('click',()=>{const rows=[...document.querySelectorAll('.work-row')],start=val('work-end-'+rows.at(-1).dataset.work)+1;if(rows.length>=12||start>11)return;const i=workCount++;$('work-rows').insertAdjacentHTML('beforeend',workRow(i,start));toggle();update();});
$('work-rows').addEventListener('click',e=>{const b=e.target.closest('[data-remove-work]');if(b){b.closest('.work-row').remove();toggle();update();}});
function employmentInputs(){
 const jobs=[...document.querySelectorAll('.work-row')].map(e=>{const i=e.dataset.work;return {start:val('work-start-'+i),end:val('work-end-'+i),pay:val('work-pay-'+i)};}).sort((a,b)=>a.start-b.start);
 const salary=Array(12).fill(0),employment=Array(12).fill(null);let previous=-1;
 jobs.forEach((job,id)=>{if(job.start>job.end)throw Error('工作结束月份不能早于开始月份。');if(job.start<=previous)throw Error('两段工作的月份重叠了。这个快捷估算暂不支持同月由多家公司发薪。');for(let i=job.start;i<=job.end;i++){salary[i]=job.pay;employment[i]={id,start:job.start,first:id===0&&$('work-first').value==='no'};}previous=job.end;});
 $('work-result').textContent='已按 '+jobs.length+' 段工作、'+employment.filter(Boolean).length+' 个月领薪计算；全年税前工资 '+yuan(salary.reduce((x,y)=>x+y,0))+'。各段月薪替代上方全年 / 逐月工资输入。';
 return {salary,employment};
}

$('deductions').innerHTML=`<div class="deduction-section"><div class="section-title"><h2><span>02</span> 税前扣除</h2><span class="tag">基本减除 60,000 元 / 年</span></div>
<div class="social-panel"><h3>社保与公积金</h3><div class="two-col social-basics">
${field('social-city','参保城市',select('social-city',[['beijing','北京'],['shanghai','上海'],['guangzhou','广州'],['shenzhen','深圳'],['other','其他城市']]))}
${field('social-method','填写方式',select('social-method',[['estimate','按工资估算'],['manual','填每月扣款']]))}</div>
<div id="social-estimate"><div id="custom-rates" hidden><p class="hint" id="city-rate-note"></p><details class="minor-details" id="rate-adjustment"><summary>调整社保比例（可选）</summary><div class="two-col">${field('custom-social-rate','个人社保合计比例 %',num('custom-social-rate','',100))}${field('custom-social-fixed','社保每月固定附加额（没有填 0）',num('custom-social-fixed'))}</div></details></div>
<div class="two-col">${field('fund-rate','个人公积金比例',select('fund-rate',[[12,'12%'],[11,'11%'],[10,'10%'],[9,'9%'],[8,'8%'],[7,'7%'],[6,'6%'],[5,'5%'],[0,'未缴存 · 0%']]))}${field('employer-fund-rate','单位公积金比例',select('employer-fund-rate',[['same','同个人比例'],['unknown','不清楚'],[12,'12%'],[11,'11%'],[10,'10%'],[9,'9%'],[8,'8%'],[7,'7%'],[6,'6%'],[5,'5%'],[0,'未缴存 · 0%']]))}</div>

<div id="sh-supplement" hidden><label><input type="checkbox" id="supplement-on"> 公司有补充公积金</label><div id="supplement-input" hidden>${field('supplement-rate','个人补充公积金比例',select('supplement-rate',[[0,'没有 · 0%'],[1,'1%'],[2,'2%'],[3,'3%'],[4,'4%'],[5,'5%']]))}</div></div>
<div id="sz-medical" hidden>${field('medical-tier','医保档次',select('medical-tier',[[1,'一档'],[2,'二档']]))}</div>
${field('base-mode','缴费基数怎么确定？',select('base-mode',[['estimate','按今年平均月薪估算'],['actual','填写单位申报基数']]))}
<p class="hint" id="base-assumption"></p>
<div id="actual-bases" hidden><div class="two-col">${field('social-base-first','1–6 月社保申报基数',num('social-base-first',25000))}${field('fund-base-first','1–6 月公积金申报基数',num('fund-base-first',25000))}</div><label><input id="base-change" type="checkbox"> 7 月起单位申报基数不同</label><div class="two-col" id="second-bases" hidden>${field('social-base-second','7–12 月社保申报基数',num('social-base-second',25000))}${field('fund-base-second','7–12 月公积金申报基数',num('fund-base-second',25000))}</div><p class="hint">社保与公积金基数可以不同。</p></div>
<div id="social-estimate-result" class="social-estimate-result" aria-live="polite"></div>

</div>
<div id="social-manual" hidden>${field('social','每月个人社保 + 公积金',num('social'))}<p class="hint">按工资条填写可依法扣除的个人养老、医疗、失业保险及住房公积金合计；不含单位缴费。此模式直接使用你的实际扣款。</p><label><input id="social-var" type="checkbox"> 各月缴费不同</label><div id="social-monthly" hidden class="compact-grid">${months.map(m=>field('social-'+m,m+' 月社保公积金',num('social-'+m))).join('')}</div></div>
</div>
${block('housing','住房租金 / 贷款利息','同一年度互斥',field('housing-type','扣除类型与标准',select('housing-type',[[1500,'租金 · 1,500 元/月'],[1100,'租金 · 1,100 元/月'],[800,'租金 · 800 元/月'],[1000,'房贷 · 本人扣除 100%'],[500,'房贷 · 本人扣除 50%']]))+'<p class="hint" id="housing-choice-note"></p>'+range('housing')+'<p class="hint">租金要求本人及配偶在主要工作城市无自有住房，同城夫妻仅一方扣除。贷款须符合首套住房贷款利率条件，最长 240 个月；夫妻同年不能同时享受房租与房贷扣除。</p>')}
${block('elder','赡养老人','独生 3,000 / 非独生 ≤1,500',field('elder-type','家庭情况',select('elder-type',[['only','独生子女 · 3,000 元/月'],['shared','非独生子女 · 按约定分摊']]))+'<div id="elder-share-box" hidden>'+field('elder-share','本人每月分摊金额',num('elder-share',1500,1500))+'</div>'+range('elder')+'<p class="hint">被赡养人须年满 60 岁。非独生子女共同分摊 3,000 元/月，本人不超过 1,500 元/月；不按老人数量翻倍。</p>')}
${block('child','子女教育','每人 2,000 元/月','<div class="two-col">'+field('child-count','符合条件的子女数',num('child-count',1,20))+field('child-share','本人扣除比例',select('child-share',[[1,'100%'],[.5,'50%']]))+'</div>'+range('child')+'<p class="hint">适用于满 3 岁学前教育及全日制学历教育。此组子女按相同期间与分摊比例计算；与婴幼儿照护不重复计算同一孩子同一月份。</p>')}
${block('infant','3 岁以下婴幼儿照护','每人 2,000 元/月','<div class="two-col">'+field('infant-count','符合条件的婴幼儿数',num('infant-count',1,20))+field('infant-share','本人扣除比例',select('infant-share',[[1,'100%'],[.5,'50%']]))+'</div>'+range('infant')+'<p class="hint">父母一方扣除 100%，或双方各扣除 50%。孩子满 3 岁的当月应转入子女教育，不能同时享受两项。</p>')}
${block('education','继续教育','学历 400 元/月 + 证书 3,600 元/年','<label><input id="degree" type="checkbox"> 境内学历（学位）继续教育</label>'+range('education')+'<label><input id="certificate" type="checkbox"> 当年取得符合条件的职业资格证书</label>'+field('certificate-month','证书扣除申报月份',`<select id="certificate-month">${opts()}</select>`)+ '<p class="hint">同一学历最长 48 个月；职业资格须在规定目录内，同年多本证书不叠加 3,600 元定额。</p>')}
${block('pension','个人养老金','上限 12,000 元/年',field('pension-amount','全年实际缴存金额',num('pension-amount',12000,12000))+'<div class="two-col">'+field('pension-pay','缴存安排',select('pension-pay',[['spread','每月等额缴存'],...months.map(m=>[m-1,m+' 月一次性缴存'])]))+field('pension-timing','扣除申报方式',select('pension-timing',[['monthly','缴存当月及时申报'],['annual','仅年度汇算申报']]))+'</div><p class="hint">与基本养老保险不同，须缴入个人养老金资金账户。缴存额会从可支配收入扣除；本金仍属于个人养老资产。</p>')}
${block('insurance','税优商业健康保险','上限 2,400 元/年','<p class="hint">仅适用于有税优识别码、符合规定的商业健康保险；普通医疗险、重疾险不自动符合。无需在这里填写识别码。个人养老金账户内买的保险计入个人养老金，不能再在此重复扣除。</p>'+field('insurance-monthly','凭证对应的月度保费合计（系统最多扣除 200 元/月）',num('insurance-monthly',200))+range('insurance')+field('insurance-timing','申报方式',select('insurance-timing',[['annual','年度汇算时申报'],['monthly','单位按月申报扣除']]))+'<p class="hint">按保险凭证填写可扣除月份与月度保费，不把年缴总保费直接填作月保费。多张符合条件的保单合并后共用限额。保费属于生活支出，本工具不从工资到账额另减；节税体现在个税中。</p>')}
${block('side','兼职接单 / 稿费 / 许可收入','居民个人综合所得',field('side-labor','全年劳务报酬税前收入（接单、咨询等）',num('side-labor'))+field('side-writing','全年稿酬税前收入',num('side-writing'))+field('side-royalty','全年特许权使用费税前收入',num('side-royalty'))+field('side-schedule','副业收入怎样收到？',select('side-schedule',[['spread','每月差不多 · 按 12 个月均分'],...months.map(m=>[m-1,m+' 月一次收到'])]))+'<p class="hint">劳务和许可收入按收入的 80%、稿酬按 56% 并入年度综合所得。系统自动估算预扣税：按每种收入每月一个计税单位，或所选月份一次取得计算。实际多项目、多付款方、平台特殊预扣或未扣缴时可能不同；全年应纳税额不受收款安排影响，到账现金与退补税为估算。收入按税务申报类别填写；开店、个体户等经营所得不能填作劳务。本版不计算经营所得、增值税及附加税。</p><div id="side-estimate" class="notice"></div>')}
${block('equity','公司 RSU / 期权','按你知道的信息估算','<div id="equity-simple">'+field('equity-type','公司给你的是什么？',select('equity-type',[['option','期权 · 将来按约定价格买股票'],['rsu','RSU · 满足条件后拿到股票'],['unknown','不清楚']]))+field('equity-stage','今年进行到哪一步？',select('equity-stage',[['grant','仅授予，未拿到股票 / 行权'],['event','今年已经拿到股票 / 行权'],['plan','想估算将来拿到股票 / 行权']]))+field('equity-granted','共授予多少股 / 份？（不记得可留空）',num('equity-granted',''))+'<div id="equity-expiry-box">'+field('equity-expiry','期权到期日（可不填）','<input type="date" id="equity-expiry">')+'</div><div id="equity-event" hidden>'+field('equity-quantity','这次拿到 / 准备行权多少股？',num('equity-quantity',''))+field('equity-price','当时每股市价 / 预计市价（人民币）',num('equity-price',''))+'<div id="equity-strike-box">'+field('equity-strike','每股买入价（行权价，人民币）',num('equity-strike',''))+'</div></div><div class="notice" id="equity-preview"></div></div><details><summary>已有公司给的计税明细？可选精确核对</summary><label><input type="checkbox" id="equity-exact"> 使用公司明细替代上面的估算</label><div id="equity-exact-fields" hidden>'+'<label><input id="equity-qualified" type="checkbox"> 单位已确认：居民个人、符合上市公司股权激励单独计税政策</label><p class="hint">不是所有 RSU / 期权都适用。未归属授予价值、未行权期权价值不要填写；请用单位确认的本年应税金额，多次归属 / 行权全年合并。未上市公司、跨境任职分摊、境外抵免及出售股票所得不在此入口计算。不符合单独计税的工资性激励应按单位口径并入工资，不能在这里重复计入。</p>'+field('equity-income','本年股权激励应税金额（人民币）',num('equity-income'))+field('equity-paid','股权本年实际已缴税（含扣股抵税）',num('equity-paid'))+field('equity-cash','其中：本人现金支付的税款',num('equity-cash'))+field('equity-month','现金税款支付月份（多次支付暂集中显示）','<select id="equity-month">'+opts()+'</select>')+'<p class="hint">例如卖出部分股票抵税：计入已缴税，不计入本人现金支付。这里不计股票出售回款，也不从银行卡现金重复扣该部分税。</p>'+'</div></details>')}
${block('annuity','企业年金 / 职业年金','填扣款或比例',field('annuity-mode','你知道哪一种？',select('annuity-mode',[['amount','知道每月从工资扣多少钱'],['rate','只知道个人缴费比例'],['unknown','不知道有没有 / 不清楚金额']]))+'<div id="annuity-inputs"><div id="annuity-amount-box">'+field('annuity-pay','每月从工资扣的年金（元）',num('annuity-pay',''))+'</div><div id="annuity-rate-box" hidden>'+field('annuity-rate','个人缴费比例 %（不是单位比例）',num('annuity-rate',4,100))+'</div>'+range('annuity')+'<details><summary>知道缴费基数或准确抵扣额？可选填写</summary>'+field('annuity-base','年金缴费基数（不知道留空）',num('annuity-base',''))+'<label><input id="annuity-confirmed" type="checkbox"> 我有单位给的可抵扣金额</label><div id="annuity-eligible-box" hidden>'+field('annuity-eligible','每月可抵扣金额',num('annuity-eligible',''))+'</div></details></div><div class="notice" id="annuity-estimate"></div><p class="hint">这是单位提供的补充养老福利，与自己开的个人养老金账户不同；只算个人扣款，单位缴费不用填。基数未知时按有工资月份的平均月薪粗估，扣除暂按基数的 4% 封顶；未核定当地法定基数上限，职业年金的岗位 / 薪级工资基数也可能低于月薪。结果是估算，不是工资条。不要再把这笔钱填进社保合计。</p>')}
${block('donation','公益慈善捐赠','年度汇算扣除',field('donation-limited','符合条件的普通限额捐赠（全年）',num('donation-limited'))+field('donation-full','有明确全额扣除政策的捐赠（全年）',num('donation-full'))+'<p class="hint">需通过符合条件的公益组织或国家机关并保留捐赠票据，个人转账救助不自动符合。本版先按综合所得应纳税所得额的 30% 核定普通捐赠，再扣全额捐赠；不重复用于单独计税奖金。不模拟单位月度提前扣除。捐款属于生活支出，不从工资到账额另减。</p>')}

${block('medical','大病医疗','仅年度汇算扣除', '<div id="medical-people">'+field('medical-0','本人：医保目录内年度自付金额',num('medical-0'))+'</div><button type="button" id="add-medical" class="add-btn">＋ 添加由本人扣除的配偶 / 未成年子女</button><p class="hint">每位家庭成员分别计算：自付超过 15,000 元的部分，最多扣除 80,000 元。填写已扣除医保报销的目录内自付额，不是医疗总花费；同笔费用不能由夫妻重复扣除。</p>')}
</div><div id="input-error" class="error" role="alert" hidden></div>`;
document.querySelectorAll('#child-count,#infant-count').forEach(e=>e.step='1');
document.querySelectorAll('#actual-bases input[type=number]').forEach(e=>{e.value='';e.required=true;});
let medicalCount=1;
$('add-medical').addEventListener('click',()=>{const i=medicalCount++;$('medical-people').insertAdjacentHTML('beforeend',field('medical-'+i,'配偶 / 未成年子女 '+i+'：医保目录内年度自付金额',num('medical-'+i)));});
const val=id=>Number($(id).value||0),on=id=>$(id).checked;
function split(total){const a=Array(12).fill(Math.floor(total*100/12)/100);a[11]=round(total-a[0]*11);return a;}

function constrainWorkMonths(){
 const rows=[...document.querySelectorAll('.work-row')];
 rows.forEach((row,index)=>{
  const id=row.dataset.work,start=$('work-start-'+id),end=$('work-end-'+id);
  const earliest=index?val('work-end-'+rows[index-1].dataset.work)+1:0;
  const latest=index+1<rows.length?val('work-start-'+rows[index+1].dataset.work)-1:11;
  for(const option of start.options)option.disabled=Number(option.value)<earliest||Number(option.value)>Number(end.value);
  for(const option of end.options)option.disabled=Number(option.value)<Number(start.value)||Number(option.value)>latest;
  row.querySelector('h4').textContent='第 '+(index+1)+' 段工作';
 });
 const full=val('work-end-'+rows.at(-1).dataset.work)===11;
 $('add-work').disabled=full||rows.length>=12;
 $('work-add-hint').textContent=full?'最后一段已到 12 月；若要添加下一段，请先调整它的结束月份。':'下一段默认从上一段结束后的下个月开始，可以留出空档月份。重叠月份不可选。';
}
function toggleSimpleInputs(){
 constrainWorkMonths();
 $('work-body').hidden=!on('work-on');$('input-mode').hidden=on('work-on');$('annual-input').hidden=on('work-on')||mode!=='annual';$('monthly-input').hidden=on('work-on')||mode!=='monthly';
 $('annuity-inputs').hidden=$('annuity-mode').value==='unknown';
 $('annuity-amount-box').hidden=$('annuity-mode').value!=='amount';
 $('annuity-rate-box').hidden=$('annuity-mode').value!=='rate';
 $('annuity-eligible-box').hidden=!on('annuity-confirmed');
 $('equity-simple').hidden=on('equity-exact');$('equity-exact-fields').hidden=!on('equity-exact');
 $('equity-expiry-box').hidden=$('equity-type').value!=='option';
 $('equity-event').hidden=$('equity-stage').value==='grant'||$('equity-type').value==='unknown';
 $('equity-strike-box').hidden=$('equity-type').value!=='option';
}
function equityScenario(){
 if(!on('equity-on')||on('equity-exact'))return;
 const type=$('equity-type').value,stage=$('equity-stage').value;
 let note='';
 if(type==='unknown')note='先看授予通知上写的是 RSU 还是 Option。类型不清楚，暂不计入全年税额。';
 else if(stage==='grant')note='份数和到期日只能说明你有多少权益，不能推算税额。普通未公开交易期权通常到行权才产生工资性所得；RSU 要看计划约定的纳税时点。暂未计入全年税额，不等于保证免税。';
 else if(['equity-quantity','equity-price',...(type==='option'?['equity-strike']:[])].some(id=>$(id).value===''))note='还需要这次的股数、当时市价'+(type==='option'?'和行权价':'')+'，可以先留空。股权税暂未计入全年结果，不会把未知税款算成 0 元。';
 else {
  if($('equity-granted').value!==''&&val('equity-quantity')>val('equity-granted'))throw Error('这次股数不能超过填写的授予总数。');
  const income=round(val('equity-quantity')*Math.max(0,val('equity-price')-(type==='option'?val('equity-strike'):0)));
  note='本次情景价值 '+yuan(income)+'；假设符合上市公司股权激励单独计税、全年只有本次，参考个税 '+yuan(tax(income))+'。'+(type==='rsu'?'RSU 暂按免费取得股票、市价 × 股数估值；有买入成本或限制性股票特殊计价时不适用。':'期权按（市价 − 行权价）× 股数估值。')+'这只是情景预览，未加入上方全年税额和到账现金；未卖出的股票不是到手现金。多次归属、非上市、跨境或税务方案不明时，不能仅靠份数定税。';
 }
 $('equity-preview').textContent=note;
}

function state(){
 $('bonus-estimate').textContent='';
 for(const el of document.querySelectorAll('input[type=number]')){if(el.id==='uniform-salary'||el.id==='bonus-base-salary'&&on('bonus-follow-salary')||el.closest('[hidden]'))continue;if(!el.validity.valid)throw Error('请输入有效的非负金额；人数须为整数，个人养老金及分摊金额不得超过标注上限。');}
 const s={salary:mode==='annual'?split(val('annual')):months.map(m=>val('salary-'+m)),social:on('social-var')?months.map(m=>val('social-'+m)):Array(12).fill(val('social')),pension:Array(12).fill(0),additional:Array(12).fill(0),medical:0,bonus:val('bonus'),bonusMonth:val('bonus-month'),pensionTiming:$('pension-timing').value};
 if(on('work-on'))Object.assign(s,employmentInputs());
 if(bonusEntryMode==='months'){
  const count=s.employment?s.employment.filter(Boolean).length:12;
  if(on('bonus-follow-salary'))$('bonus-base-salary').value=round(s.salary.reduce((a,b)=>a+b,0)/count);
  for(const id of ['bonus-months','bonus-base-salary'])if($(id).value===''||!$(id).validity.valid)throw Error('请填写有效的奖金月数和税前月薪。');
  s.bonus=round(val('bonus-months')*val('bonus-base-salary'));
  if(s.bonus>1000000000)throw Error('奖金总额不能超过 10 亿元。');
  $('bonus-estimate').textContent=fmt(val('bonus-base-salary'))+' 元 × '+fmt(val('bonus-months'))+' 个月 = 预计奖金 '+yuan(s.bonus);
 }
 socialDetails=null;
 if($('social-method').value==='estimate'){
  const employer=$('employer-fund-rate').value;
  const config={salary:on('work-on')?Array(12).fill(s.salary.reduce((x,y)=>x+y,0)/s.employment.filter(Boolean).length):s.salary,baseMode:$('base-mode').value,socialBases:[val('social-base-first'),val(on('base-change')?'social-base-second':'social-base-first')],fundBases:[val('fund-base-first'),val(on('base-change')?'fund-base-second':'fund-base-first')],fundRate:val('fund-rate'),employerFundRate:employer==='same'?val('fund-rate'):employer==='unknown'?null:Number(employer)};
  if($('social-city').value!=='other')socialDetails=estimateCity({...config,city:$('social-city').value,medicalTier:val('medical-tier'),supplementRate:on('supplement-on')?val('supplement-rate'):0,employment:s.employment});
  else {const preset=cityRates[$('social-city').value],custom=$('custom-social-rate').value!=='';if(!preset&&!custom)throw Error('此城市暂无预设，请填社保比例，或选择直接填扣款金额。');const rate=custom?val('custom-social-rate'):preset.rate;const average=round(s.salary.reduce((a,b)=>a+b,0)/(s.employment?s.employment.filter(Boolean).length:12));socialDetails=s.salary.map((_,i)=>{const half=i<6?0:1,socialBase=config.baseMode==='estimate'?average:config.socialBases[half],fundBase=config.baseMode==='estimate'?average:config.fundBases[half],pension=round(socialBase*rate/100+val('custom-social-fixed')),fund=round(fundBase*config.fundRate/100),employerFund=config.employerFundRate===null?null:round(fundBase*config.employerFundRate/100);return {socialBase,fundBase,pension,medical:0,unemployment:0,fund,employerFund,total:round(pension+fund)};});}
  s.social=socialDetails.map(m=>m.total);
 }
 if(s.employment){s.social=s.social.map((v,i)=>s.employment[i]?v:0);if(socialDetails)socialDetails=socialDetails.map((d,i)=>s.employment[i]?d:Object.fromEntries(Object.keys(d).map(k=>[k,d[k]===null?null:0])));}
 function add(id,amount){const start=val(id+'-start'),end=val(id+'-end');if(start>end)throw Error('扣除开始月份不能晚于结束月份。');for(let i=start;i<=end;i++)s.additional[i]=round(s.additional[i]+amount);}
 if(on('housing-on'))add('housing',val('housing-type'));
 if(on('elder-on'))add('elder',$('elder-type').value==='only'?3000:val('elder-share'));
 for(const id of ['child','infant'])if(on(id+'-on'))add(id,2000*val(id+'-count')*val(id+'-share'));
 if(on('education-on')){if(on('degree'))add('education',400);if(on('certificate'))s.additional[val('certificate-month')]+=3600;}
 if(on('pension-on')){if($('pension-pay').value==='spread')s.pension=split(val('pension-amount'));else s.pension[val('pension-pay')]=val('pension-amount');}
 if(on('medical-on'))for(let i=0;i<medicalCount;i++)s.medical+=Math.min(80000,Math.max(0,val('medical-'+i)-15000));
 if(on('insurance-on')){s.insurance=Array(12).fill(0);const start=val('insurance-start'),end=val('insurance-end');if(start>end)throw Error('保险扣除开始月份不能晚于结束月份。');for(let i=start;i<=end;i++)s.insurance[i]=Math.min(200,val('insurance-monthly'));s.insuranceTiming=$('insurance-timing').value;}
 if(on('annuity-on')){
  const kind=$('annuity-mode').value,start=val('annuity-start'),end=val('annuity-end');
  if(kind==='unknown')$('annuity-estimate').textContent='年金暂未计入测算，先算你已知的收入；不代表你没有这项福利。';
  else if(kind==='amount'&&$('annuity-pay').value==='')$('annuity-estimate').textContent='填一个每月扣款金额就能估算；暂未填写，年金未计入。';
  else {if(start>end)throw Error('年金缴费结束月份不能早于开始月份。');
   const working=s.salary.filter(n=>n>0),base=$('annuity-base').value===''?(working.length?working.reduce((x,y)=>x+y,0)/working.length:0):val('annuity-base');
   const pay=kind==='rate'?round(base*val('annuity-rate')/100):val('annuity-pay');
   const eligible=on('annuity-confirmed')?val('annuity-eligible'):round(Math.min(pay,base*.04));
   if(on('annuity-confirmed')&&$('annuity-eligible').value==='')throw Error('请输入单位给的年金抵扣金额，或取消精确核对。');
   if(eligible>pay)throw Error('年金抵扣金额不能超过个人缴费。');
   s.annuity=Array(12).fill(0);s.annuityDeduct=Array(12).fill(0);
   for(let i=start;i<=end;i++){s.annuity[i]=pay;s.annuityDeduct[i]=eligible;}
   $('annuity-estimate').textContent='每月个人扣款 '+yuan(pay)+'；'+(on('annuity-confirmed')?'已知可抵扣':'估算可抵扣')+' '+yuan(eligible)+'。已计入 '+(end-start+1)+' 个月。'+(!on('annuity-confirmed')?'以 '+yuan(base)+' 为替代基数，未核定法定上限。':'');
  }
 }
 if(on('donation-on')){s.donationLimited=val('donation-limited');s.donationFull=val('donation-full');}
 if(on('side-on')){Object.assign(s,estimateSide({labor:val('side-labor'),writing:val('side-writing'),royalty:val('side-royalty'),schedule:$('side-schedule').value}));$('side-estimate').textContent='副业全年预扣税估算：'+yuan(round(s.sidePaid.reduce((a,b)=>a+b,0)))+'。';}

 return s;
}
const row=(label,n,cls='')=>`<div class="ledger-row ${cls}"><span>${label}</span><strong>${yuan(n)}</strong></div>`;
function update(){
 try{
  const s=state();equityScenario();const outsideWork=s.employment&&s.bonus>0&&!s.employment[s.bonusMonth];const a=calculate(s,'separate'),b=calculate(outsideWork?{...s,employment:undefined}:s,'merged'),best=a.totalTax<=b.totalTax?'separate':'merged';
  const selected=$('method').value==='auto'?best:$('method').value;if(outsideWork&&selected==='merged')throw Error('奖金合并计税时，发放月份需属于已填写的工作时段；请调整月份，或选择奖金单独计税。');let r=selected==='separate'?a:b;const w=withdrawalState();r.withdrawal=w;r.cashReceived=round(r.months.reduce((t,m)=>t+m.net,0)+w.cash);r.months.forEach((m,i)=>{m.withdrawal=w.months[i].withdrawal;m.cashReceived=round(m.net+w.months[i].cash);});lastResult=r;$('input-error').hidden=true;
  $('net').textContent=yuan(round(r.cashReceived-r.settlement-(r.bonusSettlement||0)));$('withdraw-result').textContent=on('withdraw-on')?'全年预计提取 '+yuan(w.total)+'；其中银行卡到账 '+yuan(w.cash)+'。'+(w.pending>0?'另有 '+yuan(w.pending)+' 本年额度未在所选日程到账，未加入本年现金。':''):'';$('total-tax').textContent=yuan(r.totalTax);$('effective').textContent=(r.gross?r.totalTax/r.gross*100:0).toLocaleString('zh-CN',{maximumFractionDigits:1})+'%';
  const withoutPension=calculate({...s,pension:Array(12).fill(0)},selected);
  r.pensionSaving=round(withoutPension.totalTax-r.totalTax);
  const withoutExtras=calculate({...s,pension:Array(12).fill(0),insurance:Array(12).fill(0),additional:Array(12).fill(0),medical:0,annuity:Array(12).fill(0),annuityDeduct:Array(12).fill(0),donationLimited:0,donationFull:0},selected);
  const saving=round(withoutExtras.totalTax-r.totalTax);
  let deductionState={...s,pension:Array(12).fill(0),insurance:Array(12).fill(0),additional:Array(12).fill(0),medical:0,annuity:Array(12).fill(0),annuityDeduct:Array(12).fill(0),donationLimited:0,donationFull:0},previousTax=withoutExtras.totalTax;
  const deductions=[];
  for(const [name,values] of [['个人养老金',{pension:s.pension}],['税优健康险',{insurance:s.insurance}],['专项附加扣除',{additional:s.additional,medical:s.medical}],['企业 / 职业年金',{annuity:s.annuity,annuityDeduct:s.annuityDeduct}],['公益捐赠',{donationLimited:s.donationLimited,donationFull:s.donationFull}]]){deductionState={...deductionState,...values};const nextTax=calculate(deductionState,selected).totalTax,amount=round(previousTax-nextTax);if(amount>0)deductions.push([name,amount]);previousTax=nextTax;}
  r.taxBeforeDeductions=withoutExtras.totalTax;r.taxSaving=saving;r.deductionItems=deductions;
  $('breakdown').innerHTML=renderCashFlow(r,yuan);
  if(on('equity-on')&&on('equity-exact')){
   if(!on('equity-qualified'))throw Error('请先确认单位已认定该股权激励适用单独计税；不符合时应按单位申报口径处理。');
   r=applyEquity(r,{income:val('equity-income'),paid:val('equity-paid'),cashPaid:val('equity-cash'),month:val('equity-month')});r.withdrawal=w;r.cashReceived=round(r.months.reduce((t,m)=>t+m.net,0)+w.cash);r.months.forEach((m,i)=>m.cashReceived=round(m.net+w.months[i].cash));lastResult=r;$('net').textContent=yuan(round(r.cashReceived-r.settlement-(r.bonusSettlement||0)));$('total-tax').textContent=yuan(r.totalTax);$('effective').textContent=((r.gross+r.equity.income)?r.totalTax/(r.gross+r.equity.income)*100:0).toLocaleString('zh-CN',{maximumFractionDigits:1})+'%';
   $('breakdown').innerHTML=renderCashFlow(r,yuan)+'<div class="notice">'+row('RSU / 期权 · 本年应税金额',r.equity.income)+row('股权全年单独计税',r.equity.tax)+row('股权已缴税（含扣股抵税）',r.equity.paid)+row('其中现金支付税款',r.equity.cashPaid)+row(r.equity.balance>=0?'股权税尚待支付 / 核对':'股权税超缴待核对',Math.abs(r.equity.balance))+'<p class="hint">未出售的股票价值不是银行卡现金。股权税差额与综合所得汇算分开，支付期限以单位适用政策为准。月度扣税柱图仍显示工资、副业及奖金税，股权现金税款已在所选月份到手金额扣减。</p></div>';
  }
  $('comparison').hidden=s.bonus<=0;
  $('comparison').innerHTML='<div class="section-title"><h3>年终奖怎么计税更省？</h3><span class="tag">比较全年个税</span></div><div class="compare-grid">'+[[a,'单独计税'],[b,'并入综合所得']].map(([v,n])=>`<div class="compare-option ${selected===v.method?'active':''}">${n}${selected===v.method?' · 已选':''}<strong>${yuan(v.totalTax)}</strong></div>`).join('')+'</div><div class="notice">'+(a.totalTax===b.totalTax?'两种方式的全年税额相同。':`${best==='separate'?'单独计税':'并入综合所得'}少缴 ${yuan(Math.abs(a.totalTax-b.totalTax))}。`)+ '</div>';
  renderMonth();
  renderSocial(s.salary);
  $('formula').innerHTML=`<div class="formula-box">全年综合所得应纳税所得额 = 工资 ${yuan(r.salary)} + 副业收入额 ${yuan(r.sideTaxable)}${selected==='merged'?' + 奖金 '+yuan(s.bonus):''} − 基本减除 60,000 − 社保公积金 ${fmt(r.social)} − 专项附加扣除 ${fmt(r.additional+s.medical)} − 个人养老金扣除 ${fmt(r.pensionDeduct)} − 税优健康险扣除 ${fmt(r.insuranceDeduct)} − 年金扣除 ${fmt(r.annuityDeduct)} − 公益捐赠扣除 ${fmt(r.donationDeduct)}<br><strong>应税所得：${yuan(r.annualBase)} → 综合所得个税：${yuan(r.wageTax)}</strong><br>当月综合所得预扣税 = max（0，累计应税所得 × 预扣率 − 速算扣除数 − 此前累计已预扣工资税）。</div>`;
 }catch(e){lastResult=null;socialDetails=null;$('input-error').hidden=false;$('input-error').textContent=e.message;$('net').textContent='请检查输入';$('total-tax').textContent='—';$('effective').textContent='—';for(const id of ['breakdown','comparison','month-summary','chart','rows','formula','social-estimate-result','withdraw-result','deposit-note','side-estimate','base-assumption'])$(id).innerHTML='';}
}
const cityRates={shanghai:{name:'上海',rate:10.5,note:'养老 8% + 医疗 2% + 失业 0.5%'},guangzhou:{name:'广州',rate:10.2,note:'参考估算：养老 8% + 医疗 2% + 失业 0.2%'},shenzhen:{name:'深圳',rate:10.2,note:'一档医保参考估算：养老 8% + 医疗 2% + 失业 0.2%'}};
function renderSocial(salary){
 const estimated=$('social-method').value==='estimate';document.querySelector('.net-heading .pill').textContent=estimated?'含社保估算':'实时测算';if(!estimated)return;
 const city=$('social-city').value,name=city==='beijing'?'北京':cityRates[city]?.name||'自填',avg=round(salary.reduce((a,b)=>a+b,0)/(on('work-on')?salary.filter((_,i)=>socialDetails[i].socialBase>0).length||12:12));
 $('base-assumption').textContent=($('base-mode').value==='estimate'?'按平均月薪 '+yuan(avg)+' 估算基数。':'按所填基数计算。')+(city==='other'?'':'各险种分别按当地上下限计算。');

 const total=round(socialDetails.reduce((n,d)=>n+d.total,0));
 $('social-estimate-result').innerHTML='<span class="tag">'+name+' · 个人扣款估算</span><div class="social-periods"><div><h4>全年社保与公积金</h4><strong class="social-total">'+yuan(total)+'</strong>'+row('平均每月（全年 ÷ 12）',round(total/12))+'</div></div><details class="minor-details"><summary>查看每月扣款</summary>'+socialDetails.map((d,i)=>row((i+1)+' 月',d.total)).join('')+'</details>';

}
function renderMonth(){if(!lastResult)return;const r=lastResult,m=r.months[val('selected-month')];
 const max=Math.max(1,...r.months.map(m=>m.totalTax));
 $('chart').innerHTML=r.months.map(v=>`<button class="bar-col" type="button" data-month="${v.month-1}" style="min-width:${Math.max(76,fmt(v.totalTax).length*8+16)}px" aria-pressed="${v.month===m.month}" aria-label="${v.month}月预扣税 ${fmt(v.totalTax)}元" title="${v.month}月：${yuan(v.totalTax)}"><span class="bar-track"><span class="bar" style="height:${Math.max(2,v.totalTax/max*100)}%"><span class="bar-value" aria-hidden="true">${fmt(v.totalTax)}</span></span></span><span>${v.month}月</span></button>`).join('');

 const monthlyCash=r.months.map(v=>{const gross=round(v.gross+v.bonus+(v.sideGross||0)),equityCash=r.equity&&r.equity.month===v.month-1?r.equity.cashPaid:0;return {month:v.month,gross,social:v.social,pension:v.pension,annuity:round(gross-v.social-v.pension-v.totalTax-equityCash-v.net),tax:round(v.totalTax+equityCash),deposit:round(v.cashReceived-v.net),cash:v.cashReceived};});
 const columns=[['gross','＋ 税前收入','＋'],['social','− 社保公积金','−'],['pension','− 个人养老金','−'],['annuity','− 企业 / 职业年金','−'],['tax','− 已扣个税','−'],['deposit','＋ 公积金提取到账','＋'],['cash','＝ 预计到账现金','＝']].filter(([k])=>['gross','social','tax','cash'].includes(k)||monthlyCash.some(v=>v[k]!==0));
 const selectedCash=monthlyCash.find(v=>v.month===m.month);
 $('month-summary').innerHTML='<div class="month-equation"><h3>'+m.month+' 月到账怎么算</h3><div class="month-cash-grid">'+columns.filter(([k])=>['gross','cash'].includes(k)||selectedCash[k]!==0).map(([k,label,sign])=>'<div class="month-cash-row '+(k==='cash'?'total':'')+(fmt(selectedCash[k]).length>9?' wide':'')+'"><span>'+label.slice(2)+'</span><strong>'+sign+' '+yuan(selectedCash[k])+'</strong></div>').join('')+'</div></div>';
 document.querySelector('.monthly-card thead tr').innerHTML='<th>月份</th>'+columns.map(([,label])=>'<th>'+label+'</th>').join('');
 $('rows').innerHTML=monthlyCash.map(v=>'<tr class="'+(v.month===m.month?'selected':'')+'"><td>'+v.month+' 月</td>'+columns.map(([k,,sign])=>'<td>'+sign+' '+fmt(v[k])+'</td>').join('')+'</tr>').join('');

}
function toggle(){$('housing-choice-note').textContent={1500:'适用直辖市、省会、计划单列市等。',1100:'适用其他城市：市辖区户籍人口超过 100 万。',800:'适用其他城市：市辖区户籍人口不超过 100 万。',1000:'首套住房贷款利息，每月扣除 1,000 元。',500:'婚前各自首套住房贷款，每月扣除 500 元。'}[val('housing-type')];toggleWithdrawal();toggleSimpleInputs();for(const id of ['housing','elder','child','infant','education','pension','insurance','annuity','donation','equity','side','medical'])$(id+'-body').hidden=!on(id+'-on');$('social-monthly').hidden=!on('social-var');$('social').disabled=on('social-var');$('elder-share-box').hidden=$('elder-type').value!=='shared';$('custom-rates').hidden=$('social-city').value!=='other';$('sh-supplement').hidden=$('social-city').value!=='shanghai';$('sz-medical').hidden=$('social-city').value!=='shenzhen';const preset=cityRates[$('social-city').value];$('supplement-input').hidden=!on('supplement-on');$('city-rate-note').textContent=preset?preset.note:'填写个人社保比例，或直接填扣款金额。';if($('social-city').value==='other')$('rate-adjustment').open=true;const estimated=$('social-method').value==='estimate';$('social-estimate').hidden=!estimated;$('social-manual').hidden=estimated;$('actual-bases').hidden=$('base-mode').value!=='actual';$('second-bases').hidden=!on('base-change');}
$('social-city').addEventListener('input',()=>{$('custom-social-rate').value='';$('custom-social-fixed').value='0';$('rate-adjustment').open=false;const sh=$('social-city').value==='shanghai';for(const id of ['fund-rate','employer-fund-rate'])for(const o of $(id).options)o.disabled=sh&&Number(o.value)>7;if(sh&&val('fund-rate')>7)$('fund-rate').value='7';if(sh&&Number($('employer-fund-rate').value)>7)$('employer-fund-rate').value='same';});
document.addEventListener('input',e=>{if(e.target.matches('input,select')){toggle();update();}});
document.addEventListener('change',e=>{if(e.target.matches('input,select')){toggle();update();}});
$('input-mode').addEventListener('click',e=>{const button=e.target.closest('[data-mode]');if(!button||button.dataset.mode===mode)return;const next=button.dataset.mode;if(next==='monthly'){split(val('annual')).forEach((n,i)=>$('salary-'+(i+1)).value=n);}else $('annual').value=round(months.reduce((t,m)=>t+val('salary-'+m),0));mode=next;$('annual-input').hidden=mode!=='annual';$('monthly-input').hidden=mode!=='monthly';document.querySelectorAll('[data-mode]').forEach(e=>e.setAttribute('aria-pressed',e.dataset.mode===mode));update();});
$('social-var').addEventListener('change',()=>{if(on('social-var'))months.forEach(m=>$('social-'+m).value=val('social'));update();});
$('fill-salary').addEventListener('click',()=>{const input=$('uniform-salary');if(input.value===''||!input.validity.valid){input.setCustomValidity('请填写有效的非负月薪，最多保留两位小数。');input.reportValidity();return;}months.forEach(m=>$('salary-'+m).value=input.value);$('fill-status').textContent=`已将全部 12 个月填为 ${yuan(val('uniform-salary'))}，可继续修改个别月份。`;update();});
$('uniform-salary').addEventListener('input',()=>{$('uniform-salary').setCustomValidity('');$('fill-status').textContent='点击“填入全部 12 个月”应用金额，将覆盖下方各月工资。';});
$('uniform-salary').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('fill-salary').click();}});
$('chart').addEventListener('click',e=>{const b=e.target.closest('[data-month]');if(b){$('selected-month').value=b.dataset.month;renderMonth();}});
$('rate-table').innerHTML='<div class="table-wrap"><table><thead><tr><th>全年应纳税所得额（元）</th><th>税率</th><th>年度速算扣除数</th><th>奖金月度速算扣除数</th></tr></thead><tbody>'+limits.map((n,i)=>`<tr><td>${i===0?'≤ 36,000':i===6?'> 960,000':'> '+limits[i-1].toLocaleString()+' 至 '+n.toLocaleString()}</td><td>${rates[i]*100}%</td><td>${quick[i].toLocaleString()}</td><td>${(quick[i]/12).toLocaleString()}</td></tr>`).join('')+'</tbody></table></div><p class="hint">奖金用“全额奖金 ÷ 12”对照上述年度区间 ÷ 12 后的月度区间。</p>';
$('rules').insertAdjacentHTML('beforeend',`<details><summary>北京社保、公积金估算依据 · 核验于 2026-09-20</summary><p>北京预设适用于普通在职职工；个人养老 8%、医疗 2% + 3 元、失业 0.5%。基数未知时使用今年不含单填奖金的平均月薪替代，属于测算假设；实际以上一年度工资口径和单位申报为准。</p><ul><li><a href="https://www.beijing.gov.cn/zhengce/zhengcefagui/202608/t20260821_4831679.html" target="_blank" rel="noopener">2026 年 7 月起北京社保基数上下限</a></li><li><a href="https://rsj.beijing.gov.cn/xxgk/2024zcwj/202509/t20250918_4204880.html" target="_blank" rel="noopener">2025 年 7 月起北京社保基数（用于 2026 年上半年）</a></li><li><a href="https://www.beijing.gov.cn/zhengce/zcjd/202608/t20260825_4835519.html" target="_blank" rel="noopener">2026 公积金年度：比例、基数及计算方式</a></li><li><a href="https://banshi.beijing.gov.cn/zcjd/202509/t20250925_428450.html" target="_blank" rel="noopener">2025 公积金年度：2026 年上半年适用基数</a></li><li><a href="https://www.beijing.gov.cn/gongkai/zfxxgk/zc/gz/202112/t20211216_2562734.html" target="_blank" rel="noopener">北京市基本养老保险规定：个人 8%</a></li><li><a href="https://rsj.beijing.gov.cn/weimenhu/wmtgz/202006/t20200622_1930086.html" target="_blank" rel="noopener">北京人社：医保个人 2% + 3 元</a></li><li><a href="https://www.beijing.gov.cn/zhengce/zcjd/zcwd/tycxldzsybx/index.html" target="_blank" rel="noopener">统一城乡失业保险政策：个人 0.5%</a></li><li><a href="https://gjj.beijing.gov.cn/web/zwgk61/2024zcjd/436439572/index.html" target="_blank" rel="noopener">公积金月缴存额：个人与单位各自四舍五入到元</a></li></ul></details>`);


$('rules').insertAdjacentHTML('beforeend',`<details><summary>城市缴费标准与来源 · 2026-09-21</summary><p>各险种分别保底、封顶；相同月份合并展示。上海基本公积金与补充分别取整。</p><p>广州、深圳养老沿用最近公布标准；失业费率 0.2% 及上限沿用已核实标准，2026 年续期与新上限仍待核实。深圳公积金上限按官方年平均工资折算，1–6 月默认按老职工下限，年内入职按所填入职月份处理。</p><p><a href="https://rsj.sh.gov.cn/tdjjf_17554/20260824/t0035_1443297.html" target="_blank" rel="noopener">上海社保</a> · <a href="https://www.shzfgjj.cn/html/newxxgk/zcwj/gfxwj/228478.html" target="_blank" rel="noopener">上海公积金</a> · <a href="https://hrss.gd.gov.cn/zwgk/gsgg/content/post_4789648.html" target="_blank" rel="noopener">广东养老</a> · <a href="https://static.nfnews.com/content/202601/16/c12083149.html" target="_blank" rel="noopener">广州税务标准（南都核实）</a> · <a href="https://gjj.gz.gov.cn/gg/tzgg/content/post_10879601.html" target="_blank" rel="noopener">广州公积金</a> · <a href="https://hrlib.ciic-cloud.cn/news/info?id=01m1jwmwrkfv9rde9yh08a3p7c" target="_blank" rel="noopener">广州9月下限（通知转载）</a> · <a href="https://hsa.sz.gov.cn/fzlm/znts/cnyc/content/post_12568243.html" target="_blank" rel="noopener">深圳医保</a> · <a href="https://www.sz.gov.cn/hdjl/ywzsk/jsj/zfgjj/content/post_12893587.html" target="_blank" rel="noopener">深圳公积金</a> · <a href="https://www.sz.gov.cn/hdjl/ywzsk/jsj/zfgjj/content/mpost_12977659.html" target="_blank" rel="noopener">深圳9月入职</a></p><p>租房提取按已符合资格、账户余额足够估算。</p></details>`);
$('deductions').insertAdjacentHTML('beforeend',block('withdraw','提取公积金 · 租房','到账后计入现金',
 
 '<p class="hint" id="withdraw-city-summary"></p><label><input type="checkbox" id="withdraw-city-different"> 公积金缴在其他城市</label><div id="withdraw-city-picker" hidden>'+field('withdraw-city','公积金缴存城市',select('withdraw-city',[['beijing','北京'],['shanghai','上海'],['guangzhou','广州'],['shenzhen','深圳'],['other','其他 / 已核准额度']]))+'</div>'+
 field('withdraw-doc','是否有租房发票？',select('withdraw-doc',[['simple','没有租房发票'],['documented','有发票，已按要求备案']]))+
 '<div class="notice" id="withdraw-policy"></div><div id="invoice-fields" hidden>'+field('rent-mode','你记得哪个金额？',select('rent-mode',[['total','发票总额'],['monthly','不记得总额 · 填每月租金']]))+field('rent-amount','发票总额',num('rent-amount'))+'</div>'+
 '<div class="range"><span id="withdraw-period-label">提取对应月份</span><select id="withdraw-start" aria-label="租赁开始月份">'+opts(1)+'</select><span>至</span><select id="withdraw-end" aria-label="租赁结束月份">'+opts()+'</select></div><p class="hint" id="withdraw-period-note"></p>'+
 '<div id="shanghai-adjust" hidden><details><summary>房租不足 4,000 元 / 配偶也在提取？</summary>'+field('shanghai-rent','实际每月租金（不超过租金提取）',num('shanghai-rent',4000))+field('withdraw-spouse','配偶每月占用的家庭额度',num('withdraw-spouse'))+'<p class="hint">普通租房上限为每户每月 4,000 元，默认按租金至少 4,000 元、配偶未提取估算；不符合时请调整。</p></details></div>'+
 '<div id="quota-box" hidden>'+field('withdraw-quota','本人获批的每月提取上限',num('withdraw-quota',''))+'</div>'+
 '<p class="hint" id="deposit-note"></p><div id="deposit-fallback" hidden>'+field('withdraw-deposit','个人 + 单位合计月缴存额（仅缺少数据时补充）',num('withdraw-deposit',''))+'</div>'+
 '<details><summary>调整到账时间 / 到账去向</summary><div class="two-col">'+field('withdraw-frequency','预计到账频率',select('withdraw-frequency',[[1,'每月'],[3,'每三个月'],[12,'本年一次']]))+field('withdraw-first','首次预计到账月份','<select id="withdraw-first">'+opts(1)+'<option value="12">次年 1 月</option><option value="13">次年 2 月</option></select>')+'</div>'+field('withdraw-destination','到账去向',select('withdraw-destination',[['bank','转入本人银行卡'],['landlord','直接支付给房东']]))+'<p class="hint">按所选日程模拟到账；直接付给房东的金额不加银行卡现金。</p></details>'+
 '<div id="withdraw-result" class="notice"></div>'));
function withdrawalState(){
 if(!on('withdraw-on'))return {months:months.map(()=>({cash:0,withdrawal:0})),cash:0,total:0};
 const start=val('withdraw-start'),end=val('withdraw-end'),count=end-start+1,city=$('withdraw-city').value,doc=$('withdraw-doc').value==='documented';
 if(count<=0)throw Error('租赁结束月份不能早于开始月份。');
 const needsDeposit=city==='shenzhen'||city==='beijing'&&doc;
 const known=city===$('social-city').value&&socialDetails&&socialDetails.every(d=>d.employerFund!==null);
 if(needsDeposit&&!known&&$('withdraw-deposit').value==='')throw Error('请补充个人与单位合计月缴存额；未知金额不能当作 0。');
 if((city==='other'||city==='guangzhou'&&doc)&&$('withdraw-quota').value==='')throw Error('请填写中心核准的本人月提取上限。');
 const deposits=known?socialDetails.map(d=>round(d.fund+d.employerFund)):Array(12).fill(needsDeposit?val('withdraw-deposit'):0);
 if(doc&&val('rent-amount')<=0)throw Error('请填写发票总额或每月租金。');
 const rent=doc?val('rent-amount')/($('rent-mode').value==='total'?count:1):city==='shanghai'?val('shanghai-rent'):0;
 $('deposit-note').textContent=needsDeposit?(known?'已使用上方公积金缴存额。':'请填写该城市账户的月缴存额。'):'';
 return withdrawal({city,documented:doc,rent,spouse:city==='shanghai'?val('withdraw-spouse'):0,quota:val('withdraw-quota'),deposits,start,end,frequency:val('withdraw-frequency'),first:val('withdraw-first'),direct:$('withdraw-destination').value==='landlord',assumeSufficient:true});
}
function toggleWithdrawal(){
 $('withdraw-body').hidden=!on('withdraw-on');
 if(!on('withdraw-city-different')&&$('withdraw-city').value!==$('social-city').value){$('withdraw-city').value=$('social-city').value;const gz=$('withdraw-city').value==='guangzhou';$('withdraw-frequency').value=gz?'3':'1';$('withdraw-first').value=String(val('withdraw-start')+(gz?2:0));}
 $('withdraw-city-picker').hidden=!on('withdraw-city-different');
 $('withdraw-city-summary').textContent='公积金缴存城市：'+$('withdraw-city').selectedOptions[0].textContent;

 const city=$('withdraw-city').value,doc=$('withdraw-doc').value==='documented',count=val('withdraw-end')-val('withdraw-start')+1;
 $('invoice-fields').hidden=!doc;$('shanghai-adjust').hidden=city!=='shanghai';
 $('shanghai-rent').parentElement.hidden=doc;
 $('quota-box').hidden=!(city==='other'||city==='guangzhou'&&doc);
 document.querySelector('label[for="rent-amount"]').textContent=$('rent-mode').value==='total'?'发票总额（元）':'每月租金（元）';
 $('withdraw-period-label').textContent=doc?'发票对应租赁月份':'提取对应月份';
 $('withdraw-period-note').textContent=doc?'共 '+Math.max(0,count)+' 个月。填总额时自动除以月数；填月租金时按月计算。请选择发票对应的租赁期间，跨年发票仅填写属于 2026 年的金额和月份。':'';
 const needsDeposit=city==='shenzhen'||city==='beijing'&&doc;
 $('deposit-fallback').hidden=!(needsDeposit&&(city!==$('social-city').value||$('social-method').value==='manual'||$('employer-fund-rate').value==='unknown'));
 $('deposit-note').hidden=!needsDeposit;
 $('withdraw-policy').textContent={beijing:doc?'北京：按月租金与个人 + 单位月缴存额中较低值计算。':'每月提取上限：2,000 元 / 人。',shanghai:doc?'上海普通租房：不超过实际租金及 4,000 元 / 户 / 月，扣除配偶占用额度。':'上海无发票普通租房：上限 4,000 元 / 户 / 月，默认按上限估算；房租较低或夫妻共同提取，可在下方调整。',guangzhou:doc?'广州备案租房：不超过实际租金及中心核准的本人月额度。':'每月提取上限：2,000 元 / 人；每三个月到账。',shenzhen:'每月提取上限：个人与单位缴存合计的 80%。',other:'请填写当地中心核准的本人每月额度。'}[city];
}
function resetWithdrawalSchedule(){const gz=$('withdraw-city').value==='guangzhou';$('withdraw-frequency').value=gz?'3':'1';$('withdraw-first').value=String(val('withdraw-start')+(gz?2:0));toggle();update();}
$('withdraw-city').addEventListener('change',resetWithdrawalSchedule);
$('withdraw-start').addEventListener('change',resetWithdrawalSchedule);

$('rules').insertAdjacentHTML('beforeend','<details><summary>个人养老金与税优健康险的扣除依据</summary><p>扣除减少应税收入，不是等额抵税。个人养老金最多扣除 12,000 元/年；符合条件的商业健康保险合计最多 200 元/月、2,400 元/年。</p><p><a href="https://fgk.chinatax.gov.cn/zcfgk/c100016/c5237114/content.html" target="_blank" rel="noopener">个人养老金政策</a> · <a href="https://fgk.chinatax.gov.cn/zcfgk/c102416/c5202544/content.html" target="_blank" rel="noopener">税优健康险限额</a> · <a href="https://www.chinatax.gov.cn/chinatax/n810356/n3255681/c5234212/content.html" target="_blank" rel="noopener">税优识别码要求</a></p></details>');
$('rules').insertAdjacentHTML('beforeend','<details><summary>年金、捐赠、副业与股权政策依据</summary><p><a href="https://www.chinatax.gov.cn/chinatax/n810341/n810765/n812146/n812300/c1079953/content.html" target="_blank" rel="noopener">企业年金与职业年金</a> · <a href="https://www.chinatax.gov.cn/chinatax/n810219/n810744/n3752930/n3752974/c5142144/content.html" target="_blank" rel="noopener">公益捐赠</a> · <a href="https://www.chinatax.gov.cn/n810219/n810744/n3752930/n3752974/c3970366/content.html" target="_blank" rel="noopener">综合所得收入额</a> · <a href="https://fgk.chinatax.gov.cn/zcfgk/c102416/c5211082/content.html" target="_blank" rel="noopener">符合条件的股权激励（至2027年）</a> · <a href="https://fgk.chinatax.gov.cn/zcfgk/c102416/c5211536/content.html" target="_blank" rel="noopener">汇算免补税条件</a></p><p>涉及境外税收抵免、股票出售、非上市股权、跨境任职、经营所得、地方特殊减免等，暂不自动计算。股权单独税与综合所得汇算分别展示。多次现金缴股权税目前集中记到指定月份，不代表每次真实扣缴日期。</p></details>');
$('rules').insertAdjacentHTML('beforeend','<p class="hint"><a href="https://fgk.chinatax.gov.cn/zcfgk/c100015/c5200946/content.html" target="_blank" rel="noopener">副业普通预扣规则依据</a>：每次不超过 4,000 元减 800 元，超过时减 20%；劳务用分档预扣率，稿酬再减按 70%，稿酬及许可收入按 20% 预扣。这里按所选收款安排估算，不代表实际扣缴记录。</p>');
$('rules').insertAdjacentHTML('beforeend','<p><a href="https://www.chinatax.gov.cn/chinatax/n810356/n3010387/c5169351/content.html" target="_blank" rel="noopener">换工作后按本单位任职月份累计减除</a> · <a href="https://www.chinatax.gov.cn/chinatax/n810214/n810641/n2985871/n2985888/n2986028/c5154973/content.html" target="_blank" rel="noopener">本年首次取得工资的累计减除</a></p>');

// One quiet location for calculation details and sources.
const policyRoot=$('rules');
const rentalSources=[...document.querySelectorAll('section.rules')].find(el=>el!==policyRoot);
if(rentalSources){const d=document.createElement('details');d.innerHTML='<summary>租房提取政策来源</summary><p class="result-note">普通租房预设；特殊优惠按当地核准额度。</p>';const links=document.createElement('p');rentalSources.querySelectorAll('a').forEach(a=>{links.append(a,document.createTextNode(' · '));});d.append(links);policyRoot.append(d);rentalSources.remove();}
const scope=policyRoot.querySelector('details');
if(scope)scope.innerHTML='<summary>适用范围与测算说明</summary><p>面向中国大陆居民个人。普通工资、奖金、已录入的综合所得副业参与年度计算；分段工作按各单位分别估算预扣，不支持同月多单位发薪。股权需另看适用方案。</p><p>不覆盖经营所得、跨境抵免、非居民和特殊减免。小额补税可能符合免办条件；年度退补税通常次年发生。大病医疗仅年度扣除，月度预扣为负时当月不退税。</p><p>数据仅在网页内存计算，刷新恢复示例。</p>';
const heading=policyRoot.querySelector('h2');if(heading)heading.remove();
const policyDetails=document.createElement('details');policyDetails.className='policy-details';const policySummary=document.createElement('summary');policySummary.textContent='计算明细与政策依据';policyDetails.append(policySummary);while(policyRoot.firstChild)policyDetails.append(policyRoot.firstChild);policyRoot.append(policyDetails);


for(const id of ['side-body','annuity-body','equity-exact-fields','donation-body','work-body']){
 const parent=$(id),notes=[...parent.querySelectorAll(':scope > p.hint')].filter(p=>p.textContent.length>100);
 if(notes.length){const d=document.createElement('details');d.className='minor-details';d.innerHTML='<summary>填写说明</summary>';notes.forEach(p=>d.append(p));parent.append(d);}
}

toggle();update();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_tax_calculation',description:'读取当前输入对应的年度个税、月度预扣和可支配收入测算结果。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('不接受参数');if(!lastResult)throw Error('请先修正输入');return structuredClone(lastResult);}})).catch(()=>{});}catch{}}
