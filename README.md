# Seewärme St. Gilgen

Heating app for the St. Gilgen flat. It runs on the NAS in Vienna and talks to the St. Gilgen Home Assistant over Tailscale.

- The phone app (one page, can be added to the home screen) shows the stay plan, who is in the flat, each room, costs and the house rules.
- All heating logic stays in Home Assistant: stay planner, learned warm-up time, eero presence, notifications. The app only reads it and presses the same buttons.
- The Home Assistant key stays on the NAS. The app accepts only the heating controls (mode, room temperatures, comfort temperatures, stay dates, heating settings, open-window detection) and refuses everything else.
- Costs come from the Salzburg Netz smart meter and the electricity price from the income and expense app, both already in Home Assistant.

## Install on the QNAP (Container Station)

1. **Key for Home Assistant:** in the St. Gilgen Home Assistant, click your name (bottom left) → **Security** → **Long-lived access tokens** → **Create token**, name it "Seewärme NAS", copy it.
2. **Container Station** → **Applications** → **Create** → name `stg-heating` → paste `docker-compose.yml` from this repository → replace the `HA_TOKEN` text with the token → **Create**.
3. Open `http://homeserver:8793` (through Tailscale) or `http://<nas-ip>:8793` (at home). The badge at the top should say **Live · St. Gilgen**.
4. On the iPhone: Share → **Add to Home Screen**.

Optional, for HTTPS and per-person access: on the NAS run `tailscale serve --bg --https=18793 http://127.0.0.1:8793`, open `https://<nas-name>.ts.net:18793`, and set `ALLOWED_USERS` to the Tailscale logins that may use the app.

## Updating

Every change pushed to `main` builds a new image (`ghcr.io/wood29/stg-heating:latest`). In Container Station, recreate the application (or pull the image again) to get it.

## Settings (environment)

| Variable | Meaning |
|---|---|
| `HA_URL` | St. Gilgen Home Assistant, e.g. `https://<st-gilgen-home-assistant>.ts.net` |
| `HA_TOKEN` | Long-lived access token (required) |
| `ALLOWED_USERS` | Optional comma-separated Tailscale logins allowed in (needs Tailscale Serve) |
| `COST_STATISTIC`, `ENERGY_STATISTIC` | Smart meter statistics, default `salzburgnetz:cost_2197186` / `salzburgnetz:consumption_2197186` |
| `PRICE_SENSOR` | Default `sensor.st_gilgen_electricity_price` |

Opened anywhere else (for example as a file), the page runs on example data.
