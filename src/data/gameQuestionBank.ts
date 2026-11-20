import { GameQuestionItem, GameTemplate } from '../types/portal';
import { CROSSWORD_BANK } from './bankCrossword';
import { HORSE_RACE_BANK } from './bankHorseRace';
import { RUNNING_RACE_BANK } from './bankRunningRace';
import { WORD_SEARCH_BANK } from './bankWordSearch';

export const GAME_QUESTION_BANK: Record<GameTemplate, GameQuestionItem[]> = {
  'running-race': RUNNING_RACE_BANK,
  'horse-race': HORSE_RACE_BANK,
  crossword: CROSSWORD_BANK,
  'word-scramble': WORD_SEARCH_BANK,
};

export function getBankForTemplate(template: GameTemplate): GameQuestionItem[] {
  return GAME_QUESTION_BANK[template] || RUNNING_RACE_BANK;
}
