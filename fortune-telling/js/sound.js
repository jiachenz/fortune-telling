/**
 * 音效模块 - 使用真实 MP3 音效文件
 * ===============================================
 * 音效文件：assets/sound/a-short-fluttering-sound-of-a-falling-coin.mp3
 * 时长约 1s，覆盖抛起 + 旋转 + 落地全程
 */

class SoundModule {
    constructor() {
        this.audioBuffer = null;
        this.ctx = null;
        this.enabled = true;
        this._init();
    }

    async _init() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) { this.enabled = false; return; }
            this.ctx = new AudioContext();
            const response = await fetch('assets/sound/a-short-fluttering-sound-of-a-falling-coin.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn('音效加载失败:', e);
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * 播放硬币音效
     * @param {number} pitchRate  - 播放速率，控制音调高低（0.85~1.15）
     * @param {number} volume     - 音量（0~1）
     */
    playCoin(pitchRate = 1.0, volume = 1.0) {
        if (!this.enabled || !this.ctx || !this.audioBuffer) return;
        this.resume();

        const source = this.ctx.createBufferSource();
        source.buffer = this.audioBuffer;
        source.playbackRate.value = pitchRate;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(this.ctx.currentTime);
    }
}

window.SoundModule = SoundModule;
