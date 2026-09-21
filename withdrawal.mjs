import {round} from './tax.mjs';
// Ordinary rental cases only. Special approvals use the explicit approved quota.
export function withdrawal({city,documented=false,rent=0,spouse=0,quota=0,opening=0,deposits,start=0,end=11,frequency=1,first=start,direct=false,assumeSufficient=false}){
 if(!Array.isArray(deposits)||deposits.length!==12||[rent,spouse,quota,opening,...deposits].some(x=>!Number.isFinite(x)||x<0))throw Error('提取金额与缴存额须为非负数。');
 if(![1,3,12].includes(frequency)||![start,end].every(x=>Number.isInteger(x)&&x>=0&&x<12)||!Number.isInteger(first)||first<0||first>13||start>end||first<start)throw Error('请检查提取期间与首次到账月份。');
 let balance=opening,pending=0,accrued=0,totalPaid=0;
 const months=deposits.map((deposit,i)=>{
  balance=round(balance+deposit);
  let cap=quota;
  if(city==='beijing')cap=documented?Math.min(rent,deposit):2000;
  if(city==='shanghai')cap=Math.max(0,Math.min(4000,rent)-spouse);
  if(city==='guangzhou'&&!documented)cap=2000;
  if(city==='shenzhen')cap=round(deposit*.8);
  if(documented&&(city==='guangzhou'||city==='other'))cap=Math.min(cap,rent);
  if(i>=start&&i<=end)accrued+=cap;
  pending=round(round(accrued)-totalPaid);
  const paid=i>=first&&(i-first)%frequency===0?round(assumeSufficient?pending:Math.min(balance,pending)):0;
  if(!assumeSufficient)balance=round(balance-paid);totalPaid=round(totalPaid+paid);pending=round(pending-paid);
  return {deposit,cap:i>=start&&i<=end?cap:0,withdrawal:paid,cash:direct?0:paid,balance:assumeSufficient?null:balance};
 });
 return {months,total:round(months.reduce((s,m)=>s+m.withdrawal,0)),cash:round(months.reduce((s,m)=>s+m.cash,0)),balance:assumeSufficient?null:balance,pending,assumeSufficient};
}
