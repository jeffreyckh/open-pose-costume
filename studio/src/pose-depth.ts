import type { Reference, Variant } from './types';
export const poseDepthOrigin = '';
export function isDepthVariant(variant: Variant): boolean { return /\/reference-library\/depth\//.test(variant.original); }
// This installation has no archived depth library. Never fall back to a remote host.
export function withPoseDepth(item: Reference): Reference { return item; }
