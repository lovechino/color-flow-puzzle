export class GridUtils {
  constructor(private readonly size: number) {}

  /** Flat index from (row, col) */
  idx(r: number, c: number): number {
    return r * this.size + c;
  }

  /** Row from flat index */
  row(i: number): number {
    return Math.floor(i / this.size);
  }

  /** Col from flat index */
  col(i: number): number {
    return i % this.size;
  }

  /** Get neighbors (up, down, left, right) - filtered by grid boundaries */
  neighbors(i: number): number[] {
    const r = this.row(i);
    const c = this.col(i);
    const result: number[] = [];
    if (r > 0) result.push(i - this.size); // up
    if (r < this.size - 1) result.push(i + this.size); // down
    if (c > 0) result.push(i - 1); // left
    if (c < this.size - 1) result.push(i + 1); // right
    return result;
  }

  /** Optimized traversal for hot loops - no array allocation */
  forEachNeighbor(i: number, cb: (ni: number) => void): void {
    const r = this.row(i);
    const c = this.col(i);
    if (r > 0) cb(i - this.size);
    if (r < this.size - 1) cb(i + this.size);
    if (c > 0) cb(i - 1);
    if (c < this.size - 1) cb(i + 1);
  }

  /** Manhattan distance between two flat indices */
  manhattan(i1: number, i2: number): number {
    return Math.abs(this.row(i1) - this.row(i2)) + Math.abs(this.col(i1) - this.col(i2));
  }
}
