// SI units internally; road coordinates are deterministic and independent of chunk lifetime.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
export const roadX = s => 120*Math.sin(s/1100) + 58*Math.sin(s/530) + 18*Math.sin(s/240);
export const roadY = s => 7 + 10*Math.sin(s/820) + 4*Math.sin(s/310);
export const roadSlope = s => 120/1100*Math.cos(s/1100)+58/530*Math.cos(s/530)+18/240*Math.cos(s/240);
export const roadCurve = s => -120/(1100**2)*Math.sin(s/1100)-58/(530**2)*Math.sin(s/530)-18/(240**2)*Math.sin(s/240);
export function hash(x, z=0) { const n = Math.sin(x*127.1+z*311.7)*43758.5453123; return n-Math.floor(n); }
export function noise(x,z) {
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
  return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
}
export function terrainY(x,s) {
  const d=Math.abs(x-roadX(s));
  const broad=(noise(x/360,s/420)-.44)*100+(noise(x/135,s/160)-.5)*26;
  const fine=(noise(x/33,s/33)-.5)*3;
  return roadY(s)-.16 + smooth(7,100,d)*(broad+fine) + smooth(250,1700,d)*32;
}
export class RideSimulation {
  constructor() { this.s=80; this.offset=-1.75; this.v=0; this.distance=0; this.heading=0; this.lean=0; this.rpm=1200; this.gear=0; this.throttle=0; this.cruise=0; this.mode='tour'; this.assist=true; this.slip=0; this.recovery=0; this.recoveries=0; this.riskTime=0; }
  vehicle='bike';
  setVehicle(type){
    if(!['bike','car'].includes(type))return;
    this.vehicle=type;this.v=0;this.throttle=0;this.cruise=0;this.heading=0;this.lean=0;this.offset=-1.75;this.slip=0;this.riskTime=0;this.recovery=0;this.gear=0;this.rpm=type==='car'?850:1200;
  }
  get maxSpeed(){ return (this.mode==='tour'?100:180)/3.6; }
  get surface(){ return Math.abs(this.offset)>3.65?'grass':'asphalt'; }
  recover(){this.offset=-1.75;this.heading=0;this.lean=0;this.v=Math.min(this.v,4);this.slip=0;this.riskTime=0;this.recovery=0;this.cruise=0;this.recoveries++;}
  update(dt,input={}) {
    if(this.recovery>0){this.recovery-=dt;this.v*=Math.exp(-5*dt);this.lean*=Math.exp(-3*dt);if(this.recovery<=0)this.recover();return;}
    const brake=clamp(input.brake||0,0,1),steer=clamp(input.steer||0,-1,1);
    if(brake>.02)this.cruise=0;
    const target=this.cruise?clamp((Math.min(this.cruise/3.6,this.maxSpeed)-this.v)*.6+.13,0,1):clamp(input.throttle||0,0,1);
    this.throttle+=(target-this.throttle)*(1-Math.exp(-dt*5));
    const grass=this.surface==='grass',grip=grass?.48:1;
    const car=this.vehicle==='car';
    let accel=this.throttle*((car?3.6:4.7)-(car?1.5:2.3)*clamp(this.v/50,0,1))-.15-.00115*this.v*this.v-(grass?1.0:0)-brake*(car?8:8.8)*grip;
    // Cruise uses gentle engine braking on descents / after a lower target is selected.
    if(this.cruise&&this.v>this.cruise/3.6+.4)accel-=Math.min(3,(this.v-this.cruise/3.6)*1.5);
    accel-=9.81*(roadY(this.s+.5)-roadY(this.s-.5));
    this.v=clamp(this.v+accel*dt,0,Math.max(this.maxSpeed,this.v-3*dt));
    const roadTurn=roadCurve(this.s)*this.v;
    let yawRate=steer*((car?.42:.52)/(1+this.v*(car?.05:.045)));
    if(this.assist&&Math.abs(steer)<.05)yawRate+=(-this.heading*1.8-clamp((this.offset+1.75)*.009,-.15,.15))+roadTurn;
    this.heading=clamp(this.heading+(yawRate-roadTurn)*dt,-.75,.75);
    const turnDemand=Math.abs(yawRate)*this.v;
    const brakeDemand=brake*(car?8:8.8)*grip;
    const combined=Math.hypot(turnDemand,brakeDemand)/(9.81*grip);
    this.slip+=(clamp((combined-.85)*1.1,0,1)-this.slip)*(1-Math.exp(-dt*6));
    this.offset+=Math.sin(this.heading)*this.v*dt;
    if(this.slip>.1)this.offset+=Math.sign(this.heading||yawRate||1)*this.slip*this.v*.035*dt;
    const ds=this.v*Math.cos(this.heading)*dt/Math.sqrt(1+roadSlope(this.s)**2);
    this.s+=ds;this.distance+=this.v*dt;
    const leanTarget=Math.atan(yawRate*this.v/9.81)*(car?.13:-1);
    this.lean+=(clamp(leanTarget,-.78,.78)-this.lean)*(1-Math.exp(-dt*5));
    this.gear=this.v<.35?0:clamp(Math.floor(this.v*3.6/27)+1,1,6);
    const gearRatio=[0,2.8,1.9,1.45,1.18,1,.86][this.gear];
    const rpmTarget=car?(this.gear?clamp(850+this.v*gearRatio*85+this.throttle*500,900,6200):850+this.throttle*2300):(this.gear?clamp(1400+this.v*gearRatio*155+this.throttle*900,1400,9800):1200+this.throttle*3200);
    this.rpm+=(rpmTarget-this.rpm)*(1-Math.exp(-dt*9));
    this.riskTime=this.slip>.78&&this.v>17?this.riskTime+dt:Math.max(0,this.riskTime-dt*2);
    if(Math.abs(this.offset)>32||this.riskTime>1.35){this.recovery=1.15;this.cruise=0;}
  }
}
