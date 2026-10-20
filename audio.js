// Original synthesized engine, wind, and road-surface rumble; no external audio recordings.
export class RideAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineVolume = 0.35;
    this.windVolume = 0.45;
  }

  async init() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    this.ctx = new Audio();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(ctx.destination);

    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 700;
    this.filter.Q.value = 0.6;
    this.filter.connect(this.engine);
    this.engine.connect(this.master);

    this.oscillators = [];
    for (const [ratio, volume, type] of [[1, 0.18, 'sawtooth'], [2, 0.065, 'triangle'], [0.5, 0.07, 'sine']]) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type;
      gain.gain.value = volume;
      osc.connect(gain);
      gain.connect(this.filter);
      osc.frequency.value = 22 * ratio;
      osc.start();
      this.oscillators.push([osc, ratio]);
    }

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.06) / 1.04;
      data[i] = last * 3.5;
    }

    // Wind noise channel
    const windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'highpass';
    this.windFilter.frequency.value = 220;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    windSource.connect(this.windFilter);
    this.windFilter.connect(this.wind);
    this.wind.connect(this.master);
    windSource.start();

    // Surface tire rumble channel (gravel / dirt / cracked road texture feedback)
    const roadSource = ctx.createBufferSource();
    roadSource.buffer = buffer;
    roadSource.loop = true;
    this.roadFilter = ctx.createBiquadFilter();
    this.roadFilter.type = 'bandpass';
    this.roadFilter.frequency.value = 140;
    this.roadFilter.Q.value = 0.9;
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    roadSource.connect(this.roadFilter);
    this.roadFilter.connect(this.roadGain);
    this.roadGain.connect(this.master);
    roadSource.start();

    await ctx.resume();
  }

  setEnabled(value) { this.enabled = value; }

  update(sim, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled && active ? 0.65 : 0, t, 0.12);
    for (const [osc, ratio] of this.oscillators) osc.frequency.setTargetAtTime(sim.rpm / 60 * ratio, t, 0.045);
    this.filter.frequency.setTargetAtTime((sim.vehicle === 'car' ? 180 : 250) + sim.throttle * (sim.vehicle === 'car' ? 600 : 950) + sim.rpm * 0.055, t, 0.08);
    this.engine.gain.setTargetAtTime(this.engineVolume * (0.22 + sim.throttle * 0.5), t, 0.08);
    this.wind.gain.setTargetAtTime(this.windVolume * Math.min(0.8, Math.pow(sim.v / 40, 1.6) * 0.6), t, 0.15);
    this.windFilter.frequency.setTargetAtTime(100 + sim.v * 8, t, 0.15);

    const rough = sim.surfaceInfo ? sim.surfaceInfo.rough : 0.003;
    const rumbleLevel = Math.min(0.45, (rough / 0.024) * Math.min(sim.v / 22, 1.2) * 0.32);
    this.roadGain.gain.setTargetAtTime(this.windVolume * rumbleLevel, t, 0.1);
    this.roadFilter.frequency.setTargetAtTime(95 + sim.v * 4.5 + rough * 6000, t, 0.1);
  }
}
