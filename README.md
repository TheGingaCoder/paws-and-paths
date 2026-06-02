# Paws & Paths Visual Prototype

Design-focused clickable mockup for a native-style dog walking app inspired by Apple Maps.

This prototype intentionally does not implement real GPS tracking, route persistence, accounts, authentication, scoring, or destructive data actions. It demonstrates the app shell, visual direction, tabs, cards, modals, and sample content.

The current mock map visual style is a keeper. When the real functional map is rebuilt later, preserve this soft Apple Maps-inspired look: calm roads, parks, rounded labels, floating glass controls, and route lines that feel integrated rather than technical.

The Dogs tab now stores local dog profiles in `localStorage`, including uploaded profile photos as local data URLs.

## Structure

- `index.html` - app shell and static map mockup
- `styles.css` - Apple-inspired visual system and responsive app layout
- `app.js` - simple tab switching, mock modals, and toast behaviour

## Run Locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

## Prototype Checklist

- Four tabs: Map, Routes, Dogs, Account
- Font Awesome icons throughout
- Mobile-first app shell
- Full-screen map mockup
- Routes and Account use fake/sample data only
- Dogs can be added, edited, selected, deleted, and restored from local browser storage
