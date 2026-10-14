/**
 * vocalCaptureWorkletCode.ts
 * Processeur AudioWorklet pour la capture PCM temps reel (Audio Thread dedie).
 * Zéro underrun, filtrage de captureStartTime, silence absolu sur les sorties.
 */

export const VOCAL_CAPTURE_WORKLET_CODE = `
class VocalCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.captureStartTime = 0;
    this.maxSamples = 0;
    this.samplesRecorded = 0;

    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'start') {
        this.captureStartTime = d.captureStartTime;
        this.maxSamples = Math.floor(d.totalDurationSec * sampleRate);
        this.samplesRecorded = 0;
        this.isRecording = true;
      } else if (d.type === 'stop') {
        this.isRecording = false;
      }
    };
  }

  process(inputs, outputs) {
    for (let i = 0; i < outputs.length; i++) {
      for (let ch = 0; ch < outputs[i].length; ch++) {
        outputs[i][ch].fill(0);
      }
    }

    if (!this.isRecording) return true;
    if (currentTime < this.captureStartTime) return true;
    if (this.samplesRecorded >= this.maxSamples) {
      this.isRecording = false;
      return true;
    }

    const input = inputs[0];
    if (input && input.length > 0 && input[0]) {
      const ch0 = input[0];
      const remaining = this.maxSamples - this.samplesRecorded;
      const toCopy = Math.min(ch0.length, remaining);
      const chunk = new Float32Array(toCopy);
      chunk.set(ch0.subarray(0, toCopy));
      this.port.postMessage(chunk, [chunk.buffer]);
      this.samplesRecorded += toCopy;
    }

    return true;
  }
}
registerProcessor('vocal-capture-processor', VocalCaptureProcessor);
`;
