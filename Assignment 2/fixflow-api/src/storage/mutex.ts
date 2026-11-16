/**
 * A tiny promise-chain mutex. Each task starts only after the previous one has settled, so
 * check-and-update work wrapped in run() can never interleave with other wrapped work, even when
 * the work itself awaits (e.g. bcrypt hashing or an async store call).
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => task());
    // keep the chain alive whether the task succeeded or failed
    this.tail = result.catch(() => undefined);
    return result;
  }
}
