// VLC is the iOS all-codec player; Android uses mpv (modules/mpv-player) instead.
module.exports = {
  dependencies: {
    'react-native-vlc-media-player': { platforms: { android: null } },
  },
};
