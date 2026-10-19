// Original synthesized engine/wind; no recordings, music, or external audio assets.
export class RideAudio {
  constructor(){this.ctx=null;this.enabled=true;this.engineVolume=.35;this.windVolume=.45;}
  async init(){
    if(this.ctx){await this.ctx.resume();return;}
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    this.ctx=new Audio();const ctx=this.ctx;
    this.master=ctx.createGain();this.master.gain.value=.65;this.master.connect(ctx.destination);
    this.engine=ctx.createGain();this.engine.gain.value=0;
    this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=700;this.filter.Q.value=.6;this.filter.connect(this.engine);this.engine.connect(this.master);
    this.oscillators=[];
    for(const [ratio,volume,type] of [[1,.18,'sawtooth'],[2,.065,'triangle'],[.5,.07,'sine']]){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;gain.gain.value=volume;osc.connect(gain);gain.connect(this.filter);osc.frequency.value=22*ratio;osc.start();this.oscillators.push([osc,ratio]);}
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.06)/1.04;data[i]=last*3.5;}
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
    this.windFilter=ctx.createBiquadFilter();this.windFilter.type='highpass';this.windFilter.frequency.value=220;
    this.wind=ctx.createGain();this.wind.gain.value=0;source.connect(this.windFilter);this.windFilter.connect(this.wind);this.wind.connect(this.master);source.start();
    await ctx.resume();
  }
  setEnabled(value){this.enabled=value;}
  update(sim,active){
    if(!this.ctx)return;const t=this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled&&active?.65:0,t,.12);
    for(const [osc,ratio] of this.oscillators)osc.frequency.setTargetAtTime(sim.rpm/60*ratio,t,.045);
    this.filter.frequency.setTargetAtTime(250+sim.throttle*950+sim.rpm*.055,t,.08);
    this.engine.gain.setTargetAtTime(this.engineVolume*(.22+sim.throttle*.5),t,.08);
    this.wind.gain.setTargetAtTime(this.windVolume*Math.min(.8,Math.pow(sim.v/40,1.6)*.6),t,.15);
    this.windFilter.frequency.setTargetAtTime(100+sim.v*8,t,.15);
  }
}
