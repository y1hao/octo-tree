/**
 * CSS class names and selectors used by the CLI to interact with the web visualization.
 * These must match the classes used in the web package's RadialTree component.
 * 
 * If these change, both the CLI and web packages must be updated together.
 */
export const RADIAL_TREE_CONTAINER = 'radial-tree';
export const RADIAL_TREE_LINK_CLASS = 'radial-tree__link';
export const RADIAL_TREE_LEVELS_CLASS = 'radial-tree__levels';
export const RADIAL_TREE_LINKS_CLASS = 'radial-tree__links';
export const RADIAL_TREE_TOOLTIP_CLASS = 'radial-tree__tooltip';

// Selectors for use in Puppeteer/DOM queries
export const RADIAL_TREE_SVG_SELECTOR = '.radial-tree svg';
export const RADIAL_TREE_LINK_SELECTOR = '.radial-tree__link';

