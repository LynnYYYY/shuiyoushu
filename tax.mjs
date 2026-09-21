export const limits=[36000,144000,300000,420000,660000,960000,Infinity];
export const rates=[.03,.1,.2,.25,.3,.35,.45];
export const quick=[0,2520,16920,31920,52920,85920,181920];
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export const bracket=n=>limits.findIndex(v=>Math.max(0,n)<=v);
export const tax=n=>round(Math.max(0,Math.max(0,n)*rates[bracket(n)]-quick[bracket(n)]));
export const bonusTax=n=>round(Math.max(0,n*rates[bracket(n)]-quick[bracket(n)]/12));
export function calculate(s,method='separate'){
 const sum=a=>round(a.reduce((x,y)=>x+y,0));
 const salary=sum(s.salary),social=sum(s.social),pension=sum(s.pension),additional=sum(s.additional);
 const insuranceMonths=(s.insurance||Array(12).fill(0)).map(n=>round(Math.max(0,Math.min(200,n)))),insuranceDeduct=sum(insuranceMonths);
 const annuityMonths=s.annuity||Array(12).fill(0),annuityEligible=(s.annuityDeduct||Array(12).fill(0)).map((n,i)=>Math.min(n,annuityMonths[i]));
 const annuity=sum(annuityMonths),annuityDeduct=sum(annuityEligible);
 const sideGross=s.sideGross||Array(12).fill(0),sidePaid=s.sidePaid||Array(12).fill(0),sideIncome=sum(sideGross),sideWithheld=sum(sidePaid),sideTaxable=s.sideTaxable||0;
 const pensionDeduct=Math.min(12000,pension);
 const beforeDonation=Math.max(0,round(salary+sideTaxable+(method==='merged'?s.bonus:0)-60000-social-pensionDeduct-additional-s.medical-insuranceDeduct-annuityDeduct));
 const donationLimited=Math.min(s.donationLimited||0,round(beforeDonation*.3)),donationFull=Math.min(s.donationFull||0,round(beforeDonation-donationLimited)),donationDeduct=round(donationLimited+donationFull);
 const annualBase=round(beforeDonation-donationDeduct);
 const wageTax=tax(annualBase), bTax=method==='separate'?bonusTax(s.bonus):0;
 let cumIncome=0,cumSocial=0,cumPension=0,cumAdditional=0,cumInsurance=0,cumAnnuity=0,paid=0,employerPaid=0,employerId=null;
 const months=s.salary.map((gross,i)=>{
  const bonus=i===s.bonusMonth?s.bonus:0;
  const job=s.employment?.[i],active=!s.employment||Boolean(job);
  if(s.employment&&active&&job.id!==employerId){cumIncome=0;cumSocial=0;cumPension=0;cumAdditional=0;cumInsurance=0;cumAnnuity=0;employerPaid=0;employerId=job.id;}
  if(s.employment&&!active&&bonus>0&&method==='merged')throw Error('合并计税奖金在未工作的月份发放，请按真实发薪情况调整工作月份。');
  cumIncome=round(cumIncome+gross+(method==='merged'?bonus:0));
  cumSocial=round(cumSocial+s.social[i]);cumPension=round(cumPension+Math.max(0,Math.min(s.pension[i],12000-sum(s.pension.slice(0,i)))));cumAdditional=round(cumAdditional+s.additional[i]);
  cumInsurance=round(cumInsurance+insuranceMonths[i]);
  cumAnnuity=round(cumAnnuity+annuityEligible[i]);
  const base=active?Math.max(0,round(cumIncome-5000*(s.employment?(job?(job.first?i+1:i-job.start+1):0):i+1)-cumSocial-cumAdditional-cumAnnuity-(s.insuranceTiming==='monthly'?cumInsurance:0)-(s.pensionTiming==='monthly'?Math.min(12000,cumPension):0))):0;
  const withholding=round(active?Math.max(0,tax(base)-(s.employment?employerPaid:paid)):0);paid=round(paid+withholding);employerPaid=round(employerPaid+withholding);
  const bonusWithholding=method==='separate'&&i===s.bonusMonth?bTax:0;
  return {month:i+1,gross,bonus,social:s.social[i],pension:s.pension[i],additional:s.additional[i],base,rate:rates[bracket(base)],wageTax:withholding,bonusTax:bonusWithholding,sideGross:sideGross[i],sidePaid:sidePaid[i],totalTax:round(withholding+bonusWithholding+sidePaid[i]),paid:round(paid+(method==='separate'&&i>=s.bonusMonth?bTax:0)+sum(sidePaid.slice(0,i+1))),net:round(gross+bonus+sideGross[i]-sidePaid[i]-s.social[i]-s.pension[i]-annuityMonths[i]-withholding-bonusWithholding)};
 });
 const totalTax=round(wageTax+bTax),gross=round(salary+s.bonus+sideIncome);
 return {method,salary,sideIncome,sideTaxable,gross,social,pension,additional,pensionDeduct,insuranceDeduct,annuity,annuityDeduct,donationDeduct,annualBase,wageTax,bonusTax:bTax,totalTax,net:round(gross-social-pension-annuity-totalTax),prepaid:round(paid+bTax+sideWithheld),settlement:round(wageTax-paid-sideWithheld),months};
}
