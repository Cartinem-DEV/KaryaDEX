/**
 * KaryaDEX — Universal Game Guide Content
 *
 * Rich educational documentation, rules, controls, and tactical advice
 * for all 4 KaryaDEX Playground games.
 */

import type { PlaygroundGameType } from '@/types/playground';
import type { GameGuideContent } from './guideTypes';

export const GAME_GUIDES: Record<PlaygroundGameType, GameGuideContent> = {
  sprint_duel: {
    gameType: 'sprint_duel',
    title: 'Sprint Duel',
    tagline: '1v1 Live Arithmetic Blitz against Sero AI',
    category: 'SPEED ARITHMETIC',
    accentColor: '#B1FA63',
    secondaryColor: '#00D9FF',
    iconName: 'lightning-bolt',
    overview:
      'Sprint Duel puts your mental arithmetic speed and composure to the test. Compete in a rapid 60-second real-time duel against Sero AI. Answer fast equations, build combo fire streaks, and outscore your rival before the clock expires.',
    rules: [
      'The duel lasts strictly 60 seconds.',
      'Each correct answer scores base points and increments your Combo streak.',
      'Maintaining consecutive correct answers boosts your multiplier up to 3.0×.',
      'A wrong answer immediately drops your combo multiplier back to 1.0×.',
      'All equations use whole integer numbers, positive results, and clean integer division.',
      'Higher accuracy gives bonus Brain Rating points at the end of the duel.',
    ],
    controls: [
      {
        action: 'Numpad Keys (0–9)',
        description: 'Tap numbers to type your multi-digit or single-digit answer.',
      },
      {
        action: 'Backspace (⌫)',
        description: 'Deletes the most recently entered digit.',
      },
      {
        action: 'Clear (C)',
        description: 'Wipes the current input so you can start typing fresh.',
      },
      {
        action: 'Automatic Submission',
        description: 'No enter key needed! Correct answers advance instantly.',
      },
    ],
    proTips: [
      'Accuracy beats raw speed: a broken 3.0× combo costs far more points than taking half a second longer to verify.',
      'Use number chunking for addition: 17 + 8 = 17 + 3 + 5 = 25.',
      'For fast subtraction: count up from the subtrahend to the nearest ten.',
    ],
  },

  queens: {
    gameType: 'queens',
    title: 'Queens',
    tagline: 'Territory Crown Deduction Logic',
    category: 'GRID LOGIC',
    accentColor: '#A855F7',
    secondaryColor: '#F59E0B',
    iconName: 'crown',
    overview:
      'Queens is an elegant spatial deduction game. Place crowns across a grid divided into colored territories while satisfying rigid positional constraints. Every row, column, and territory must contain exactly one queen without touching another queen.',
    rules: [
      'Place exactly ONE Queen (👑) in each row.',
      'Place exactly ONE Queen (👑) in each column.',
      'Place exactly ONE Queen (👑) in each colored territory sector.',
      'No two Queens may touch orthogonally OR diagonally (Chebyshev distance > 1).',
      'Marking blocked cells with Dots (•) helps eliminate impossible locations.',
      'The puzzle is won when all N Queens are placed with zero constraint violations.',
    ],
    controls: [
      {
        action: 'Single Tap',
        description: 'Places a Dot (•) to mark an empty cell as blocked or empty.',
      },
      {
        action: 'Double Tap',
        description: 'Places a Queen (👑) in the cell.',
      },
      {
        action: 'Triple Tap',
        description: 'Clears the cell back to empty.',
      },
      {
        action: 'Reset Icon (↺)',
        description: 'Clears all user-placed marks on the board so you can start over.',
      },
    ],
    proTips: [
      'Whenever you place a Queen, immediately dot all 8 neighboring diagonal and orthogonal cells.',
      'Look for isolated 1-cell or narrow territories — they strictly dictate where that sector’s Queen must sit.',
      'Eliminate rows and columns that only pass through a single cell of a given territory.',
    ],
  },

  tango: {
    gameType: 'tango',
    title: 'Tango',
    tagline: 'Sun ☀️ vs Moon 🌙 Binary Balance',
    category: 'BINARY CONSTRAINTS',
    accentColor: '#00D9FF',
    secondaryColor: '#EC4899',
    iconName: 'yin-yang',
    overview:
      'Tango is a Japanese-style binary deduction puzzle. Fill the 6×6 grid with Sun and Moon symbols such that every row and column is perfectly balanced and adheres to equal and opposite constraint gates.',
    rules: [
      'Every row and column must contain an equal number of Suns (☀️) and Moons (🌙) (3 of each in a 6×6 grid).',
      'No more than TWO identical symbols can be adjacent anywhere in a row or column (no ☀️☀️☀️ or 🌙🌙🌙).',
      'Equal constraint (=): cells connected by an equal sign MUST have the SAME symbol.',
      'Opposite constraint (×): cells connected by a cross sign MUST have OPPOSITE symbols.',
      'Pre-filled starting cells (givens) are locked and cannot be changed.',
    ],
    controls: [
      {
        action: 'First Tap',
        description: 'Places a Sun (☀️) in the unlocked cell.',
      },
      {
        action: 'Second Tap',
        description: 'Switches the cell to a Moon (🌙).',
      },
      {
        action: 'Third Tap',
        description: 'Clears the cell back to an empty slot.',
      },
      {
        action: 'Undo & Reset',
        description: 'Easily step back or reset the board at any time.',
      },
    ],
    proTips: [
      'Look for sandwich patterns: if two Suns are separated by an empty cell (☀️ _ ☀️), the center MUST be a Moon (🌙).',
      'When two adjacent cells have the same symbol (☀️☀️ _), the bookends must be opposite (🌙☀️☀️🌙).',
      'Count row symbols: once 3 Suns are placed in a row, all remaining slots in that row MUST be Moons.',
    ],
  },

  mind_snap: {
    gameType: 'mind_snap',
    title: 'MindSnap',
    tagline: 'Matrix Pattern Sequence Blitz',
    category: 'WORKING MEMORY',
    accentColor: '#F59E0B',
    secondaryColor: '#B1FA63',
    iconName: 'brain',
    overview:
      'MindSnap trains rapid visual working-memory and spatial recall. A futuristic 3×3 matrix flashes an expanding sequence of neon tiles. Memorize the pattern and replay it with flawless accuracy.',
    rules: [
      'Observe the sequence as tiles illuminate in order during the preview phase.',
      'When "YOUR TURN" appears, tap the identical tiles in the exact order shown.',
      'Each round increases sequence length by 1 and accelerates playback speed.',
      'A single mistake ends the session immediately and tallies your final recall score.',
      'Speed bonus is awarded for fast, decisive taps during your recall turn.',
    ],
    controls: [
      {
        action: 'Watch Phase',
        description: 'Pads are temporarily locked while the pattern sequence flashes.',
      },
      {
        action: 'Recall Tap',
        description: 'Tap each 3×3 tile pad in exact sequential order.',
      },
      {
        action: 'Haptic & Audio Pulse',
        description: 'Each pad triggers a unique pitch and tactile haptic pulse upon press.',
      },
    ],
    proTips: [
      'Chunk long patterns into smaller segments (e.g. "top row, center, zigzag").',
      'Track movement trajectories with your eyes rather than individual static coordinates.',
      'Stay relaxed: tense players hesitate and lose rhythm during fast-paced rounds.',
    ],
  },
};
