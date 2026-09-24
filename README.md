# WholphinMobile

A Jellyfin client for Android and iOS phones and tablets, with built-in [Seerr](https://github.com/seerr-team/seerr) (Jellyseerr / Overseerr) support for discovering and requesting new movies and shows.

The interface is modeled on **[Wholphin](https://github.com/damontecres/Wholphin)**, the excellent open-source Android TV client for Jellyfin by [damontecres](https://github.com/damontecres) and contributors. If you have an Android TV, go use Wholphin.

## Credits

- **[Wholphin](https://github.com/damontecres/Wholphin)** for the design this app brings to mobile: the backdrop hero, home rows (Continue Watching, Next Up, Recently Added), detail pages and Seerr integration. WholphinMobile is an independent project written from scratch in TypeScript; it is not affiliated with or endorsed by the Wholphin project and does not contain Wholphin's code or assets. Wholphin itself is licensed under GPL-2.0.
- **[Jellyfin](https://jellyfin.org)** for the media server and API.
- **[Seerr](https://github.com/seerr-team/seerr)** for the request server and API. Discover metadata and images come from TMDB via Seerr.

## Features

- Sign in to any Jellyfin server (HTTP or HTTPS, LAN or remote)
- Home page with a backdrop hero, Continue Watching, Next Up and Recently Added rows per library
- Library browsing with sort (A–Z, recently added, release date, rating, random) and filters (unwatched, favorites)
- Detail pages for movies, series, seasons and episodes, with season picker, episode list, cast and "More Like This"
- Mark watched / favorite
- Video playback with native controls, resume position, picture-in-picture, and progress reporting back to Jellyfin; the server direct-plays what the device supports and transcodes to HLS otherwise
- Search across your libraries
- Seerr: Discover rows (trending, popular movies and series, upcoming), search, detail pages, and requests (pick individual seasons for series). Sign in with your Jellyfin account, a local Seerr account, or an API key
- Jump from a Seerr title that is already available straight to it in your library

## Tech stack

- [Expo](https://expo.dev) SDK 57 / React Native, TypeScript
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation (`src/app`)
- [expo-video](https://docs.expo.dev/versions/latest/sdk/video/) for playback, [expo-image](https://docs.expo.dev/versions/latest/sdk/image/) for artwork
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) for tokens and credentials

```
src/
  api/          Jellyfin and Seerr clients, playback device profile
  app/          Screens (Expo Router)
    (tabs)/     Home, Libraries, Search, Discover, Settings
    item/       Jellyfin item detail
    library/    Library grid
    player/     Video player
    seerr/      Seerr detail and request
  components/   Cards, rows, hero, shared UI
  lib/          Session state, storage, theme, helpers
```

## Getting started

```bash
npm install
npm start          # then press a for Android or i for iOS
```

The player uses native modules, so use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) rather than Expo Go:

```bash
npx expo run:android
npx expo run:ios
```

Or build in the cloud with EAS:

```bash
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
```

Type-check with `npm run typecheck`.

## Notes

- Cleartext HTTP is allowed on both platforms so LAN servers like `http://192.168.1.10:8096` work.
- Android direct-plays MKV/WebM with H.264, HEVC, VP9 and AV1; iOS direct-plays MP4/MOV with H.264 and HEVC. Everything else is transcoded by the server.
