/**
 * @module tl/Kinetic
 */

/**
 * @classdesc
 * Implementation of inertial deceleration for map movement.
 *
 * @api
 */
class Kinetic {
  /**
   * @param {number} decay Rate of decay (must be negative).
   * @param {number} minVelocity Minimum velocity (pixels/millisecond).
   * @param {number} delay Delay to consider to calculate the kinetic
   *     initial values (milliseconds).
   */

  private decay_: number;
  private minVelocity_: number;
  private delay_: number;
  private points_: number[];
  private angle_: number;
  private initialVelocity_: number;

  constructor(decay: number, minVelocity: number, delay: number) {
    /**
     * @private
     * @type {number}
     */
    this.decay_ = decay;

    /**
     * @private
     * @type {number}
     */
    this.minVelocity_ = minVelocity;

    /**
     * @private
     * @type {number}
     */
    this.delay_ = delay;

    /**
     * @private
     * @type {Array<number>}
     */
    this.points_ = [];

    /**
     * @private
     * @type {number}
     */
    this.angle_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.initialVelocity_ = 0;
  }

  /**
   * FIXME empty description for jsdoc
   */
  public begin(): void {
    this.points_.length = 0;
    this.angle_ = 0;
    this.initialVelocity_ = 0;
  }

  /**
   * @param {number} x X.
   * @param {number} y Y.
   */
  public update(x: number, y: number): void {
    this.points_.push(x, y, Date.now());
  }

  /**
   * @return {boolean} Whether we should do kinetic animation.
   */
  public end(): boolean {
    if (this.points_.length < 6) {
      // at least 2 points are required (i.e. there must be at least 6 elements
      // in the array)
      return false;
    }
    const delay = Date.now() - this.delay_;
    const lastIndex = this.points_.length - 3;
    if (this.points_[lastIndex + 2] < delay) {
      // the last tracked point is too old, which means that the user stopped
      // panning before releasing the map
      return false;
    }

    // get the first point which still falls into the delay time
    let firstIndex = lastIndex - 3;
    while (firstIndex > 0 && this.points_[firstIndex + 2] > delay) {
      firstIndex -= 3;
    }

    const duration = this.points_[lastIndex + 2] - this.points_[firstIndex + 2];
    // we don't want a duration of 0 (divide by zero)
    // we also make sure the user panned for a duration of at least one frame
    // (1/60s) to compute sane displacement values
    if (duration < 1000 / 60) {
      return false;
    }

    const dx = this.points_[lastIndex] - this.points_[firstIndex];
    const dy = this.points_[lastIndex + 1] - this.points_[firstIndex + 1];
    this.angle_ = Math.atan2(dy, dx);
    this.initialVelocity_ = Math.sqrt(dx * dx + dy * dy) / duration;
    return this.initialVelocity_ > this.minVelocity_;
  }

  /**
   * @return {number} Total distance travelled (pixels).
   */
  public getDistance(): number {
    return (this.minVelocity_ - this.initialVelocity_) / this.decay_;
  }

  /**
   * @return {number} Angle of the kinetic panning animation (radians).
   */
  public getAngle(): number {
    return this.angle_;
  }
}

export default Kinetic;
