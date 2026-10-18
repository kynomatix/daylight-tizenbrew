# Daylight for TizenBrew

A generic home display for weather, US AQI, UV and solar energy. This module
contains no household location, coordinates, battery account or service token.
It requires a private Daylight service running on your home computer.

## Install with TizenBrew

In TizenBrew, add a **GitHub module** and enter:

```text
kynomatix/daylight-tizenbrew
```

Repository: https://github.com/kynomatix/daylight-tizenbrew

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

The TV stores the service address and display token in its own local storage.
It never receives the Eveready login. Pairing codes expire in five minutes and
are limited to five attempts; generate a new code on the PC if needed. Use a
trusted home network; the initial LAN service uses HTTP, not TLS. Do not forward
the service port to the internet. Network/firewall access may need configuration
on the PC; this project does not change firewall rules automatically.

Use arrows and Enter to navigate. In a text field, Up/Down moves between controls;
Left/Right edits text. Back closes settings or returns to Overview. Red refreshes
the display and Blue opens settings. The module refreshes on return from the
background; the PC does the collection independently of the TV.

## What the numbers mean

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
- History plots power by receipt time and breaks lines across collection gaps.
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
