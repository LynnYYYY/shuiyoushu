import {tax,round} from './tax.mjs?v=10';
export function applyEquity(r,{income,paid,cashPaid,month}){
 if([income,paid,cashPaid].some(n=>!Number.isFinite(n)||n<0)||cashPaid>paid||!Number.isInteger(month)||month<0||month>11)throw Error('股权现金支付税款不能超过股权已缴税，月份需有效。');
 const equityTax=tax(income);
 return {...r,totalTax:round(r.totalTax+equityTax),equity:{income,tax:equityTax,paid,cashPaid,balance:round(equityTax-paid),month},months:r.months.map((m,i)=>i===month?{...m,net:round(m.net-cashPaid)}:m)};
}
