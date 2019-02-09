export class PausableIntervalTask {
    private intervalId = null;
    constructor(private func, private ms: number) { }

    async start() {
        if (this.intervalId) { throw new Error('is already running'); }
        this.intervalId = setInterval(this.func, this.ms);
        this.func();

    }
    async stop() {
        if (this.intervalId === null) { throw new Error('has not been started yet'); }
        clearInterval(this.intervalId);
        this.intervalId = null;
    }
}
