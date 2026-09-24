import GoogleCast, { RemoteMediaClient } from 'react-native-google-cast';
import { episodeLabel, JellyfinClient, posterUrl, TICKS_PER_SECOND } from '@/api/jellyfin';
import { buildDeviceProfile } from '@/api/deviceProfile';
import { Settings } from './settings';

/** Sends an item to the connected Chromecast using a cast-compatible stream. */
export async function castItem(
  remote: RemoteMediaClient,
  client: JellyfinClient,
  settings: Settings,
  itemId: string,
  startTicks = 0,
) {
  const [item, info] = await Promise.all([
    client.item(itemId),
    client.playbackInfo(itemId, {
      startTimeTicks: startTicks,
      deviceProfile: buildDeviceProfile('cast', settings),
      maxStreamingBitrate: settings.maxBitrate || 20_000_000,
    }),
  ]);
  const source = info.MediaSources?.[0];
  if (!source) throw new Error('The server returned no castable source.');
  const url = client.streamUrl(itemId, source, info.PlaySessionId);
  const hls = !source.SupportsDirectPlay;
  const poster = posterUrl(client, item, 600);

  await remote.loadMedia({
    autoplay: true,
    startTime: startTicks / TICKS_PER_SECOND,
    mediaInfo: {
      contentUrl: url,
      contentType: hls ? 'application/x-mpegURL' : 'video/mp4',
      streamDuration: item.RunTimeTicks ? item.RunTimeTicks / TICKS_PER_SECOND : undefined,
      metadata:
        item.Type === 'Episode'
          ? {
              type: 'tvShow',
              seriesTitle: item.SeriesName,
              title: `${episodeLabel(item) ?? ''} ${item.Name}`.trim(),
              images: poster ? [{ url: poster }] : [],
            }
          : { type: 'movie', title: item.Name, images: poster ? [{ url: poster }] : [] },
    },
  });
  GoogleCast.showExpandedControls();
}
