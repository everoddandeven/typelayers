/**
 * @module tl/structs/PriorityQueue
 */
import {assert} from '../asserts';
import {clear} from '../obj';

/**
 * @type {number}
 */
export const DROP: number = Infinity;

/**
 * @classdesc
 * Priority queue.
 *
 * The implementation is inspired from the Closure Library's Heap class and
 * Python's heapq module.
 *
 * See https://github.com/google/closure-library/blob/master/closure/goog/structs/heap
 * and https://hg.python.org/cpython/file/2.7/Lib/heapq.py.
 *
 * @template T
 */
export default class PriorityQueue {
  /**
   * @param {function(T): number} priorityFunction Priority function.
   * @param {function(T): string} keyFunction Key function.
   */

  private priorityFunction_: (param: any) => number;
  private keyFunction_: (param: any) => string;
  private elements_: any[];
  private priorities_: any[];
  private queuedElements_: {[key: string]: boolean};

  constructor(priorityFunction: (param: any) => number, keyFunction: <T>(param: T) => string) {
    /**
     * @type {function(T): number}
     * @private
     */
    this.priorityFunction_ = priorityFunction;

    /**
     * @type {function(T): string}
     * @private
     */
    this.keyFunction_ = keyFunction;

    /**
     * @type {Array<T>}
     * @private
     */
    this.elements_ = [];

    /**
     * @type {Array<number>}
     * @private
     */
    this.priorities_ = [];

    /**
     * @type {!Object<string, boolean>}
     * @private
     */
    this.queuedElements_ = {};
  }

  /**
   * FIXME empty description for jsdoc
   */
  public clear(): void {
    this.elements_.length = 0;
    this.priorities_.length = 0;
    clear(this.queuedElements_);
  }

  /**
   * Remove and return the highest-priority element. O(log N).
   * @return {T} Element.
   */
  public dequeue() {
    const elements = this.elements_;
    const priorities = this.priorities_;
    const element = elements[0];
    if (elements.length == 1) {
      elements.length = 0;
      priorities.length = 0;
    } else {
      elements[0] = elements.pop();
      priorities[0] = priorities.pop();
      this.siftUp_(0);
    }
    const elementKey = this.keyFunction_(element);
    delete this.queuedElements_[elementKey];
    return element;
  }

  /**
   * Enqueue an element. O(log N).
   * @param {T} element Element.
   * @return {boolean} The element was added to the queue.
   */
  public enqueue(element: any): boolean {
    assert(!(this.keyFunction_(element) in this.queuedElements_), 31); // Tried to enqueue an `element` that was already added to the queue
    const priority = this.priorityFunction_(element);
    if (priority != DROP) {
      this.elements_.push(element);
      this.priorities_.push(priority);
      this.queuedElements_[this.keyFunction_(element)] = true;
      this.siftDown_(0, this.elements_.length - 1);
      return true;
    }
    return false;
  }

  /**
   * @return {number} Count.
   */
  public getCount(): number {
    return this.elements_.length;
  }

  /**
   * Gets the index of the left child of the node at the given index.
   * @param {number} index The index of the node to get the left child for.
   * @return {number} The index of the left child.
   * @private
   */
  public getLeftChildIndex_(index: number): number {
    return index * 2 + 1;
  }

  /**
   * Gets the index of the right child of the node at the given index.
   * @param {number} index The index of the node to get the right child for.
   * @return {number} The index of the right child.
   * @private
   */
  public getRightChildIndex_(index: number): number {
    return index * 2 + 2;
  }

  /**
   * Gets the index of the parent of the node at the given index.
   * @param {number} index The index of the node to get the parent for.
   * @return {number} The index of the parent.
   * @private
   */
  public getParentIndex_(index: number): number {
    return (index - 1) >> 1;
  }

  /**
   * Make this a heap. O(N).
   * @private
   */
  private heapify_(): void {
    let i: number;
    for (i = (this.elements_.length >> 1) - 1; i >= 0; i--) {
      this.siftUp_(i);
    }
  }

  /**
   * @return {boolean} Is empty.
   */
  public isEmpty(): boolean {
    return this.elements_.length === 0;
  }

  /**
   * @param {string} key Key.
   * @return {boolean} Is key queued.
   */
  public isKeyQueued(key: string): boolean {
    return key in this.queuedElements_;
  }

  /**
   * @param {T} element Element.
   * @return {boolean} Is queued.
   */
  public isQueued(element: any): boolean {
    return this.isKeyQueued(this.keyFunction_(element));
  }

  /**
   * @param {number} index The index of the node to move down.
   * @private
   */
  public siftUp_(index: number): void {
    const elements = this.elements_;
    const priorities = this.priorities_;
    const count = elements.length;
    const element = elements[index];
    const priority = priorities[index];
    const startIndex = index;

    while (index < count >> 1) {
      const lIndex = this.getLeftChildIndex_(index);
      const rIndex = this.getRightChildIndex_(index);

      const smallerChildIndex =
        rIndex < count && priorities[rIndex] < priorities[lIndex]
          ? rIndex
          : lIndex;

      elements[index] = elements[smallerChildIndex];
      priorities[index] = priorities[smallerChildIndex];
      index = smallerChildIndex;
    }

    elements[index] = element;
    priorities[index] = priority;
    this.siftDown_(startIndex, index);
  }

  /**
   * @param {number} startIndex The index of the root.
   * @param {number} index The index of the node to move up.
   * @private
   */
  public siftDown_(startIndex: number, index: number): void {
    const elements = this.elements_;
    const priorities = this.priorities_;
    const element = elements[index];
    const priority = priorities[index];

    while (index > startIndex) {
      const parentIndex = this.getParentIndex_(index);
      if (priorities[parentIndex] > priority) {
        elements[index] = elements[parentIndex];
        priorities[index] = priorities[parentIndex];
        index = parentIndex;
      } else {
        break;
      }
    }
    elements[index] = element;
    priorities[index] = priority;
  }

  /**
   * FIXME empty description for jsdoc
   */
  public reprioritize(): void {
    const priorityFunction = this.priorityFunction_;
    const elements = this.elements_;
    const priorities = this.priorities_;
    let index = 0;
    const n = elements.length;
    let element: any, i: number, priority: number;
    for (i = 0; i < n; ++i) {
      element = elements[i];
      priority = priorityFunction(element);
      if (priority == DROP) {
        delete this.queuedElements_[this.keyFunction_(element)];
      } else {
        priorities[index] = priority;
        elements[index++] = element;
      }
    }
    elements.length = index;
    priorities.length = index;
    this.heapify_();
  }
}
