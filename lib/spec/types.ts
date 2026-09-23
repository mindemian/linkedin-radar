import type { Tab } from '../contract';

/** A question as the Studio stores it: data the user edits, not code. */
export type QuestionSpec =
  | {
      id: string;
      tab: Tab;
      type: 'choice';
      enabled: boolean;
      /** Contract fields this question reads. */
      fields: string[];
      instructions: string;
      /** Option name -> what belongs to that option. Order is preserved. */
      options: { name: string; criterion: string }[];
    }
  | {
      id: string;
      tab: Tab;
      type: 'score';
      enabled: boolean;
      fields: string[];
      instructions: string;
      /** Ordered levels, lowest first. 2 to 10 of them. */
      levels: string[];
    }
  | {
      id: string;
      tab: Tab;
      type: 'noul';
      enabled: boolean;
      fields: string[];
      /** The statement being judged true or false. */
      instructions: string;
      /** Optional descriptions of the yes and no outcomes. */
      whenTrue?: string;
      whenFalse?: string;
    };

/**
 * Open rather than fixed: two presets score for different things and so have
 * different tier rules. A preset declares its own sliders, the Studio builds
 * the controls from that declaration, and tier functions fall back to a
 * default when a preset omits a key.
 */
export type Thresholds = Record<string, number>;

export type Slider = {
  key: string;
  label: string;
  /** Shown under the slider so the rule it drives is legible without code. */
  explains: string;
  min: number;
  max: number;
  step: number;
};

export type Preset = {
  id: string;
  name: string;
  /** One line on what this preset is looking for. */
  purpose: string;
  /** The ICP block, rendered verbatim on the Methods page. */
  icp: string;
  questions: QuestionSpec[];
  thresholds: Thresholds;
  sliders: Slider[];
};

/** One question's answer, stored with its full distribution so thresholds can
 *  be moved later without calling Jev again. */
export type Answer =
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> }
  | { type: 'noul'; noul: number };

export type RowResult = {
  rowId: string;
  answers: Record<string, Answer>;
  latencyMs: number;
  inputTokens: number;
  model: string;
  error?: string;
};
