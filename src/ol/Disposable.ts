/**
 * @module ol/Disposable
 */

/**
 * @classdesc
 * Objects that need to clean up after themselves.
 */
export default class Disposable {

  protected disposed: boolean;

  constructor() {
    /**
     * The object has already been disposed.
     * @type {boolean}
     * @protected
     */
    this.disposed = false;
  }

  /**
   * Clean up.
   */
  public dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.disposeInternal();
    }
  }

  /**
   * Extension point for disposable objects.
   * @protected
   */
  protected disposeInternal(): void {}
}