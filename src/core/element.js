import {
  ANIMATION_DURATION_MS,
  CLASS_DRIVER_HIGHLIGHTED_ELEMENT,
  CLASS_FIX_STACKING_CONTEXT,
  CLASS_POSITION_RELATIVE,
} from '../common/constants';
import { getStyleProperty } from '../common/utils';
import Position from './position';

/**
 * Wrapper around DOMElements to enrich them
 * with the functionality necessary
 */
export default class Element {
  /**
   * DOM element object
   * @param {Node|HTMLElement} node
   * @param {Object} options
   * @param {Popover} popover
   * @param {Stage} stage
   * @param {Overlay} overlay
   * @param {Window} window
   * @param {Document} document
   */
  constructor({
    node,
    options,
    popover,
    stage,
    overlay,
    window,
    document,
  } = {}) {
    this.node = node;
    this.document = document;
    this.window = window;
    this.options = options;
    this.overlay = overlay;
    this.popover = popover;
    this.stage = stage;
    this.animationTimeout = null;
  }

  /**
   * Checks if the current element is visible in viewport
   * @returns {boolean}
   * @public
   */
  isInView() {
    let top = this.node.offsetTop;
    let left = this.node.offsetLeft;
    const width = this.node.offsetWidth;
    const height = this.node.offsetHeight;

    let el = this.node;

    while (el.offsetParent) {
      el = el.offsetParent;
      top += el.offsetTop;
      left += el.offsetLeft;
    }

    return (
      top >= this.window.pageYOffset
      && left >= this.window.pageXOffset
      && (top + height) <= (this.window.pageYOffset + this.window.innerHeight)
      && (left + width) <= (this.window.pageXOffset + this.window.innerWidth)
    );
  }

  /**
   * Manually scrolls to the position of element if `scrollIntoView` fails
   * @private
   */
  scrollManually() {
    const elementRect = this.node.getBoundingClientRect();
    const absoluteElementTop = elementRect.top + this.window.pageYOffset;
    const middle = absoluteElementTop - (this.window.innerHeight / 2);

    this.window.scrollTo(0, middle);
  }

  /**
   * Manually scrolls to the position of element if `container` options was informed
   * This helps to improve scroll experience to containers different from window
   * @private
   */
  scrollContainerManually() {
    const elementRect = this.node.getBoundingClientRect();
    const containerRect = this.options.container.getBoundingClientRect();

    const absoluteElementTop = elementRect.top + this.options.container.scrollTop;
    const height = absoluteElementTop - (containerRect.height / 2);

    this.options.container.scrollTo(0, height);
  }

  /**
   * Brings the element to middle of the view port if not in view
   * @public
   */
  bringInView() {
    // If the node is not there or already is in view
    if (!this.node || this.isInView()) {
      return;
    }

    // If tour is inside a container different from window
    if (this.options.container) {
      this.scrollContainerManually();
      return;
    }

    // If browser does not support scrollIntoView
    if (!this.node.scrollIntoView) {
      this.scrollManually();
      return;
    }

    try {
      this.node.scrollIntoView(this.options.scrollIntoViewOptions || {
        behavior: 'instant',
        block: 'center',
      });
    } catch (e) {
      // `block` option is not allowed in older versions of firefox, scroll manually
      this.scrollManually();
    }
  }

  /**
   * Gets the calculated position on screen, around which
   * we need to draw
   * @public
   * @return {Position}
   */
  getCalculatedPosition() {
    const body = this.document.body;
    const documentElement = this.document.documentElement;
    const window = this.window;

    const scrollTop = this.window.pageYOffset || documentElement.scrollTop || body.scrollTop;
    const scrollLeft = window.pageXOffset || documentElement.scrollLeft || body.scrollLeft;
    const elementRect = this.node.getBoundingClientRect();

    return new Position({
      top: elementRect.top + scrollTop,
      left: elementRect.left + scrollLeft,
      right: elementRect.left + scrollLeft + elementRect.width,
      bottom: elementRect.top + scrollTop + elementRect.height,
    });
  }

  /**
   * Gets the popover for the current element if any
   * @returns {Popover|*}
   * @public
   */
  getPopover() {
    return this.popover;
  }

  /**
   * Is called when element is about to be deselected
   * i.e. when moving the focus to next element of closing
   * @public
   */
  onDeselected(hideStage = false) {
    this.hidePopover();

    if (hideStage) {
      this.hideStage();
    }

    this.removeHighlightClasses();

    // If there was any animation in progress, cancel that
    this.window.clearTimeout(this.animationTimeout);

    if (this.options.onDeselected) {
      this.options.onDeselected(this);
    }
  }

  /**
   * Checks if the given element is same as the current element
   * @param {Element} element
   * @returns {boolean}
   * @public
   */
  isSame(element) {
    if (!element || !element.node) {
      return false;
    }

    return element.node === this.node;
  }

  /**
   * Is called when the element is about to be highlighted
   * @public
   */
  onHighlightStarted() {
    if (this.options.onHighlightStarted) {
      this.options.onHighlightStarted(this);
    }
  }

  /**
   * Is called when the element has been successfully highlighted
   * @public
   */
  onHighlighted() {
    const highlightedElement = this;
    if (!highlightedElement.isInView()) {
      highlightedElement.bringInView();
    }

    // Show the popover and stage once the item has been
    // brought in the view, this would allow us to handle
    // the cases where the container has scroll overflow
    this.showPopover();
    this.showStage();
    this.addHighlightClasses();

    if (this.options.onHighlighted) {
      this.options.onHighlighted(this);
    }
  }

  /**
   * Removes the stacking context fix classes and the highlighter classes
   * @private
   */
  removeHighlightClasses() {
    this.node.classList.remove(CLASS_DRIVER_HIGHLIGHTED_ELEMENT);
    this.node.classList.remove(CLASS_POSITION_RELATIVE);

    const stackFixes = this.document.querySelectorAll(`.${CLASS_FIX_STACKING_CONTEXT}`);
    for (let counter = 0; counter < stackFixes.length; counter++) {
      stackFixes[counter].classList.remove(CLASS_FIX_STACKING_CONTEXT);
    }
  }

  /**
   * Adds the highlight class on the current element and "fixes"
   * the parent nodes if they
   * @private
   */
  addHighlightClasses() {
    this.node.classList.add(CLASS_DRIVER_HIGHLIGHTED_ELEMENT);

    // Don't make relative if element already has some position set
    if (this.canMakeRelative()) {
      this.node.classList.add(CLASS_POSITION_RELATIVE);
    }

    // Check and re-define the stacking context
    this.fixStackingContext();
  }

  /**
   * Walks through the parents of the current element and fixes
   * the stacking context
   * @private
   */
  fixStackingContext() {
    let parentNode = this.node.parentNode;
    while (parentNode) {
      if (!parentNode.tagName || parentNode.tagName.toLowerCase() === 'body') {
        break;
      }

      const zIndex = getStyleProperty(parentNode, 'z-index');
      const opacity = parseFloat(getStyleProperty(parentNode, 'opacity'));
      const transform = getStyleProperty(parentNode, 'transform', true);
      const transformStyle = getStyleProperty(parentNode, 'transform-style', true);
      const transformBox = getStyleProperty(parentNode, 'transform-box', true);
      const filter = getStyleProperty(parentNode, 'filter', true);
      const perspective = getStyleProperty(parentNode, 'perspective', true);

      // Stacking context gets disturbed if
      // - Parent has z-index
      // - Opacity is below 0
      // - Filter/transform or perspective is applied
      if (
        /[0-9]+/.test(zIndex)
        || opacity < 1
        || (transform && transform !== 'none')
        || (transformStyle && transformStyle !== 'flat')
        || (transformBox && transformBox !== 'border-box')
        || (filter && filter !== 'none')
        || (perspective && perspective !== 'none')
      ) {
        parentNode.classList.add(CLASS_FIX_STACKING_CONTEXT);
      }

      parentNode = parentNode.parentNode;
    }
  }

  /**
   * Checks if we can make the current element relative or not
   * @return {boolean}
   * @private
   */
  canMakeRelative() {
    const currentPosition = this.getStyleProperty('position');
    const avoidPositionsList = ['absolute', 'fixed', 'relative'];

    // Because if the element has any of these positions, making it
    // relative will break the UI
    return avoidPositionsList.indexOf(currentPosition) === -1;
  }

  /**
   * Get current element's CSS attribute value
   * @param {string} property
   * @returns string
   * @private
   */
  getStyleProperty(property) {
    return getStyleProperty(this.node, property);
  }

  /**
   * Shows the stage behind the element
   * @public
   */
  showStage() {
    this.stage.show(this.getCalculatedPosition());
  }

  /**
   * Gets the DOM Element behind this element
   * @returns {Node|HTMLElement|*}
   * @public
   */
  getNode() {
    return this.node;
  }

  /**
   * Hides the stage
   * @public
   */
  hideStage() {
    this.stage.hide();
  }

  /**
   * Hides the popover if possible
   * @public
   */
  hidePopover() {
    if (!this.popover) {
      return;
    }

    this.popover.hide();
  }

  /**
   * Shows the popover on the current element
   * @public
   */
  showPopover() {
    if (!this.popover) {
      return;
    }

    const showAtPosition = this.getCalculatedPosition();

    // For first highlight, show it immediately because there won't be any animation
    let showAfterMs = ANIMATION_DURATION_MS;
    // If animation is disabled or  if it is the first display, show it immediately
    if (!this.options.animate || !this.overlay.lastHighlightedElement) {
      showAfterMs = 0;
    }

    // @todo remove timeout and handle with CSS
    this.animationTimeout = this.window.setTimeout(() => {
      this.popover.show(showAtPosition);
    }, showAfterMs);
  }

  /**
   * @returns {{height: number, width: number}}
   * @public
   */
  getFullPageSize() {
    // eslint-disable-next-line prefer-destructuring
    const body = this.document.body;
    const html = this.document.documentElement;

    return {
      height: Math.max(body.scrollHeight, body.offsetHeight, html.scrollHeight, html.offsetHeight),
      width: Math.max(body.scrollWidth, body.offsetWidth, html.scrollWidth, html.offsetWidth),
    };
  }

  /**
   * Gets the size for popover
   * @returns {{height: number, width: number}}
   * @public
   */
  getSize() {
    return {
      height: Math.max(this.node.scrollHeight, this.node.offsetHeight),
      width: Math.max(this.node.scrollWidth, this.node.offsetWidth),
    };
  }
}
