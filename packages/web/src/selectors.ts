/**
 * CSS class names and selectors for the radial tree visualization.
 * 
 * IMPORTANT: These values MUST match the constants in @octotree/core/src/selectors.ts
 * If these change, both the CLI and web packages must be updated together.
 * 
 * We define them here instead of importing from @octotree/core to avoid bundling
 * Node.js-specific modules (fs, child_process, etc.) in the browser build.
 * 
 * @see packages/core/src/selectors.ts for the source of truth
 */
export const RADIAL_TREE_CONTAINER = 'radial-tree';
export const RADIAL_TREE_LINK_CLASS = 'radial-tree__link';
export const RADIAL_TREE_LEVELS_CLASS = 'radial-tree__levels';
export const RADIAL_TREE_LINKS_CLASS = 'radial-tree__links';
export const RADIAL_TREE_TOOLTIP_CLASS = 'radial-tree__tooltip';

