import {round} from './tax.mjs?v=10';
export function useActualWithholding(r,totals,bonusPaid=0,lawful=false){
 if(totals.length!==12||totals.some(n=>!Number.isFinite(n)||n<0)||!Number.isFinite(bonusPaid)||bonusPaid<0)throw Error('实际已扣税须为12个月的非负金额。');
 const total=round(totals.reduce((a,b)=>a+b,0));
 if(bonusPaid>total)throw Error('奖金实际已扣税不能超过全年已扣税合计。');
 let cumulative=0;
 const months=r.months.map((m,i)=>{cumulative=round(cumulative+totals[i]);return {...m,net:round(m.net+m.totalTax-totals[i]),totalTax:totals[i],paid:cumulative,wageTax:null,bonusTax:null};});
 const settlement=round(r.wageTax-(total-bonusPaid)),bonusSettlement=round(r.bonusTax-bonusPaid);
 const comprehensiveIncome=r.method==='merged'?r.gross:r.salary+(r.sideIncome||0);
 const exempt=lawful&&settlement>0&&(comprehensiveIncome<=120000||settlement<=400);
 return {...r,months,prepaid:total,settlement,bonusSettlement,actualBonusPrepaid:bonusPaid,actualWithholding:true,exempt,settlementPayable:exempt?0:Math.max(0,settlement)};
}
