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

export type Thresholds = {
  roleConfidenceTier1: number;
  roleConfidenceTier2: number;
  disqualifiedMax: number;
  disqualifiedReject: number;
  bigPublicBrandMax: number;
  privateFamilyMin: number;
  sellingToMeMax: number;
  spamMax: number;
};

export type Preset = {
  name: string;
  /** The ICP block, rendered verbatim on the Methods page. */
  icp: string;
  questions: QuestionSpec[];
  thresholds: Thresholds;
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
