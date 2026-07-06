# FCC Maps

An interactive map generator and administration dashboard. The project consists of a TypeScript backend server and a React admin interface using ShadCN UI and Leaflet.

## Project Structure

* **admin**: React frontend built with Vite, Tailwind CSS, and ShadCN UI. Accessible at `/admin`.
* **server**: Express and TypeScript backend running on port 5050. Serves the APIs, log storage, and database configurations.
* **public**: Static assets served by the server, including uploaded files (`/uploads`), marker data (`/markers.json`), and the localized Leaflet map embed (`/embed`).

## Development

### Setup

Install dependencies for all workspaces:

```bash
npm run install:all
```

### Run Locally

Start both the backend server and the Vite dev server concurrently:

```bash
npm run dev
```

The admin panel will be available at `http://localhost:5174/admin/` and the map embed at `http://localhost:5050/embed`.

### Production Build

Build the server and build the admin application into the server's public directory:

```bash
npm run build
```

Start the built production server:

```bash
npm run start
```
