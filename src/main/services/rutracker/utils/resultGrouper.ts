/**
 * Re-export shared classification utilities for main process convenience.
 * All logic lives in @shared/utils/resultClassifier for cross-process access.
 */
export {
  isLikelyDiscography,
  classifyResult,
  groupResults,
  filterDiscographyPages,
} from '@shared/utils/resultClassifier'
