export class RejectionTracker {
  private readonly counts = new Map<string, number>();

  increment(reason: string): void {
    const current = this.counts.get(reason) ?? 0;
    this.counts.set(reason, current + 1);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counts.entries());
  }
}
