/**
 * Yjs Singleton Module
 *
 * Ensures a single Yjs instance is used across the entire application.
 * This prevents the "Yjs was already imported" warning that breaks
 * constructor checks when multiple copies of Yjs are bundled.
 *
 * All modules should import Yjs from this file instead of directly:
 * ```ts
 * import { Y, Awareness, type YDoc, type AwarenessType } from '@/lib/yjs-singleton';
 * ```
 */

import * as YjsModule from "yjs";
import { Awareness as AwarenessClass } from "y-protocols/awareness";

// Re-export Yjs as a singleton (namespace-like access)
export const Y = YjsModule;

// Re-export Awareness class
export const Awareness = AwarenessClass;

// Type exports for use as type annotations
export type YDoc = YjsModule.Doc;
export type YText = YjsModule.Text;
export type YMap<T> = YjsModule.Map<T>;
export type YArray<T> = YjsModule.Array<T>;
export type AwarenessType = InstanceType<typeof AwarenessClass>;

// Re-export commonly used types from yjs
export type { Doc, Text, Map, Array, AbstractType } from "yjs";

// Helper to create a new Y.Doc with proper typing
export function createYDoc(): YjsModule.Doc {
  return new YjsModule.Doc();
}

// Helper to create awareness for a doc
export function createAwareness(doc: YjsModule.Doc): InstanceType<typeof AwarenessClass> {
  return new AwarenessClass(doc);
}
