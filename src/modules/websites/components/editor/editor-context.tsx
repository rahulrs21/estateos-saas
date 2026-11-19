"use client";

import { createContext, useContext } from "react";
import type { LinkedAgent, LinkedUpload } from "../../linked";
import type { PageSection } from "../../registry";
import type { EditorPayload } from "../../server/service";
import type { ElementKind } from "../../theme";

/** An element drawn on the canvas: its key (a prop path such as "headline" or "items.2"), kind and the group it sits in. */
export interface CanvasElement { key: string; kind: ElementKind; parent: string | null; depth: number }

/*
 * Page-level services for editor controls that act outside the page data:
 * connecting a lead form, choosing an agent and editing company contacts.
 * Every action goes through the server, which re-checks role and company.
 */
export interface EditorServices {
  organizationId: string;
  pageId: string;
  payload: EditorPayload;
  isAdministrator: boolean;
  /** Re-reads forms, contacts and linked data without touching the unsaved draft. */
  refresh: () => Promise<void>;
  /** Shows a chosen agent before the page is saved (the server re-reads it on save). */
  previewAgent: (agent: LinkedAgent) => void;
  /** Shows a chosen library image before the page is saved. */
  previewUpload: (upload: LinkedUpload) => void;
  openBrand: () => void;
  /** Every ID used on the current draft, for creating unique row, column and widget IDs. */
  elementIds: () => Set<string>;
  /** The sections of the current draft (menu links). */
  pageSections: () => PageSection[];
  /** The elements of a section as drawn on the canvas, in page order. */
  canvasElements: (sectionId: string) => CanvasElement[];
  /** Selects an element of a section, as a click on the canvas does. */
  selectElement: (sectionId: string, key: string, kind: ElementKind) => void;
}

export const EditorServicesContext = createContext<EditorServices | null>(null);

export function useEditorServices() {
  const services = useContext(EditorServicesContext);
  if (!services) throw new Error("Editor services are only available inside the page editor.");
  return services;
}
