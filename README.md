# City of Shadows — Afterlight District

An original, browser-playable single-player prototype set in the fictional Afterlight District. It uses generated Canvas scenery and original story text; it does not use assets or characters from an existing game.

## Run locally

You only need a modern browser and a local static-file server. From this folder, run:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The game has no build step, account, or game-server dependency. Story progress, funds, player position, and the vehicle are saved in the browser's local storage on that device. Clearing browser data will remove the save. The page requests Google Fonts for its typefaces; if those fonts cannot be fetched, it uses system fallbacks.

## Controls and prototype features

- **WASD** or **arrow keys** to move; **mouse** to look around.
- **E** to enter or leave a nearby vehicle.
- **WASD** to drive while in a vehicle; **Space** to brake.
- **Escape** to pause and open settings.
- Touch controls are provided for smaller screens.
- Explore the generated city, interact with vehicles, and progress through four short story missions. Mission rewards and progression are saved locally.

This is a small 2D Canvas prototype, not a finished open-world game. It currently has four story missions and a limited generated district; it does not include the requested 15 main missions and 20 side missions or a complete 3D city campaign.

## Android status

There is no Android Studio/Unity project, packaged app, or APK in this repository. The responsive browser prototype can be opened in a mobile browser, but that is not a native Android build and has not been packaged or verified as an installable app. Native Android delivery would require a separate project and build process.

## Files

- `index.html` — game interface and touch controls
- `style.css` — responsive layout and interface styling
- `game.js` — Canvas game, controls, missions, and local save system
