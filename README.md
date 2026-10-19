# Daylight for TizenBrew

A generic home display for weather, US AQI, UV and solar energy. This module
contains no household location, coordinates, battery account or service token.
It requires a private Daylight service running on your home computer.

## Install with TizenBrew

In TizenBrew, add a **GitHub module** and enter:

```text
kynomatix/daylight-tizenbrew@v0.5.1
```

Repository: https://github.com/kynomatix/daylight-tizenbrew

The versioned entry avoids stale files from the unversioned download cache.
When updating from the old entry, replace that module entry and restart
TizenBrew. The TV's saved Daylight connection is shared across module versions.
The cog opens **Settings**, which shows **Daylight 0.5.1**, read from the running dashboard code.
Use that to identify this build, separately from TizenBrew's own 2.x version
or a cached version on its module tile. Module updates require no Developer
Mode Host PC IP change; they are downloaded through TizenBrew.

This separate repository contains only the display module: `package.json` at
the repository root, plus `app/` and this README. The private PC service and
household settings are kept outside this repository.

The generated ZIP is a source bundle, not a `.wgt` and not a promise that
TizenBrew can import ZIP files directly. It is provided to make a clean,
location-free repository easy to create. TizenBrew reference:
https://github.com/reisxd/TizenBrew/blob/main/docs/MODULES.md

## Pair the display

1. On the PC, open **Start Dashboard.cmd** from the main project. Keep it open.
2. Open the module in TizenBrew, then open **Connection settings**.
3. Enter the service address and the one-time six-digit code shown on the PC.
4. Keep the Eveready monitoring window open for solar updates and history.

Version 0.2.1 adds a TizenBrew service that stores the service address and display
token in a private file on the TV, independently of browser storage. Fully close
and reopen TizenBrew after updating, then pair once. Daylight restores the saved
connection when reopened, even after a TizenBrew restart. **Forget display**
removes the saved connection. If saving fails, a visible banner explains that
the pairing is only for the current visit. Browser previews use local storage.
The TV never receives the Eveready login. Pairing codes expire in five minutes and
are limited to five attempts; generate a new code on the PC if needed. Use a
trusted home network; the initial LAN service uses HTTP, not TLS. Do not forward
the service port to the internet. Network/firewall access may need configuration
on the PC; this project does not change firewall rules automatically.

Use arrows and Enter to navigate. In a text field, Up/Down moves between controls;
Left/Right edits text. Back closes Settings, or returns from Hourly/Energy/Clouds & rain to
Overview. Back on Overview opens **Leave Daylight?**, with **Stay here** focused
by default. Confirm to return to the existing TizenBrew menu; **Exit Daylight**
in Settings opens the same prompt. Leaving does not forget pairing or stop PC
collection. If there is no previous launcher page, the app uses native exit when
available, otherwise explains how to leave using the TV remote. Red refreshes
the display and Blue opens settings. The module refreshes on return from the
background; the PC does the collection independently of the TV.

## What the numbers mean

### Hour by hour weather

Choose **Hour by hour →** on the weather card, or the **Hourly** tab. The next
24 hours appear in six-hour pages, with temperature, conditions, rain chance,
expected precipitation in mm and wind. Use **Previous / Next 6 hours** with the
remote, and Back to return to Overview. A summary identifies the highest rain
chance in the available forecast; it does not promise exactly when rain starts.

Hourly data is a separately labelled **Open-Meteo model forecast**. BOM still
supplies the overview's observations and daily forecast. The private PC service
fetches the hourly forecast alongside UV every 15 minutes using the location
already configured privately. No location is included in this repository.

Each interval is labelled with its start and end in local time. Rain chance and
amount apply to that interval; temperature and wind are forecast at its end.
Chance includes rain, showers or snow; precipitation amounts use water equivalent.
Unavailable values remain blank rather than becoming zero. Cached or failed
forecasts are labelled and do not give a current rain-planning summary.

### Household energy

**What we make & use** and the larger Energy chart default to a smoothed trend.
A centred five-minute average softens short spikes; shape-preserving curves join
the plotted values without overshooting them. Gaps of up to 15 minutes are
connected, with joins over three minutes dotted to identify estimates. Longer
outages remain blank. **View raw readings** switches both charts back to the
original values and straight lines with three-minute gap breaks.

This only changes the display. Recorded history, live power cards and household
advice still use the original readings; no interpolated samples are saved.

The overview leads with a household explanation such as **Power to spare**,
**Solar is helping**, or **Waiting for a fresh reading**. Spare-power suggestions
require a recent, online, alarm-free reading, confirmed export direction, and
both measured export and solar above household demand greater than 100 W.
They describe the current snapshot, not a promise that a particular appliance
will run entirely on solar. Battery charge is shown as a percentage full without
an invented hours-remaining estimate. **What do these mean?** opens the Energy
page with everyday definitions and a short explanation of kW.

- Weather observations and regional forecasts are from the Australian Bureau of
  Meteorology (BOM). The selected station and distance are shown; readings are
  not represented as a sensor at your home.
- AQI is **US AQI**, modelled from CAMS through Open-Meteo, not a local EPA sensor.
- UV is a modelled index and daily peak from Open-Meteo, not an ARPANSA detector.
- Solar readings come from the private Eveready monitor. Old or offline readings
  are labelled. Device-clock interpretation is unresolved.
- History plots power by receipt time. Short gaps can be interpolated on screen;
  longer outages remain visible, and original readings are available in raw mode.
  It does not claim daily kWh totals or schedule workloads.

The demo is explicitly labelled and uses synthetic values. It works without a
server connection; no household information is embedded in its sample data.

## Data attribution

Weather: Australian Government Bureau of Meteorology. BOM public feeds:
https://www.bom.gov.au/catalogue/data-feeds.shtml
https://www.bom.gov.au/other/copyright.shtml

Air quality and UV: Open-Meteo and Copernicus Atmosphere Monitoring Service
(CAMS). Air quality contains modified CAMS information.
https://open-meteo.com/ · https://atmosphere.copernicus.eu/
https://open-meteo.com/en/docs/air-quality-api

This is a personal home dashboard. Check the provider terms before commercial
redistribution or offering a hosted service. The app is not an official BOM,
Open-Meteo, Samsung or Eveready product.

## Clouds & rain (0.5.1)

Choose **Clouds & rain** for a satellite cloud loop or observed BOM rain radar.
Use **Earlier**, **Later** and **Play / Pause** with the remote. The selected
image time follows a marker on the solar/home chart for the same period. A solar
value is shown only when a recorded sample is within three minutes of the image.
Images and solar readings have different observation times and resolutions; this
comparison does not establish the cause of a production dip.

The cloud view offers an approximate regional crop and a wider context view.
Rain radar detects precipitation, not every cloud. Satellite cloud detail is less
useful at night. Failed or older imagery is labelled; old loops cannot autoplay.
These are observed frames, not a predicted future path. The hourly model forecast
remains available through the screen's forecast button.

The PC downloads imagery from BOM's documented anonymous FTP service, caches it
privately, and resizes cloud images before the TV decodes them. Images require the
existing paired-display Bearer token; no token is put in image URLs. Location,
product selection and regional crop are configured only on the private PC.
No BOM imagery, household settings or location data is included in this repository.

This integration is for a personal household display. BOM's public FTP terms
permit personal/internal use but restrict onward supply and commercial use.
Publishing generic display code does not grant permission to redistribute BOM
images. Review terms for your own use:
https://www.bom.gov.au/catalogue/anon-ftp.shtml
https://www.bom.gov.au/copyright


### Approximate area marker (0.4.1)

Both maps can show a fixed-size **Your area · Approximate** marker. Its position
comes only from private PC settings, and follows the image when changing between
regional and wider cloud views. No household coordinates or selected marker
positions are bundled here. If a marker is missing, invalid or outside the visible
crop, it stays hidden rather than being placed at an arbitrary edge. Marker
positions are tied to their configured image product so switching products cannot
silently reuse a position for another map.


## Themed radar map (0.5.0)

Rain radar now uses a landscape vector map styled for Daylight, with crisp town
labels, coastlines, a distance scale and the approximate area marker. **Full radar
range** shows the whole source footprint; **Landscape view** returns to the TV
layout. Observed BOM rain pixels keep their original geographic relationship to
the map. The map does not increase the resolution or accuracy of the radar data.
The dashed circle marks the radar range. There is no radar coverage outside it.

All geography and selected place names come from the private paired service.
No map tiles, household map geometry, selected area or local town list is bundled
in this repository. The PC prepares its map locally from global datasets:
Natural Earth land polygons (public domain) and GeoNames place names (CC BY 4.0).
Map colours, clipping and label layout are modified by Daylight. Attribution:
https://www.naturalearthdata.com/about/terms-of-use/
https://www.geonames.org/
https://creativecommons.org/licenses/by/4.0/

### Watch / mouse pointer

This module uses standard clickable HTML controls and does not hide the mouse.
Samsung's native pointer support is a setting of the installed host package.
The current upstream TizenBrew manifest does not explicitly enable it; Samsung
TVs from 2021 default to disabled when that setting is absent. A module update
cannot change TizenBrew's installed manifest. No software pointer workaround is
claimed. Native pointer support requires a TizenBrew package built with
`pointing-device-support="enable"`, then verification on the user's TV.
https://developer.samsung.com/smarttv/develop/guides/user-interaction/mouse.html


### Rain playback (0.5.1)

Fresh rain radar autoplays observed history. Playback pauses longer on the latest
scan, with a clear LATEST SCAN badge, image time and age, a separate NOW clock,
and a timeline from oldest to newest. Earlier images are labelled PAST FRAME.
Latest scan jumps to the newest image and pauses. Manual Pause stays paused
when readings refresh; stale or offline imagery never starts autoplay. These
are past observations, not a predicted path.
