# Ember

A minimalist, responsive card guessing game built entirely in vanilla HTML, CSS, and JavaScript.

## The Game

Ember is a simple, luck-based digital card game where you try to predict the properties of a randomly drawn playing card from a standard 52-card deck.

Each turn a new random card is generated, independent of the previous turns, and you earn points by accurately predicting its colour, its suit, and its rank.

### Scoring System
- **Color:** +1 point (void if both picked)
- **Suit:** +2 points (void if all picked)
- **Rank:** +6 points (void if all picked)

*Note: Selecting all options within a category voids it and awards 0 points for that category.*

### Features
- **Minimalist Aesthetic:** Stripped back, dark, typography-first UI.
- **Single Player:** Play rounds of 5, 10, 20, or a custom number of turns.
- **Multiplayer:** Play locally with up to 8 players via rotating turns.
- **Fluid UI:** Subtle reveal animations, dynamic HUDs, and end-of-game confetti feedback.
- **Zero Dependencies:** Pure vanilla JavaScript and CSS variables.

## Getting Started

Because the project uses no frameworks or build steps, it requires zero installation. 

Simply open the `index.html` file in any modern web browser to play. 

```bash
# Example if cloning locally on macOS/Linux
open index.html

# Example on Windows
start index.html
```

## Structure
- `index.html` - The markup and structure for all game screens (Home, Setup, Game, Results, End).
- `styles.css` - All styling including the dark monochromatic theme, animations, and responsive breakpoints.
- `game.js` - The entire game logic loop: deck generation, scoring, UI state toggling, and multiplayer rotation.

## Design
Ember was refactored for a premium minimalistic look. It uses the `Outfit` font for the UI and standard `Georgia` for the card faces themselves to retain a classic playing card feel against an otherwise intensely modern interface.
