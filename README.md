# ARV Route Planner

Delivery routing & truck allocation tool for Allround Vending. Enter jobs (pickup/delivery
addresses, pickup & delivery counts, and machines), and it builds a single continuous route,
pulls live driving times from Google Distance Matrix, and tells you whether the day fits one
truck or needs two.

## How it decides

- **Service time**: 30 min per pickup + 30 min per delivery.
- **Driving time**: live, from Google Distance Matrix, between each stop in order, starting at
  the Tullamarine warehouse (after the fixed 05:00 Cranbourne departure and ~07:00 drop).
- **Day window**: 8 hours.
- **Truck capacity** (Truck 16 ARV): 7.72 m² floor, 2,000 kg payload — checked from the machine list.
- **Two trucks** when total time exceeds 8 hours, or two or more jobs each need a near-full
  dedicated trip. Jobs that don't fit one truck at all are flagged for review.

The route is **not** auto-split — jobs are served in the order you add them.

## The API key is never in the browser

The browser calls this server; the server calls Google using `GOOGLE_MAPS_API_KEY`. The key
lives only in the server environment.

## Run locally

1. Install Node 18+.
2. `npm install`
3. Copy `.env.example` to `.env` and paste your Distance Matrix key.
4. `node -r dotenv/config server.js`  (or set the env var in your shell, then `npm start`)
5. Open http://localhost:3000

> For local `.env` loading, either run with `node -r dotenv/config server.js` after
> `npm install dotenv`, or just export the variable in your shell:
> `GOOGLE_MAPS_API_KEY=yourkey npm start`

## Deploy to Render (recommended)

1. Push this folder to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `npm install`  ·  Start command: `npm start`
4. Under **Environment**, add a variable:
   - Key: `GOOGLE_MAPS_API_KEY`
   - Value: your Distance Matrix key
5. Deploy. Render assigns the `PORT` automatically.

Railway is the same idea: deploy from repo, add the `GOOGLE_MAPS_API_KEY` variable under Variables.

## Securing the key

In Google Cloud, restrict the key to the **Distance Matrix API** only. Because calls come from
your server (one fixed outbound), you can also add an IP restriction once you know your host's
egress IP. Keep the key out of Git — `.env` is gitignored.

## Notes / limits

- Distance Matrix is billed per origin-destination pair; this tool makes one pair per consecutive
  stop. Small daily volumes sit comfortably in the free credit.
- Driving times reflect typical/default traffic, not a specific departure time. Add
  `&departure_time=now` server-side if you want traffic-aware times (needs billing enabled).
- Capacity is a fit check by floor area + weight, mirroring the Load Planner. It does not do 2D
  bin-packing placement — treat near-capacity loads as "confirm in the Load Planner".
