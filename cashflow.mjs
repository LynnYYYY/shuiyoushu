import {round} from './tax.mjs?v=13';

export function renderCashFlow(r,format){
 const gap=round(r.settlement+(r.bonusSettlement||0)),final=round(r.cashReceived-gap);
 const owed=round(r.totalTax-(r.equity?.tax||0));
 const incomeTypes=['工资',...(r.gross-r.salary-(r.sideIncome||0)>0?['奖金']:[]),...(r.sideIncome>0?['副业']:[])].join(' + ');
 const steps=[
  ['起点','税前总收入',incomeTypes,r.gross,'start'],
  ['−','个人社保与公积金','个人缴费部分',r.social,'minus'],
  ...(r.pension?[['−','个人养老金缴存','转入养老账户，同时享受税前扣除',r.pension,'minus']]:[]),
  ...(r.annuity?[['−','个人企业 / 职业年金缴费','个人缴费部分',r.annuity,'minus']]:[]),
  ['−','已扣个税（'+incomeTypes+'）',r.actualWithholding?'按实际扣税核对':'按各月预扣估算',r.prepaid,'minus','tax'],
  ...(r.equity?.cashPaid?[['−','股权激励现金缴税','只减本人现金支付部分',r.equity.cashPaid,'minus']]:[]),
  ...(r.withdrawal.cash?[['＋','公积金提取到账','转入本人银行卡',r.withdrawal.cash,'plus']]:[]),
  [gap<0?'＋':gap>0?'−':'＋',gap<0?'预计退税':gap>0?'预计补税':'无需退补税',gap<0?'已扣税 − 应缴税；预计次年退回':gap>0?'应缴税 − 已扣税；预计次年补缴':'已扣税与应缴税相同',Math.abs(gap),gap>0?'minus':'plus','settlement']
 ];
 const taxDetail=typeof r.taxBeforeDeductions==='number'?`<div class="tax-inline"><div class="tax-inline-title">个税怎么算</div><div><span>抵扣前个税</span><b>${format(r.taxBeforeDeductions)}</b></div><div class="tax-saving"><span>− 抵扣省下的税</span><b>${format(r.taxSaving)}</b></div><div><span>＝ 最终应交个税</span><b>${format(owed)}</b></div>${r.deductionItems?.length?'<details class="minor-details"><summary>每项省了多少税</summary>'+r.deductionItems.map(([name,amount])=>'<div><span>'+name+' · 省税</span><b>'+format(amount)+'</b></div>').join('')+'<small>按上方顺序逐项计算。</small></details>':''}</div>`:'';
 const scale=Math.max(1,r.gross,final,...steps.map(x=>x[3]));
 const lines=steps.map(([sign,label,note,amount,kind,key])=>`<div class="cash-step ${kind}${key?' cash-'+key:''}" data-cash-sign="${kind==='minus'?-1:1}" data-cash-amount="${amount}"><span class="cash-sign" aria-hidden="true">${sign}</span><div class="cash-item"><div class="cash-line"><span>${label}</span><strong>${kind==='minus'?'− ':kind==='plus'?'+ ':''}${format(amount)}</strong></div><small>${note}</small>${key==='tax'?taxDetail:''}<div class="cash-meter" aria-hidden="true"><i style="width:${Math.min(100,amount/scale*100)}%"></i></div></div></div>`).join('');
 return `<h2>从总收入，到最终到手</h2><p class="cash-intro">总收入 − 扣款 + 提取 + 退税 − 补税</p><div class="cash-equation">${lines}<div class="cash-step cash-final"><span class="cash-sign" aria-hidden="true">＝</span><div class="cash-item"><span>税后可得 · 含预计退补税</span><strong>${format(final)}</strong><small>本年预计到账 ${format(r.cashReceived)}${gap?', '+(gap<0?'另预计次年退税 ':'次年预计需补税 ')+format(Math.abs(gap)):''}</small></div></div></div>`;
}
