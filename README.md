## Automatic travel completion

Use [this fork of Exile Leveling](https://kenkuo.github.io/exile-leveling/#/)
with [exile-log-api](https://github.com/Sarthak-Bhagat/exile-log-api).
Run the helper while Path of Exile is running, then open the website in the
same computer's browser. The default WebSocket address is `ws://localhost:6754`.
If automatic log discovery does not work, pass `--log-path` with your client
log's full path.

Allow local network access for this website if your browser requests it.
If the site stays at "Setup Auto-Progress" despite the helper running, check
that permission in the browser's site settings.

Auto-progress now also checks off the next matching standalone travel step.
It uses the helper's existing area-generation messages, which indicate the
expected destination, not proof of quest completion or the transport used.
Quest hand-ins, kills, items, waypoint acquisition, trials, crafting, and gems
remain manual. Mixed instructions, custom action text, and steps with substeps
also remain manual rather than guessing what was completed.

Existing checkmarks and manual controls are preserved. Duplicate messages do
not toggle checkmarks, and old log entries are not replayed on connection.
The original HeartofPhos website is unchanged. Its saved progress does not
automatically transfer to this fork because browser storage is origin-specific.

## Getting Started

- `npm i`
- `npm run dev -w web`

## Seeding

### Passive Tree

- `npm run seed tree -w seeding`

### General

- Find the list of required `dat` files in `seeding/data/index.ts`
- Use https://github.com/HeartofPhos/exile-export to get required `.dat.json` files
- `npm run seed data -w seeding`

## Route

I'm not currently taking PRs related to route changes, my intention is to keep the base route in line with current speed running strategies.

Users are encourged to use the [Edit Route Tab](https://kenkuo.github.io/exile-leveling/#/edit-route) in the deployed app to update the route to their preferred playstyle.
