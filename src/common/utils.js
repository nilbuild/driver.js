import DOMPurify from 'dompurify';

/**
 * Turn a string into a node
 * @param  {String} htmlString to convert
 * @return {HTMLElement|Node}   Converted node element
 */
export const createNodeFromString = (htmlString) => {
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(htmlString.trim());

  // Change this to div.childNodes to support multiple top-level nodes
  return div.firstChild;
};

/**
 * Gets the CSS property from the given element
 * @param {HTMLElement|Node} element
 * @param {string} propertyName
 * @param {boolean} prefixVendor
 * @return {string}
 */
export const getStyleProperty = (element, propertyName, prefixVendor = false) => {
  if (prefixVendor) {
    const prefixes = ['', '-webkit-', '-ms-', 'moz-', '-o-'];
    for (let counter = 0; counter < prefixes.length; counter++) {
      const prefixedProperty = prefixes[counter] + propertyName;
      const foundValue = getStyleProperty(element, prefixedProperty);

      if (foundValue) {
        return foundValue;
      }
    }

    return '';
  }

  let propertyValue = '';

  if (element.currentStyle) {
    propertyValue = element.currentStyle[propertyName];
  } else if (document.defaultView && document.defaultView.getComputedStyle) {
    propertyValue = document.defaultView
      .getComputedStyle(element, null)
      .getPropertyValue(propertyName);
  }

  return propertyValue && propertyValue.toLowerCase ? propertyValue.toLowerCase() : propertyValue;
};

/**
 * Checks if the passed element is dom object or not
 * @param element
 * @returns {boolean}
 */
export const isDomElement = function (element) {
  return element && typeof element === 'object' && 'nodeType' in element;
};
