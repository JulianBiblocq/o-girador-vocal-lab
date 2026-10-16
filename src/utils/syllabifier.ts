/**
 * syllabifier.ts
 * Re-export pour rétrocompatibilité avec syllableSplitter et syllableAligner.
 */
export { syllabifySingleWord, splitTextIntoLetraSyllables } from './syllableSplitter';
export { mapSyllablesToSteps, reconstructWordsFromSteps } from './syllableAligner';
