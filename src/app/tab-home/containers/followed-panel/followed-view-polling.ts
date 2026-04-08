// Polling simple pour followed-view
export class FollowedViewPolling {
  private pollingTimer?: any;
  private isActive = false;

  constructor(
    private onCheck: () => Promise<void>,
    private minInterval: number = 20000,
    private maxInterval: number = 90000
  ) {}

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.scheduleNext();
  }

  stop() {
    this.isActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  private scheduleNext() {
    if (!this.isActive) return;

    const randomDelay = Math.random() * (this.maxInterval - this.minInterval) + this.minInterval;
    console.log(`Prochain polling dans ${Math.round(randomDelay / 1000)}s`);

    this.pollingTimer = setTimeout(async () => {
      if (this.isActive) {
        try {
          await this.onCheck();
        } catch (error) {
          console.error('Erreur polling:', error);
        }
        this.scheduleNext(); // Programmer le suivant
      }
    }, randomDelay);
  }
}
